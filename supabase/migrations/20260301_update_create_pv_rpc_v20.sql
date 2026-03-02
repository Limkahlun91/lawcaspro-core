
-- Update create_payment_voucher to accept remarks and payment_status
CREATE OR REPLACE FUNCTION public.create_payment_voucher(
    p_payee_name TEXT,
    p_type TEXT,
    p_amount NUMERIC,
    p_purpose TEXT,
    p_user_id UUID,
    p_remarks TEXT DEFAULT NULL,
    p_payment_status TEXT DEFAULT 'advance'
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
        pv_no, date, payee_name, type, amount, purpose, status, created_by, firm_id, remarks, payment_status
    ) VALUES (
        v_pv_no, CURRENT_DATE, p_payee_name, p_type, p_amount, p_purpose, 'Draft', p_user_id, v_firm_id, p_remarks, p_payment_status
    ) RETURNING id INTO v_pv_id;

    -- 4. Audit
    INSERT INTO audit_logs (table_name, record_id, action, new_data, user_id, firm_id)
    VALUES ('payment_vouchers', v_pv_id, 'CREATE', jsonb_build_object('pv_no', v_pv_no), p_user_id, v_firm_id);

    RETURN jsonb_build_object('success', true, 'id', v_pv_id, 'pv_no', v_pv_no);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
