
-- 1. PV Sequence
CREATE SEQUENCE IF NOT EXISTS pv_seq START 1;

-- 2. Approve PV RPC (Atomic Transaction)
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
    
    IF v_firm_id IS NULL THEN
        RAISE EXCEPTION 'User does not belong to any firm';
    END IF;

    IF v_user_role NOT IN ('Partner', 'Founder') THEN
        RAISE EXCEPTION 'Unauthorized: Only Partner/Founder can approve';
    END IF;

    -- 2. Lock & Get PV
    SELECT * INTO v_pv FROM payment_vouchers WHERE id = p_pv_id AND firm_id = v_firm_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment Voucher not found';
    END IF;

    IF v_pv.status != 'Categorized' THEN
        RAISE EXCEPTION 'Invalid State: PV must be Categorized first (Current: %)', v_pv.status;
    END IF;

    -- 3. Get GL Mapping
    SELECT * INTO v_mapping FROM category_gl_mapping 
    WHERE category_name = v_pv.category AND (firm_id = v_firm_id OR firm_id IS NULL) LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'GL Mapping not found for category: %', v_pv.category;
    END IF;

    -- 4. Create GL Entry (Header)
    INSERT INTO gl_entries (date, description, reference_type, reference_id, firm_id, created_by)
    VALUES (CURRENT_DATE, 'PV Accrual: ' || v_pv.pv_no || ' - ' || v_pv.payee_name, 'PV', p_pv_id, v_firm_id, p_user_id)
    RETURNING id INTO v_gl_entry_id;

    -- 5. Create GL Lines (Debit Expense)
    INSERT INTO gl_lines (gl_entry_id, account_code, debit, credit, description, firm_id)
    VALUES (v_gl_entry_id, v_mapping.debit_account_code, v_pv.amount, 0, v_pv.purpose, v_firm_id);

    -- 6. Create GL Lines (Credit AP)
    INSERT INTO gl_lines (gl_entry_id, account_code, debit, credit, description, firm_id)
    VALUES (v_gl_entry_id, v_mapping.credit_account_code, 0, v_pv.amount, 'AP - ' || v_pv.payee_name, v_firm_id);

    -- 7. Update PV Status
    UPDATE payment_vouchers
    SET status = 'Approved',
        approved_by = p_user_id,
        approved_at = NOW(),
        is_amount_locked = TRUE
    WHERE id = p_pv_id;

    -- 8. Audit Log
    INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, user_id, firm_id)
    VALUES ('payment_vouchers', p_pv_id, 'APPROVE', 
        jsonb_build_object('status', v_pv.status), 
        jsonb_build_object('status', 'Approved', 'gl_entry', v_gl_entry_id), 
        p_user_id, v_firm_id
    );

    RETURN jsonb_build_object('success', true, 'gl_entry_id', v_gl_entry_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Mark Paid RPC (Atomic Transaction)
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
BEGIN
    -- 1. Get User Firm & Role
    SELECT firm_id, role INTO v_firm_id, v_user_role FROM firm_users WHERE user_id = p_user_id LIMIT 1;
    
    IF v_firm_id IS NULL THEN
        RAISE EXCEPTION 'User does not belong to any firm';
    END IF;

    IF v_user_role NOT IN ('Account', 'Founder') THEN
        RAISE EXCEPTION 'Unauthorized: Only Account/Founder can pay';
    END IF;

    -- 2. Lock & Get PV
    SELECT * INTO v_pv FROM payment_vouchers WHERE id = p_pv_id AND firm_id = v_firm_id FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Payment Voucher not found';
    END IF;

    IF v_pv.status != 'Approved' THEN
        RAISE EXCEPTION 'Invalid State: PV must be Approved first (Current: %)', v_pv.status;
    END IF;

    -- 3. Create GL Entry (Payment)
    INSERT INTO gl_entries (date, description, reference_type, reference_id, firm_id, created_by)
    VALUES (CURRENT_DATE, 'PV Payment: ' || v_pv.pv_no, 'PV', p_pv_id, v_firm_id, p_user_id)
    RETURNING id INTO v_gl_entry_id;

    -- 4. Create GL Lines (Debit AP)
    INSERT INTO gl_lines (gl_entry_id, account_code, debit, credit, description, firm_id)
    VALUES (v_gl_entry_id, '2000', v_pv.amount, 0, 'Clear AP - ' || v_pv.pv_no, v_firm_id);

    -- 5. Create GL Lines (Credit Bank)
    -- TODO: Pass Bank Code dynamically. Defaulting to 1000.
    INSERT INTO gl_lines (gl_entry_id, account_code, debit, credit, description, firm_id)
    VALUES (v_gl_entry_id, '1000', 0, v_pv.amount, 'Payment to ' || v_pv.payee_name, v_firm_id);

    -- 6. Update PV Status
    UPDATE payment_vouchers
    SET status = 'Paid',
        paid_by = p_user_id,
        paid_at = NOW(),
        is_paid = TRUE
    WHERE id = p_pv_id;

    -- 7. Audit Log
    INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, user_id, firm_id)
    VALUES ('payment_vouchers', p_pv_id, 'MARK_PAID', 
        jsonb_build_object('status', v_pv.status), 
        jsonb_build_object('status', 'Paid', 'gl_entry', v_gl_entry_id), 
        p_user_id, v_firm_id
    );

    RETURN jsonb_build_object('success', true, 'gl_entry_id', v_gl_entry_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create PV RPC (Atomic with Sequence)
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

    -- 2. Generate PV No (PV-YYYY-001)
    v_year := to_char(CURRENT_DATE, 'YYYY');
    v_seq := nextval('pv_seq'); -- Global sequence for now
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
