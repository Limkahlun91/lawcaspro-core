
-- Drop old view first to allow column redefinition
DROP VIEW IF EXISTS vw_trust_reconciliation;

-- 1. Hardened Reconciliation View (Anchored to Firms)
CREATE OR REPLACE VIEW vw_trust_reconciliation AS 
SELECT 
    f.id AS firm_id,
    f.name AS firm_name,
    COALESCE(tb.bank_balance, 0) AS bank_balance, 
    COALESCE(cl.client_balance, 0) AS total_client_balance, 
    COALESCE(tb.bank_balance, 0) - COALESCE(cl.client_balance, 0) AS difference 
FROM firms f
LEFT JOIN (
    SELECT 
        ge.firm_id, 
        SUM(gl.debit - gl.credit) AS bank_balance 
    FROM gl_lines gl 
    JOIN gl_entries ge ON gl.gl_entry_id = ge.id 
    JOIN chart_of_accounts coa ON gl.account_code = coa.code AND (coa.firm_id = ge.firm_id OR coa.firm_id IS NULL)
    WHERE ge.account_group = 'TRUST' 
    AND coa.type = 'Asset'
    GROUP BY ge.firm_id
) tb ON f.id = tb.firm_id
LEFT JOIN (
    SELECT 
        firm_id, 
        SUM(credit - debit) AS client_balance 
    FROM client_ledger 
    GROUP BY firm_id
) cl ON f.id = cl.firm_id;


-- 2. Prevent Period Reopen Trigger
CREATE OR REPLACE FUNCTION public.prevent_period_reopen()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_closed = TRUE AND NEW.is_closed = FALSE THEN
        RAISE EXCEPTION 'Security Violation: Closed Accounting Period cannot be reopened.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_prevent_reopen ON accounting_periods;
CREATE TRIGGER trigger_prevent_reopen
    BEFORE UPDATE ON accounting_periods
    FOR EACH ROW EXECUTE FUNCTION public.prevent_period_reopen();
