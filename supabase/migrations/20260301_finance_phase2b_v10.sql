-- MIGRATION v10: FINANCE PHASE 2B
-- Focus: AR Aging, Trial Balance, LHDN Cancel, Ledger Views

-- 1️⃣ LHDN Cancel Flow Support
ALTER TABLE financial_documents ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE financial_documents ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE financial_documents ADD COLUMN IF NOT EXISTS cancellation_uuid TEXT; -- LHDN UUID for cancel req

-- 2️⃣ Accounting Reports Views (Efficient Reporting)

-- Trial Balance View
CREATE OR REPLACE VIEW view_trial_balance AS
SELECT 
    j.firm_id,
    jl.account_code,
    SUM(jl.debit) as total_debit,
    SUM(jl.credit) as total_credit,
    SUM(jl.debit - jl.credit) as net_balance
FROM journal_entry_lines jl
JOIN journal_entries j ON jl.journal_id = j.id
WHERE j.status = 'posted'
GROUP BY j.firm_id, jl.account_code;

-- General Ledger View (Running Balance needs window function, simpler view first)
CREATE OR REPLACE VIEW view_general_ledger AS
SELECT 
    j.firm_id,
    jl.account_code,
    j.entry_date,
    j.reference_no,
    j.description,
    jl.debit,
    jl.credit,
    SUM(jl.debit - jl.credit) OVER (PARTITION BY j.firm_id, jl.account_code ORDER BY j.entry_date, j.created_at) as running_balance
FROM journal_entry_lines jl
JOIN journal_entries j ON jl.journal_id = j.id
WHERE j.status = 'posted';

-- 3️⃣ AR Aging Helper Function
-- Calculating aging buckets in SQL is faster than App Layer
CREATE OR REPLACE FUNCTION get_ar_aging(p_firm_id UUID, p_as_of_date DATE)
RETURNS TABLE (
    client_id UUID,
    client_name TEXT,
    total_outstanding NUMERIC,
    bucket_0_30 NUMERIC,
    bucket_31_60 NUMERIC,
    bucket_61_90 NUMERIC,
    bucket_90_plus NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fd.client_id,
        c.name as client_name,
        SUM(fd.balance_due) as total_outstanding,
        SUM(CASE WHEN (p_as_of_date - fd.created_at::date) <= 30 THEN fd.balance_due ELSE 0 END) as bucket_0_30,
        SUM(CASE WHEN (p_as_of_date - fd.created_at::date) > 30 AND (p_as_of_date - fd.created_at::date) <= 60 THEN fd.balance_due ELSE 0 END) as bucket_31_60,
        SUM(CASE WHEN (p_as_of_date - fd.created_at::date) > 60 AND (p_as_of_date - fd.created_at::date) <= 90 THEN fd.balance_due ELSE 0 END) as bucket_61_90,
        SUM(CASE WHEN (p_as_of_date - fd.created_at::date) > 90 THEN fd.balance_due ELSE 0 END) as bucket_90_plus
    FROM financial_documents fd
    LEFT JOIN clients c ON fd.client_id = c.id
    WHERE fd.firm_id = p_firm_id
    AND fd.document_type = 'invoice'
    AND fd.status IN ('approved', 'sent', 'lhdn_submitted', 'lhdn_validated') -- Active invoices
    AND fd.balance_due > 0
    AND fd.created_at::date <= p_as_of_date
    GROUP BY fd.client_id, c.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4️⃣ Additional Permissions for Reports
INSERT INTO permissions (code) VALUES 
('accounting.view_reports'),
('finance.cancel_document')
ON CONFLICT (code) DO NOTHING;
