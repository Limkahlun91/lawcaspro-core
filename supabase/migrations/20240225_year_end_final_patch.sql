
CREATE OR REPLACE FUNCTION public.execute_year_end_closing(
    p_year INT,
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_firm_id UUID;
    v_user_role TEXT;
    v_retained_earnings_code TEXT;
    v_period_count INT;
    v_gl_entry_id UUID;
    v_total_revenue NUMERIC := 0;
    v_total_expense NUMERIC := 0;
    v_net_profit NUMERIC := 0;
    v_acc RECORD;
    v_closing_date DATE;
    v_check_debit NUMERIC;
    v_check_credit NUMERIC;
BEGIN
    -- 1. Auth Check
    SELECT firm_id, role INTO v_firm_id, v_user_role FROM firm_users WHERE user_id = p_user_id LIMIT 1;
    IF v_firm_id IS NULL THEN RAISE EXCEPTION 'User firm not found'; END IF;
    IF v_user_role <> 'Founder' THEN RAISE EXCEPTION 'Unauthorized: Only Founder can perform Year End Closing'; END IF;

    -- 2. Lock Year End Table (Prevent Race Conditions)
    -- If row doesn't exist (first close), this might not lock anything, but UNIQUE constraint handles insert race.
    -- Better to lock FIRM row? Or just rely on Insert Unique constraint later.
    -- Let's rely on UNIQUE constraint for concurrency safety.
    
    IF EXISTS (SELECT 1 FROM year_end_closings WHERE firm_id = v_firm_id AND year = p_year) THEN
        RAISE EXCEPTION 'Year % is already closed', p_year;
    END IF;

    -- 3. Strict 12-Month Period Validation (Distinct Months)
    SELECT COUNT(DISTINCT month) INTO v_period_count 
    FROM accounting_periods 
    WHERE firm_id = v_firm_id AND year = p_year AND is_closed = TRUE;

    IF v_period_count != 12 THEN
        RAISE EXCEPTION 'Cannot close year: Exactly 12 distinct closed accounting periods required. Found: %', v_period_count;
    END IF;

    -- 4. Find Retained Earnings Account
    SELECT code INTO v_retained_earnings_code 
    FROM chart_of_accounts 
    WHERE type = 'Equity' 
    AND name ILIKE '%Retained Earnings%' 
    AND (firm_id = v_firm_id OR firm_id IS NULL) 
    LIMIT 1;

    IF v_retained_earnings_code IS NULL THEN
        RAISE EXCEPTION 'Retained Earnings account not found in COA';
    END IF;

    -- 5. Lock GL Entries for Calculation
    PERFORM 1 FROM gl_entries 
    WHERE firm_id = v_firm_id 
    AND EXTRACT(YEAR FROM date) = p_year
    FOR UPDATE;

    -- 6. Calculate P&L
    SELECT COALESCE(SUM(gl.credit - gl.debit), 0) INTO v_total_revenue
    FROM gl_lines gl
    JOIN gl_entries ge ON gl.gl_entry_id = ge.id
    JOIN chart_of_accounts coa ON gl.account_code = coa.code AND (coa.firm_id = ge.firm_id OR coa.firm_id IS NULL)
    WHERE ge.firm_id = v_firm_id 
    AND EXTRACT(YEAR FROM ge.date) = p_year
    AND ge.account_group = 'OFFICE'
    AND coa.type = 'Revenue';

    SELECT COALESCE(SUM(gl.debit - gl.credit), 0) INTO v_total_expense
    FROM gl_lines gl
    JOIN gl_entries ge ON gl.gl_entry_id = ge.id
    JOIN chart_of_accounts coa ON gl.account_code = coa.code AND (coa.firm_id = ge.firm_id OR coa.firm_id IS NULL)
    WHERE ge.firm_id = v_firm_id 
    AND EXTRACT(YEAR FROM ge.date) = p_year
    AND ge.account_group = 'OFFICE'
    AND coa.type = 'Expense';

    v_net_profit := v_total_revenue - v_total_expense;
    v_closing_date := (p_year || '-12-31')::DATE;

    -- 7. Create Closing Journal Entry
    INSERT INTO gl_entries (date, description, reference_type, reference_id, firm_id, created_by, account_group)
    VALUES (v_closing_date, 'Year End Closing Entry ' || p_year, 'YEAR_END', NULL, v_firm_id, p_user_id, 'OFFICE')
    RETURNING id INTO v_gl_entry_id;

    -- 8. Close Revenue Accounts
    FOR v_acc IN 
        SELECT gl.account_code, SUM(gl.credit - gl.debit) as balance
        FROM gl_lines gl
        JOIN gl_entries ge ON gl.gl_entry_id = ge.id
        JOIN chart_of_accounts coa ON gl.account_code = coa.code AND (coa.firm_id = ge.firm_id OR coa.firm_id IS NULL)
        WHERE ge.firm_id = v_firm_id 
        AND EXTRACT(YEAR FROM ge.date) = p_year
        AND ge.account_group = 'OFFICE'
        AND coa.type = 'Revenue'
        GROUP BY gl.account_code
    LOOP
        IF v_acc.balance <> 0 THEN
            INSERT INTO gl_lines (gl_entry_id, account_code, debit, credit, description, firm_id)
            VALUES (v_gl_entry_id, v_acc.account_code, v_acc.balance, 0, 'Close Revenue to RE', v_firm_id);
        END IF;
    END LOOP;

    -- 9. Close Expense Accounts
    FOR v_acc IN 
        SELECT gl.account_code, SUM(gl.debit - gl.credit) as balance
        FROM gl_lines gl
        JOIN gl_entries ge ON gl.gl_entry_id = ge.id
        JOIN chart_of_accounts coa ON gl.account_code = coa.code AND (coa.firm_id = ge.firm_id OR coa.firm_id IS NULL)
        WHERE ge.firm_id = v_firm_id 
        AND EXTRACT(YEAR FROM ge.date) = p_year
        AND ge.account_group = 'OFFICE'
        AND coa.type = 'Expense'
        GROUP BY gl.account_code
    LOOP
        IF v_acc.balance <> 0 THEN
            INSERT INTO gl_lines (gl_entry_id, account_code, debit, credit, description, firm_id)
            VALUES (v_gl_entry_id, v_acc.account_code, 0, v_acc.balance, 'Close Expense to RE', v_firm_id);
        END IF;
    END LOOP;

    -- 10. Post Net Profit/Loss to Retained Earnings
    IF v_net_profit >= 0 THEN
        INSERT INTO gl_lines (gl_entry_id, account_code, debit, credit, description, firm_id)
        VALUES (v_gl_entry_id, v_retained_earnings_code, 0, v_net_profit, 'Net Profit Transfer', v_firm_id);
    ELSE
        INSERT INTO gl_lines (gl_entry_id, account_code, debit, credit, description, firm_id)
        VALUES (v_gl_entry_id, v_retained_earnings_code, ABS(v_net_profit), 0, 'Net Loss Transfer', v_firm_id);
    END IF;

    -- 11. Balance Integrity Check
    SELECT SUM(debit), SUM(credit) INTO v_check_debit, v_check_credit
    FROM gl_lines WHERE gl_entry_id = v_gl_entry_id;
    
    IF v_check_debit != v_check_credit THEN
        RAISE EXCEPTION 'FATAL: Closing Entry Imbalance! Debit: %, Credit: %', v_check_debit, v_check_credit;
    END IF;

    -- 12. Lock the Year
    INSERT INTO year_end_closings (firm_id, year, closed_by)
    VALUES (v_firm_id, p_year, p_user_id);

    -- 13. Audit
    INSERT INTO audit_logs (table_name, record_id, action, new_data, user_id, firm_id)
    VALUES ('year_end_closings', NULL, 'YEAR_CLOSE', 
        jsonb_build_object('year', p_year, 'net_profit', v_net_profit, 'gl_entry', v_gl_entry_id), 
        p_user_id, v_firm_id
    );

    RETURN jsonb_build_object('success', true, 'net_profit', v_net_profit);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
