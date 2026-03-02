
-- 1. Client Ledger (Clean Rebuild)
DROP TABLE IF EXISTS client_ledger CASCADE;
CREATE TABLE client_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL, -- Link to 'cases' purchaser or separate client table
    transaction_date DATE DEFAULT CURRENT_DATE,
    reference_type TEXT, -- PV, INV, RECEIPT
    reference_id UUID,
    description TEXT,
    debit NUMERIC DEFAULT 0,
    credit NUMERIC DEFAULT 0,
    firm_id UUID REFERENCES firms(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE client_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Client Ledger Access" ON client_ledger FOR ALL USING (firm_id = public.get_user_firm_id());

-- 2. Accounting Period Check (Helper)
CREATE OR REPLACE FUNCTION public.check_accounting_period(p_date DATE, p_firm_id UUID)
RETURNS VOID AS $$
DECLARE
    v_year INT;
    v_month INT;
    v_closed BOOLEAN;
BEGIN
    v_year := EXTRACT(YEAR FROM p_date);
    v_month := EXTRACT(MONTH FROM p_date);
    
    -- Check if Period Exists
    SELECT is_closed INTO v_closed 
    FROM accounting_periods 
    WHERE firm_id = p_firm_id AND year = v_year AND month = v_month;
    
    IF NOT FOUND THEN
        -- If no period defined, assume open or require explicit creation?
        -- Auditor-grade usually requires explicit period management.
        -- But for UX, maybe auto-create open period? 
        -- Let's stick to strict: If not found, assume OPEN (or maybe warning).
        -- Prompt says: "Enforce accounting period existence".
        RAISE EXCEPTION 'Accounting Period not defined for %-%', v_year, v_month;
    END IF;

    IF v_closed THEN
        RAISE EXCEPTION 'Accounting Period Closed for %-%', v_year, v_month;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Approve PV (Auditor Grade - Accrual Only)
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

    -- 4. GL Posting (Accrual)
    INSERT INTO gl_entries (date, description, reference_type, reference_id, firm_id, created_by, account_group)
    VALUES (CURRENT_DATE, 'PV Accrual (' || v_pv.fund_type || '): ' || v_pv.pv_no, 'PV', p_pv_id, v_firm_id, p_user_id, v_pv.fund_type)
    RETURNING id INTO v_gl_entry_id;

    IF v_pv.fund_type = 'OFFICE' THEN
        -- Normal Flow: Dr Expense / Cr AP
        SELECT * INTO v_mapping FROM category_gl_mapping WHERE category_name = v_pv.category AND firm_id = v_firm_id LIMIT 1;
        IF NOT FOUND THEN RAISE EXCEPTION 'GL Mapping not found'; END IF;

        INSERT INTO gl_lines (gl_entry_id, account_code, debit, credit, description, firm_id) VALUES 
        (v_gl_entry_id, v_mapping.debit_account_code, v_pv.amount, 0, v_pv.purpose, v_firm_id), -- Expense
        (v_gl_entry_id, v_mapping.credit_account_code, 0, v_pv.amount, 'AP - ' || v_pv.payee_name, v_firm_id); -- AP
    
    ELSE -- TRUST
        -- Trust Flow: Approval establishes obligation but no cash movement yet.
        -- Dr Trust Liability Control / Cr Trust AP
        -- Requires dynamic lookup of Trust Control Account
        DECLARE
            v_trust_liability TEXT;
            v_trust_ap TEXT;
        BEGIN
            SELECT code INTO v_trust_liability FROM chart_of_accounts WHERE type = 'Liability' AND name ILIKE '%Client Trust Funds%' AND firm_id = v_firm_id LIMIT 1;
            SELECT code INTO v_trust_ap FROM chart_of_accounts WHERE type = 'Liability' AND name ILIKE '%Trust Accounts Payable%' AND firm_id = v_firm_id LIMIT 1;
            
            IF v_trust_liability IS NULL OR v_trust_ap IS NULL THEN RAISE EXCEPTION 'Trust Accounts missing in COA'; END IF;

            INSERT INTO gl_lines (gl_entry_id, account_code, debit, credit, description, firm_id) VALUES 
            (v_gl_entry_id, v_trust_liability, v_pv.amount, 0, 'Trust Liability Decrease (Pending)', v_firm_id),
            (v_gl_entry_id, v_trust_ap, 0, v_pv.amount, 'Trust AP (Pending)', v_firm_id);
        END;
    END IF;

    -- 5. Update PV
    UPDATE payment_vouchers
    SET status = 'Approved', approved_by = p_user_id, approved_at = NOW(), is_amount_locked = TRUE
    WHERE id = p_pv_id;

    -- 6. Audit
    INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, user_id, firm_id)
    VALUES ('payment_vouchers', p_pv_id, 'APPROVE', 
        jsonb_build_object('status', v_pv.status), 
        jsonb_build_object('status', 'Approved', 'gl_entry', v_gl_entry_id), 
        p_user_id, v_firm_id
    );

    RETURN jsonb_build_object('success', true, 'gl_entry_id', v_gl_entry_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Mark Paid (Auditor Grade - Payment & Trust Ledger Update)
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
    v_trust_ap TEXT;
    v_trust_bank TEXT;
    v_client_balance NUMERIC;
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
        
        IF v_ap_account IS NULL OR v_bank_account IS NULL THEN RAISE EXCEPTION 'Office Accounts configuration missing'; END IF;

        INSERT INTO gl_lines (gl_entry_id, account_code, debit, credit, description, firm_id) VALUES 
        (v_gl_entry_id, v_ap_account, v_pv.amount, 0, 'Clear AP', v_firm_id),
        (v_gl_entry_id, v_bank_account, 0, v_pv.amount, 'Office Bank Payment', v_firm_id);

    ELSE -- TRUST
        -- Trust Flow: Payment Stage
        
        -- 1. Verify Funds (Client Ledger Check)
        -- Sum of all credits - sum of all debits
        SELECT COALESCE(SUM(credit - debit), 0) INTO v_client_balance FROM client_ledger WHERE client_id = v_pv.client_id AND firm_id = v_firm_id;
        
        IF v_client_balance < v_pv.amount THEN
            RAISE EXCEPTION 'Insufficient Trust Funds. Balance: %, Required: %', v_client_balance, v_pv.amount;
        END IF;

        -- 2. Find Trust AP and Trust Bank
        SELECT code INTO v_trust_ap FROM chart_of_accounts WHERE type = 'Liability' AND name ILIKE '%Trust Accounts Payable%' AND firm_id = v_firm_id LIMIT 1;
        SELECT code INTO v_trust_bank FROM chart_of_accounts WHERE type = 'Asset' AND name ILIKE '%Client Bank%' AND firm_id = v_firm_id LIMIT 1;

        IF v_trust_ap IS NULL OR v_trust_bank IS NULL THEN RAISE EXCEPTION 'Trust Accounts configuration missing'; END IF;

        -- 3. GL Posting: Dr Trust AP / Cr Trust Bank
        INSERT INTO gl_lines (gl_entry_id, account_code, debit, credit, description, firm_id) VALUES 
        (v_gl_entry_id, v_trust_ap, v_pv.amount, 0, 'Clear Trust AP', v_firm_id),
        (v_gl_entry_id, v_trust_bank, 0, v_pv.amount, 'Trust Bank Payment', v_firm_id);
        
        -- 4. Update Client Ledger (Debit - Money Out)
        INSERT INTO client_ledger (client_id, transaction_date, reference_type, reference_id, description, debit, credit, firm_id)
        VALUES (v_pv.client_id, CURRENT_DATE, 'PV-PAID', p_pv_id, 'Trust Payment Released: ' || v_pv.payee_name, v_pv.amount, 0, v_firm_id);
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

    RETURN jsonb_build_object('success', true, 'gl_entry_id', v_gl_entry_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
