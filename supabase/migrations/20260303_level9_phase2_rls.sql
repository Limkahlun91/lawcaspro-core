-- LEVEL 9 PHASE 2: Enterprise RLS Enforcement (Revised)
-- Created at: 2026-03-03
-- Description: Implement RLS. Uses local firm_id where available (performance), joins where not.

-- GROUP A: Tables with existing firm_id column
-- 1. case_properties
DROP POLICY IF EXISTS "Firm Isolation" ON case_properties;
CREATE POLICY "Firm Isolation" ON case_properties
FOR ALL
USING (firm_id = (auth.jwt() ->> 'firm_id')::uuid)
WITH CHECK (firm_id = (auth.jwt() ->> 'firm_id')::uuid);

-- 2. case_purchasers
DROP POLICY IF EXISTS "Firm Isolation" ON case_purchasers;
CREATE POLICY "Firm Isolation" ON case_purchasers
FOR ALL
USING (firm_id = (auth.jwt() ->> 'firm_id')::uuid)
WITH CHECK (firm_id = (auth.jwt() ->> 'firm_id')::uuid);

-- 3. case_loans
DROP POLICY IF EXISTS "Firm Isolation" ON case_loans;
CREATE POLICY "Firm Isolation" ON case_loans
FOR ALL
USING (firm_id = (auth.jwt() ->> 'firm_id')::uuid)
WITH CHECK (firm_id = (auth.jwt() ->> 'firm_id')::uuid);

-- 4. case_borrowers
DROP POLICY IF EXISTS "Firm Isolation" ON case_borrowers;
CREATE POLICY "Firm Isolation" ON case_borrowers
FOR ALL
USING (firm_id = (auth.jwt() ->> 'firm_id')::uuid)
WITH CHECK (firm_id = (auth.jwt() ->> 'firm_id')::uuid);

-- 5. case_spa_status
DROP POLICY IF EXISTS "Firm Isolation" ON case_spa_status;
CREATE POLICY "Firm Isolation" ON case_spa_status
FOR ALL
USING (firm_id = (auth.jwt() ->> 'firm_id')::uuid)
WITH CHECK (firm_id = (auth.jwt() ->> 'firm_id')::uuid);


-- GROUP B: Tables without firm_id (Pure normalized tables)
-- 6. case_custom_clauses
DROP POLICY IF EXISTS "Firm Isolation" ON case_custom_clauses;
CREATE POLICY "Firm Isolation" ON case_custom_clauses
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM cases
        WHERE cases.id = case_custom_clauses.case_id
        AND cases.firm_id = (auth.jwt() ->> 'firm_id')::uuid
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM cases
        WHERE cases.id = case_custom_clauses.case_id
        AND cases.firm_id = (auth.jwt() ->> 'firm_id')::uuid
    )
);

-- 7. case_audit_logs
DROP POLICY IF EXISTS "Firm Isolation Read" ON case_audit_logs;
CREATE POLICY "Firm Isolation Read" ON case_audit_logs
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM cases
        WHERE cases.id = case_audit_logs.case_id
        AND cases.firm_id = (auth.jwt() ->> 'firm_id')::uuid
    )
);

DROP POLICY IF EXISTS "Firm Isolation Insert" ON case_audit_logs;
CREATE POLICY "Firm Isolation Insert" ON case_audit_logs
FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM cases
        WHERE cases.id = case_audit_logs.case_id
        AND cases.firm_id = (auth.jwt() ->> 'firm_id')::uuid
    )
);
