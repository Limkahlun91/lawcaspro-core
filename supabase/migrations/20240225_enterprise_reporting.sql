
-- 1. Trust Reconciliation Views (Bar Council Compliance)

-- 1.1 Client Ledger Balance View
CREATE OR REPLACE VIEW vw_client_ledger_balance AS 
SELECT 
    client_id, 
    firm_id, 
    SUM(credit - debit) AS client_balance 
FROM client_ledger 
GROUP BY client_id, firm_id;

-- 1.2 Trust Bank Balance View (Sum of GL Lines for Trust Bank Accounts)
-- Note: 'Trust Bank' is an asset, usually Debit Balance.
-- We need to identify Trust Bank accounts specifically. 
-- Assuming chart_of_accounts 'type'='Asset' and name ILIKE '%Client Bank%' as per previous logic.
-- Or better, we sum ALL GL entries under 'TRUST' account group that hit Asset accounts?
-- Let's stick to the prompt's logic: Sum ALL lines linked to 'TRUST' group entries?
-- "WHERE ge.account_group = 'TRUST'".
-- But wait, Trust Liability (Credit) is also in that group.
-- If we sum (Debit - Credit) for the whole group, it should be ZERO (Double Entry).
-- The prompt query: "SUM(debit - credit) AS bank_balance ... WHERE ge.account_group = 'TRUST'".
-- If this sums ALL accounts (Asset + Liability), result is 0.
-- We must filter for BANK accounts only.
-- Correct logic: Sum GL Lines where Account Code is 'Client Bank'.
-- Let's refine the view to filter by Account Type = 'Asset' AND Account Group = 'TRUST'.
-- However, gl_lines don't have account group, gl_entries do.
CREATE OR REPLACE VIEW vw_trust_bank_balance AS 
SELECT 
    ge.firm_id, 
    SUM(gl.debit - gl.credit) AS bank_balance 
FROM gl_lines gl 
JOIN gl_entries ge ON gl.gl_entry_id = ge.id 
JOIN chart_of_accounts coa ON gl.account_code = coa.code AND (coa.firm_id = ge.firm_id OR coa.firm_id IS NULL)
WHERE ge.account_group = 'TRUST' 
AND coa.type = 'Asset' -- Only Assets (Bank)
GROUP BY ge.firm_id;

-- 1.3 Reconciliation View
CREATE OR REPLACE VIEW vw_trust_reconciliation AS 
SELECT 
    tb.firm_id, 
    COALESCE(tb.bank_balance, 0) AS bank_balance, 
    COALESCE(SUM(cl.client_balance), 0) AS total_client_balance, 
    COALESCE(tb.bank_balance, 0) - COALESCE(SUM(cl.client_balance), 0) AS difference 
FROM vw_trust_bank_balance tb 
FULL OUTER JOIN vw_client_ledger_balance cl -- Full Outer to catch mismatches
    ON tb.firm_id = cl.firm_id 
GROUP BY tb.firm_id, tb.bank_balance;


-- 2. Client Statement (Running Balance)
CREATE OR REPLACE VIEW vw_client_statement AS 
SELECT 
    cl.id,
    cl.client_id,
    cl.transaction_date,
    cl.reference_type,
    cl.reference_id,
    cl.description,
    cl.debit,
    cl.credit,
    cl.firm_id,
    cl.created_at,
    SUM(cl.credit - cl.debit) 
    OVER (PARTITION BY cl.client_id, cl.firm_id ORDER BY cl.transaction_date, cl.created_at) 
    AS running_balance 
FROM client_ledger cl;


-- 3. Trial Balance (Office / Trust Split)
CREATE OR REPLACE VIEW vw_trial_balance AS 
SELECT 
    ge.account_group, 
    ge.firm_id,
    gl.account_code, 
    coa.name AS account_name,
    SUM(gl.debit) AS total_debit, 
    SUM(gl.credit) AS total_credit, 
    SUM(gl.debit - gl.credit) AS net_balance 
FROM gl_lines gl 
JOIN gl_entries ge ON gl.gl_entry_id = ge.id 
LEFT JOIN chart_of_accounts coa ON gl.account_code = coa.code AND (coa.firm_id = ge.firm_id OR coa.firm_id IS NULL)
GROUP BY ge.account_group, ge.firm_id, gl.account_code, coa.name;


-- 4. Period Close Governance (Founder Only RPC)
CREATE OR REPLACE FUNCTION public.close_accounting_period(
    p_year INT,
    p_month INT,
    p_user_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_role TEXT;
    v_firm_id UUID;
BEGIN
    -- 1. Auth Check
    SELECT role, firm_id INTO v_role, v_firm_id 
    FROM firm_users 
    WHERE user_id = p_user_id;

    IF v_role IS NULL THEN
        RAISE EXCEPTION 'User not found in firm';
    END IF;

    IF v_role <> 'Founder' THEN
        RAISE EXCEPTION 'Unauthorized: Only Founder can close period';
    END IF;

    -- 2. Upsert Period (Create if not exists, then close)
    INSERT INTO accounting_periods (year, month, is_closed, closed_at, closed_by, firm_id)
    VALUES (p_year, p_month, TRUE, NOW(), p_user_id, v_firm_id)
    ON CONFLICT (firm_id, year, month) 
    DO UPDATE SET 
        is_closed = TRUE,
        closed_at = NOW(),
        closed_by = p_user_id;
        
    -- 3. Audit
    INSERT INTO audit_logs (table_name, record_id, action, new_data, user_id, firm_id)
    VALUES ('accounting_periods', NULL, 'CLOSE_PERIOD', 
        jsonb_build_object('year', p_year, 'month', p_month), 
        p_user_id, v_firm_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
