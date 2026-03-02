
-- 1. Firm Sequences
CREATE TABLE IF NOT EXISTS firm_sequences (
    firm_id UUID PRIMARY KEY REFERENCES firms(id),
    pv_sequence BIGINT DEFAULT 0,
    invoice_sequence BIGINT DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Trust Account Separation
ALTER TABLE payment_vouchers ADD COLUMN IF NOT EXISTS fund_type TEXT DEFAULT 'OFFICE'; -- OFFICE, TRUST
ALTER TABLE gl_entries ADD COLUMN IF NOT EXISTS account_group TEXT DEFAULT 'OFFICE'; -- OFFICE, TRUST

-- 3. Client Ledger System
CREATE TABLE IF NOT EXISTS client_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL, -- Link to 'cases' purchaser or separate client table? Using 'cases.id' or logical client ID. Assuming 'client_id' is a foreign key to a client entity, but schema has 'cases'. Let's assume client_id refers to a Case ID or a new Clients table. Given 'purchaser_name' in cases, let's link to `cases` for now or just store ID. Prompt says `client_id UUID`. Let's add it to PV first.
    transaction_date DATE DEFAULT CURRENT_DATE,
    reference_type TEXT, -- PV, INV, RECEIPT
    reference_id UUID,
    description TEXT,
    debit NUMERIC DEFAULT 0,
    credit NUMERIC DEFAULT 0,
    balance NUMERIC DEFAULT 0,
    firm_id UUID REFERENCES firms(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE payment_vouchers ADD COLUMN IF NOT EXISTS client_id UUID; -- References cases(id) or client entity? Let's assume generic UUID for now.

-- 4. Accounting Period Control
CREATE TABLE IF NOT EXISTS accounting_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    year INT NOT NULL,
    month INT NOT NULL,
    is_closed BOOLEAN DEFAULT FALSE,
    closed_at TIMESTAMP WITH TIME ZONE,
    closed_by UUID REFERENCES auth.users(id),
    firm_id UUID REFERENCES firms(id) NOT NULL,
    UNIQUE(firm_id, year, month)
);

-- Enable RLS
ALTER TABLE firm_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Firm Sequences Access" ON firm_sequences FOR ALL USING (firm_id = public.get_user_firm_id());
CREATE POLICY "Client Ledger Access" ON client_ledger FOR ALL USING (firm_id = public.get_user_firm_id());
CREATE POLICY "Accounting Periods Access" ON accounting_periods FOR ALL USING (firm_id = public.get_user_firm_id());


-- ==========================================
-- UPDATED RPC FUNCTIONS (Enterprise Logic)
-- ==========================================

-- Helper: Check Period Status
CREATE OR REPLACE FUNCTION public.check_accounting_period(p_date DATE, p_firm_id UUID)
RETURNS VOID AS $$
DECLARE
    v_year INT;
    v_month INT;
    v_closed BOOLEAN;
BEGIN
    v_year := EXTRACT(YEAR FROM p_date);
    v_month := EXTRACT(MONTH FROM p_date);
    
    SELECT is_closed INTO v_closed 
    FROM accounting_periods 
    WHERE firm_id = p_firm_id AND year = v_year AND month = v_month;
    
    IF v_closed THEN
        RAISE EXCEPTION 'Accounting Period Closed for %-%', v_year, v_month;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;


-- 1. Create PV (Per-Firm Sequence)
CREATE OR REPLACE FUNCTION public.create_payment_voucher(
    p_payee_name TEXT,
    p_type TEXT,
    p_amount NUMERIC,
    p_purpose TEXT,
    p_user_id UUID,
    p_fund_type TEXT DEFAULT 'OFFICE',
    p_client_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_firm_id UUID;
    v_pv_no TEXT;
    v_pv_id UUID;
    v_year TEXT;
    v_seq BIGINT;
BEGIN
    -- 1. Get Firm
    SELECT firm_id INTO v_firm_id FROM firm_users WHERE user_id = p_user_id LIMIT 1;
    IF v_firm_id IS NULL THEN RAISE EXCEPTION 'User firm not found'; END IF;

    -- 2. Validate Fund Type
    IF p_fund_type NOT IN ('OFFICE', 'TRUST') THEN RAISE EXCEPTION 'Invalid Fund Type'; END IF;
    IF p_fund_type = 'TRUST' AND p_client_id IS NULL THEN RAISE EXCEPTION 'Client ID required for Trust PV'; END IF;

    -- 3. Get Next Sequence (Row Lock)
    INSERT INTO firm_sequences (firm_id, pv_sequence) VALUES (v_firm_id, 0) ON CONFLICT (firm_id) DO NOTHING;
    
    UPDATE firm_sequences 
    SET pv_sequence = pv_sequence + 1 
    WHERE firm_id = v_firm_id 
    RETURNING pv_sequence INTO v_seq;

    v_year := to_char(CURRENT_DATE, 'YYYY');
    v_pv_no := 'PV-' || v_year || '-' || lpad(v_seq::text, 4, '0');

    -- 4. Insert PV
    INSERT INTO payment_vouchers (
        pv_no, date, payee_name, type, amount, purpose, status, created_by, firm_id, fund_type, client_id
    ) VALUES (
        v_pv_no, CURRENT_DATE, p_payee_name, p_type, p_amount, p_purpose, 'Draft', p_user_id, v_firm_id, p_fund_type, p_client_id
    ) RETURNING id INTO v_pv_id;

    -- 5. Audit
    INSERT INTO audit_logs (table_name, record_id, action, new_data, user_id, firm_id)
    VALUES ('payment_vouchers', v_pv_id, 'CREATE', jsonb_build_object('pv_no', v_pv_no, 'fund_type', p_fund_type), p_user_id, v_firm_id);

    RETURN jsonb_build_object('success', true, 'id', v_pv_id, 'pv_no', v_pv_no);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;


-- 2. Approve PV (Trust Logic + Period Check)
CREATE OR REPLACE FUNCTION public.approve_payment_voucher(
    p_pv_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_pv RECORD;
    v_firm_id UUID;
    v_user_role TEXT;
    v_mapping RECORD;
    v_gl_entry_id UUID;
    v_client_balance NUMERIC;
BEGIN
    -- 1. Auth Check
    SELECT firm_id, role INTO v_firm_id, v_user_role FROM firm_users WHERE user_id = p_user_id LIMIT 1;
    IF v_firm_id IS NULL THEN RAISE EXCEPTION 'User firm not found'; END IF;
    IF v_user_role NOT IN ('Partner', 'Founder') THEN RAISE EXCEPTION 'Unauthorized'; END IF;

    -- 2. Lock PV
    SELECT * INTO v_pv FROM payment_vouchers WHERE id = p_pv_id AND firm_id = v_firm_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PV not found'; END IF;
    IF v_pv.status != 'Categorized' THEN RAISE EXCEPTION 'Invalid State'; END IF;

    -- 3. Check Accounting Period
    PERFORM public.check_accounting_period(CURRENT_DATE, v_firm_id);

    -- 4. Trust Logic Check
    IF v_pv.fund_type = 'TRUST' THEN
        -- Verify Client Balance (Cannot Overdraw Trust)
        -- Get current balance
        SELECT COALESCE(SUM(balance), 0) INTO v_client_balance FROM client_ledger 
        WHERE client_id = v_pv.client_id AND firm_id = v_firm_id;
        
        -- Logic: Approval creates Liability (Accrual). Actual deduction happens at Payment? 
        -- Or does Approval lock the funds?
        -- Usually, Trust Payment reduces Trust Liability.
        -- Let's check Client Ledger Balance. Trust Account = Asset. Client Ledger = Liability (Funds held for client).
        -- Paying out reduces Liability (Client Ledger) and reduces Asset (Bank).
        -- So we must ensure Client Ledger has enough funds.
        
        -- Actually, Approval establishes the obligation. Payment executes it.
        -- Let's check balance here to be safe.
        -- NOTE: Client Ledger structure in prompt has 'balance' column per row? Or running balance?
        -- "balance NUMERIC" in table def implies running balance or snapshot?
        -- Let's assume we sum debits/credits to get balance, OR we look at the last row.
        -- "Client ledger balance never goes negative" -> Implies we need to check SUM(credit - debit).
        -- Trust Funds: Credit = In, Debit = Out.
        SELECT COALESCE(SUM(credit - debit), 0) INTO v_client_balance FROM client_ledger WHERE client_id = v_pv.client_id AND firm_id = v_firm_id;
        
        IF v_client_balance < v_pv.amount THEN
            RAISE EXCEPTION 'Insufficient Trust Funds for Client. Balance: %, Required: %', v_client_balance, v_pv.amount;
        END IF;
    END IF;

    -- 5. GL Posting (Accrual)
    -- OFFICE: Dr Expense / Cr AP
    -- TRUST: Dr Client Trust Liability (control account) / Cr Trust AP? 
    -- Or Trust Accounting is usually Cash Basis?
    -- Prompt says: "If fund_type = TRUST: Post to Trust Liability instead of normal expense"
    -- Wait, if we are PAYING out trust funds, we are reducing Trust Liability.
    -- Dr Trust Liability (2xxx) / Cr Trust Bank (1xxx).
    -- But this is Approval step (Accrual).
    -- Dr Trust Liability / Cr Trust AP.
    
    INSERT INTO gl_entries (date, description, reference_type, reference_id, firm_id, created_by, account_group)
    VALUES (CURRENT_DATE, 'PV Accrual (' || v_pv.fund_type || '): ' || v_pv.pv_no, 'PV', p_pv_id, v_firm_id, p_user_id, v_pv.fund_type)
    RETURNING id INTO v_gl_entry_id;

    IF v_pv.fund_type = 'OFFICE' THEN
        -- Normal Flow
        SELECT * INTO v_mapping FROM category_gl_mapping WHERE category_name = v_pv.category AND firm_id = v_firm_id LIMIT 1;
        IF NOT FOUND THEN RAISE EXCEPTION 'GL Mapping not found'; END IF;

        INSERT INTO gl_lines (gl_entry_id, account_code, debit, credit, description, firm_id) VALUES 
        (v_gl_entry_id, v_mapping.debit_account_code, v_pv.amount, 0, v_pv.purpose, v_firm_id), -- Expense
        (v_gl_entry_id, v_mapping.credit_account_code, 0, v_pv.amount, 'AP - ' || v_pv.payee_name, v_firm_id); -- AP
    
    ELSE -- TRUST
        -- Trust Flow
        -- Dr Client Funds Control (Liability Decrease) / Cr Trust AP (Liability Increase - Pending Payment)
        -- Requires Trust Accounts in COA.
        -- For now, let's assume generic Trust Control Account codes.
        -- Client Ledger Update happens here? Prompt: "When approving: record client_ledger debit/credit"
        
        -- Update Client Ledger (Pending)
        -- Actually, strictly speaking, Client Ledger should reflect actual movement.
        -- But if we "hold" funds, we might debit it now?
        -- Prompt: "When approving: record client_ledger debit/credit"
        -- Let's Debit Client Ledger (Funds Committed).
        
        INSERT INTO client_ledger (client_id, transaction_date, reference_type, reference_id, description, debit, credit, balance, firm_id)
        VALUES (v_pv.client_id, CURRENT_DATE, 'PV-APPROVE', p_pv_id, 'Committed: ' || v_pv.purpose, v_pv.amount, 0, 0, v_firm_id);
        
        -- GL
        INSERT INTO gl_lines (gl_entry_id, account_code, debit, credit, description, firm_id) VALUES 
        (v_gl_entry_id, '2005', v_pv.amount, 0, 'Client Trust Liability (Dr)', v_firm_id), -- Liability Decrease
        (v_gl_entry_id, '2006', 0, v_pv.amount, 'Trust AP (Cr)', v_firm_id); -- Liability Increase
    END IF;

    -- 6. Update PV
    UPDATE payment_vouchers
    SET status = 'Approved', approved_by = p_user_id, approved_at = NOW(), is_amount_locked = TRUE
    WHERE id = p_pv_id;

    -- 7. Audit
    INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, user_id, firm_id)
    VALUES ('payment_vouchers', p_pv_id, 'APPROVE', 
        jsonb_build_object('status', v_pv.status), 
        jsonb_build_object('status', 'Approved', 'gl_entry', v_gl_entry_id), 
        p_user_id, v_firm_id
    );

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;


-- 3. Mark Paid (Trust + Period Check)
CREATE OR REPLACE FUNCTION public.mark_payment_voucher_paid(
    p_pv_id UUID,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_pv RECORD;
    v_firm_id UUID;
    v_user_role TEXT;
    v_gl_entry_id UUID;
    v_ap_account TEXT;
    v_bank_account TEXT;
BEGIN
    -- 1. Auth Check
    SELECT firm_id, role INTO v_firm_id, v_user_role FROM firm_users WHERE user_id = p_user_id LIMIT 1;
    IF v_firm_id IS NULL THEN RAISE EXCEPTION 'User firm not found'; END IF;
    IF v_user_role NOT IN ('Account', 'Founder') THEN RAISE EXCEPTION 'Unauthorized'; END IF;

    -- 2. Lock PV
    SELECT * INTO v_pv FROM payment_vouchers WHERE id = p_pv_id AND firm_id = v_firm_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PV not found'; END IF;
    IF v_pv.status != 'Approved' THEN RAISE EXCEPTION 'Invalid State'; END IF;

    -- 3. Check Accounting Period
    PERFORM public.check_accounting_period(CURRENT_DATE, v_firm_id);

    -- 4. GL Entry (Payment)
    INSERT INTO gl_entries (date, description, reference_type, reference_id, firm_id, created_by, account_group)
    VALUES (CURRENT_DATE, 'PV Payment: ' || v_pv.pv_no, 'PV', p_pv_id, v_firm_id, p_user_id, v_pv.fund_type)
    RETURNING id INTO v_gl_entry_id;

    IF v_pv.fund_type = 'OFFICE' THEN
        -- Find AP and Office Bank
        SELECT code INTO v_ap_account FROM chart_of_accounts WHERE type = 'Liability' AND name ILIKE '%Accounts Payable%' AND firm_id = v_firm_id LIMIT 1;
        SELECT code INTO v_bank_account FROM chart_of_accounts WHERE type = 'Asset' AND name ILIKE '%Office Bank%' AND firm_id = v_firm_id LIMIT 1;
        
        IF v_ap_account IS NULL OR v_bank_account IS NULL THEN RAISE EXCEPTION 'Accounts configuration missing'; END IF;

        INSERT INTO gl_lines (gl_entry_id, account_code, debit, credit, description, firm_id) VALUES 
        (v_gl_entry_id, v_ap_account, v_pv.amount, 0, 'Clear AP', v_firm_id),
        (v_gl_entry_id, v_bank_account, 0, v_pv.amount, 'Office Bank Payment', v_firm_id);

    ELSE -- TRUST
        -- Find Trust AP and Trust Bank
        -- Assuming specific codes for Trust
        -- Dr Trust AP (2006) / Cr Trust Bank (1002)
        
        -- Prompt: "When paying: deduct from client_ledger balance"
        -- We already debited client ledger at Approval (Committed).
        -- Or should we debit now? 
        -- If we debited at Approval, we reduced balance. Payment just clears internal Liability.
        -- Let's confirm logic.
        -- If we debited Client Ledger at Approval, the money is "gone" from client view.
        -- Payment moves money from Bank.
        -- If Trust Accounting requires Client Ledger to match Bank, then Debit Client Ledger happens at Payment?
        -- Prompt said: "When approving: record client_ledger debit/credit" AND "When paying: deduct from client_ledger balance"
        -- This implies double deduction? No.
        -- Maybe "record" means "note it", "deduct" means "finalize"?
        -- I'll assume Approval reserves it, Payment finalizes.
        -- Update Client Ledger status?
        -- Let's stick to standard GL:
        -- Payment: Dr Trust AP / Cr Trust Bank.
        
        -- Find Trust Bank
        SELECT code INTO v_bank_account FROM chart_of_accounts WHERE type = 'Asset' AND name ILIKE '%Client Bank%' AND firm_id = v_firm_id LIMIT 1;
        IF v_bank_account IS NULL THEN RAISE EXCEPTION 'Client Bank Account missing'; END IF;

        INSERT INTO gl_lines (gl_entry_id, account_code, debit, credit, description, firm_id) VALUES 
        (v_gl_entry_id, '2006', v_pv.amount, 0, 'Clear Trust AP', v_firm_id),
        (v_gl_entry_id, v_bank_account, 0, v_pv.amount, 'Trust Bank Payment', v_firm_id);
        
        -- Update Client Ledger to confirm payment?
        INSERT INTO client_ledger (client_id, transaction_date, reference_type, reference_id, description, debit, credit, balance, firm_id)
        VALUES (v_pv.client_id, CURRENT_DATE, 'PV-PAID', p_pv_id, 'Payment Released', 0, 0, 0, v_firm_id); -- Just a marker if balance reduced at Approval
    END IF;

    -- 5. Update PV
    UPDATE payment_vouchers
    SET status = 'Paid', paid_by = p_user_id, paid_at = NOW(), is_paid = TRUE
    WHERE id = p_pv_id;

    -- 6. Audit
    INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, user_id, firm_id)
    VALUES ('payment_vouchers', p_pv_id, 'MARK_PAID', 
        jsonb_build_object('status', v_pv.status), 
        jsonb_build_object('status', 'Paid', 'gl_entry', v_gl_entry_id), 
        p_user_id, v_firm_id
    );

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
