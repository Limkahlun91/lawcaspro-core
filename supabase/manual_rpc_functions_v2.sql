
-- 1. Add Unique Constraint on PV No
ALTER TABLE payment_vouchers DROP CONSTRAINT IF EXISTS payment_vouchers_pv_no_key;
ALTER TABLE payment_vouchers ADD CONSTRAINT payment_vouchers_pv_no_key UNIQUE (pv_no, firm_id);

-- 2. PV Sequence
CREATE SEQUENCE IF NOT EXISTS pv_seq START 1;

-- 3. Create PV RPC (SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.create_payment_voucher(
    p_payee_name TEXT,
    p_type TEXT,
    p_amount NUMERIC,
    p_purpose TEXT,
    p_user_id UUID
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

    -- 2. Generate PV No
    v_year := to_char(CURRENT_DATE, 'YYYY');
    v_seq := nextval('pv_seq');
    v_pv_no := 'PV-' || v_year || '-' || lpad(v_seq::text, 4, '0');

    -- 3. Insert PV
    INSERT INTO payment_vouchers (
        pv_no, date, payee_name, type, amount, purpose, status, created_by, firm_id
    ) VALUES (
        v_pv_no, CURRENT_DATE, p_payee_name, p_type, p_amount, p_purpose, 'Draft', p_user_id, v_firm_id
    ) RETURNING id INTO v_pv_id;

    -- 4. Audit
    INSERT INTO audit_logs (table_name, record_id, action, new_data, user_id, firm_id)
    VALUES ('payment_vouchers', v_pv_id, 'CREATE', jsonb_build_object('pv_no', v_pv_no), p_user_id, v_firm_id);

    RETURN jsonb_build_object('success', true, 'id', v_pv_id, 'pv_no', v_pv_no);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- 4. Approve PV RPC (SECURITY INVOKER)
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
BEGIN
    -- 1. Get User Firm & Role
    SELECT firm_id, role INTO v_firm_id, v_user_role FROM firm_users WHERE user_id = p_user_id LIMIT 1;
    
    IF v_firm_id IS NULL THEN RAISE EXCEPTION 'User does not belong to any firm'; END IF;
    IF v_user_role NOT IN ('Partner', 'Founder') THEN RAISE EXCEPTION 'Unauthorized: Only Partner/Founder can approve'; END IF;

    -- 2. Lock & Get PV
    SELECT * INTO v_pv FROM payment_vouchers WHERE id = p_pv_id AND firm_id = v_firm_id FOR UPDATE;
    
    IF NOT FOUND THEN RAISE EXCEPTION 'Payment Voucher not found'; END IF;
    IF v_pv.status != 'Categorized' THEN RAISE EXCEPTION 'Invalid State: PV must be Categorized first'; END IF;

    -- 3. Get GL Mapping (Use 'category' column as per schema, assuming 'assigned_category' meant logical intent)
    -- Schema has 'category' column. Prompt asked for 'assigned_category', but schema only has 'category'.
    -- I will stick to 'category' column but ensure it's validated.
    SELECT * INTO v_mapping FROM category_gl_mapping 
    WHERE category_name = v_pv.category AND (firm_id = v_firm_id OR firm_id IS NULL) LIMIT 1;

    IF NOT FOUND THEN RAISE EXCEPTION 'GL Mapping not found for category: %', v_pv.category; END IF;

    -- 4. Create GL Entry
    INSERT INTO gl_entries (date, description, reference_type, reference_id, firm_id, created_by)
    VALUES (CURRENT_DATE, 'PV Accrual: ' || v_pv.pv_no || ' - ' || v_pv.payee_name, 'PV', p_pv_id, v_firm_id, p_user_id)
    RETURNING id INTO v_gl_entry_id;

    -- 5. GL Lines (Dr Expense / Cr AP)
    INSERT INTO gl_lines (gl_entry_id, account_code, debit, credit, description, firm_id)
    VALUES 
    (v_gl_entry_id, v_mapping.debit_account_code, v_pv.amount, 0, v_pv.purpose, v_firm_id),
    (v_gl_entry_id, v_mapping.credit_account_code, 0, v_pv.amount, 'AP - ' || v_pv.payee_name, v_firm_id);

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

    RETURN jsonb_build_object('success', true, 'gl_entry_id', v_gl_entry_id);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- 5. Mark Paid RPC (SECURITY INVOKER + Dynamic Accounts)
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
    -- 1. Get User Firm & Role
    SELECT firm_id, role INTO v_firm_id, v_user_role FROM firm_users WHERE user_id = p_user_id LIMIT 1;
    
    IF v_firm_id IS NULL THEN RAISE EXCEPTION 'User does not belong to any firm'; END IF;
    IF v_user_role NOT IN ('Account', 'Founder') THEN RAISE EXCEPTION 'Unauthorized: Only Account/Founder can pay'; END IF;

    -- 2. Lock & Get PV
    SELECT * INTO v_pv FROM payment_vouchers WHERE id = p_pv_id AND firm_id = v_firm_id FOR UPDATE;
    
    IF NOT FOUND THEN RAISE EXCEPTION 'Payment Voucher not found'; END IF;
    IF v_pv.status != 'Approved' THEN RAISE EXCEPTION 'Invalid State: PV must be Approved first'; END IF;

    -- 3. Fetch Dynamic Account Codes
    -- AP Account (Liability)
    SELECT code INTO v_ap_account FROM chart_of_accounts 
    WHERE type = 'Liability' AND name ILIKE '%Accounts Payable%' AND (firm_id = v_firm_id OR firm_id IS NULL) LIMIT 1;
    
    -- Bank Account (Asset)
    SELECT code INTO v_bank_account FROM chart_of_accounts 
    WHERE type = 'Asset' AND name ILIKE '%Bank%' AND (firm_id = v_firm_id OR firm_id IS NULL) LIMIT 1;

    IF v_ap_account IS NULL OR v_bank_account IS NULL THEN
        RAISE EXCEPTION 'Default AP or Bank account not configured in Chart of Accounts';
    END IF;

    -- 4. Create GL Entry
    INSERT INTO gl_entries (date, description, reference_type, reference_id, firm_id, created_by)
    VALUES (CURRENT_DATE, 'PV Payment: ' || v_pv.pv_no, 'PV', p_pv_id, v_firm_id, p_user_id)
    RETURNING id INTO v_gl_entry_id;

    -- 5. GL Lines (Dr AP / Cr Bank)
    INSERT INTO gl_lines (gl_entry_id, account_code, debit, credit, description, firm_id)
    VALUES 
    (v_gl_entry_id, v_ap_account, v_pv.amount, 0, 'Clear AP - ' || v_pv.pv_no, v_firm_id),
    (v_gl_entry_id, v_bank_account, 0, v_pv.amount, 'Payment to ' || v_pv.payee_name, v_firm_id);

    -- 6. Update PV
    UPDATE payment_vouchers
    SET status = 'Paid', paid_by = p_user_id, paid_at = NOW(), is_paid = TRUE
    WHERE id = p_pv_id;

    -- 7. Audit
    INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, user_id, firm_id)
    VALUES ('payment_vouchers', p_pv_id, 'MARK_PAID', 
        jsonb_build_object('status', v_pv.status), 
        jsonb_build_object('status', 'Paid', 'gl_entry', v_gl_entry_id), 
        p_user_id, v_firm_id
    );

    RETURN jsonb_build_object('success', true, 'gl_entry_id', v_gl_entry_id);
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;
