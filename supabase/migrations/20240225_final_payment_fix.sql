
-- Final Correction: Enforce CURRENT_DATE for Payment Execution
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
    v_trust_liability TEXT;
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

    -- 3. Check Accounting Period (Using CURRENT_DATE for Payment Execution)
    PERFORM public.check_accounting_period(CURRENT_DATE, v_firm_id);

    -- 4. GL Entry (Payment - CURRENT_DATE)
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
        
        -- 1. Lock Client Ledger Rows
        PERFORM 1 FROM client_ledger WHERE client_id = v_pv.client_id AND firm_id = v_firm_id FOR UPDATE;
        
        SELECT COALESCE(SUM(credit - debit), 0) INTO v_client_balance 
        FROM client_ledger 
        WHERE client_id = v_pv.client_id AND firm_id = v_firm_id;
        
        IF v_client_balance < v_pv.amount THEN
            RAISE EXCEPTION 'Insufficient Trust Funds. Balance: %, Required: %', v_client_balance, v_pv.amount;
        END IF;

        -- 2. Find Trust Liability and Trust Bank
        SELECT code INTO v_trust_liability FROM chart_of_accounts WHERE type = 'Liability' AND name ILIKE '%Client Trust Funds%' AND firm_id = v_firm_id LIMIT 1;
        SELECT code INTO v_trust_bank FROM chart_of_accounts WHERE type = 'Asset' AND name ILIKE '%Client Bank%' AND firm_id = v_firm_id LIMIT 1;

        IF v_trust_liability IS NULL OR v_trust_bank IS NULL THEN RAISE EXCEPTION 'Trust Accounts configuration missing'; END IF;

        -- 3. GL Posting
        INSERT INTO gl_lines (gl_entry_id, account_code, debit, credit, description, firm_id) VALUES 
        (v_gl_entry_id, v_trust_liability, v_pv.amount, 0, 'Trust Liability Decrease', v_firm_id),
        (v_gl_entry_id, v_trust_bank, 0, v_pv.amount, 'Trust Bank Payment', v_firm_id);
        
        -- 4. Update Client Ledger (CURRENT_DATE)
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
