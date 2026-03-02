-- Migration: Enterprise SaaS Upgrade (v22)
-- Description: Adds export_logs, security_events, and updates payment_vouchers status workflow.

-- 1. Create Export Logs Table
CREATE TABLE IF NOT EXISTS export_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL,
    user_id UUID NOT NULL,
    export_type TEXT NOT NULL,
    record_count INTEGER DEFAULT 0,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_export_firm_id ON export_logs(firm_id);
CREATE INDEX IF NOT EXISTS idx_export_user_id ON export_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_export_created_at ON export_logs(created_at DESC);

ALTER TABLE export_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "export_firm_isolation" ON export_logs;
CREATE POLICY "export_firm_isolation" ON export_logs
    FOR ALL
    USING (firm_id = (auth.jwt() -> 'user_metadata' ->> 'firm_id')::uuid);

-- 2. Create Security Events Table (Anomaly Detection)
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL,
    user_id UUID NOT NULL,
    event_type TEXT NOT NULL, -- e.g., 'excessive_export', 'suspicious_login'
    risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_firm_id ON security_events(firm_id);
CREATE INDEX IF NOT EXISTS idx_security_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_risk_level ON security_events(risk_level);

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "security_firm_isolation" ON security_events;
CREATE POLICY "security_firm_isolation" ON security_events
    FOR SELECT
    USING (firm_id = (auth.jwt() -> 'user_metadata' ->> 'firm_id')::uuid);

-- 3. Update Payment Vouchers Status Workflow
-- First, drop the existing check constraint if it exists (assuming it was named payment_vouchers_status_check or similar)
-- We'll try to drop it by name, if we know it. If not, we might need to find it.
-- For now, let's assume a standard name or just add a new one if possible, but modifying existing data might be tricky.
-- Safe approach: Add the new constraint.
ALTER TABLE payment_vouchers DROP CONSTRAINT IF EXISTS payment_vouchers_status_check;

ALTER TABLE payment_vouchers ADD CONSTRAINT payment_vouchers_status_check 
CHECK (status IN (
    'Draft', 
    'Prepared', 
    'Approved by Lawyer', 
    'Approved by Partner', 
    'Submitted to Account', 
    'Paid', 
    'Archived'
));

-- 4. Firms Table (Ensure it exists and has necessary columns)
CREATE TABLE IF NOT EXISTS firms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    plan_type TEXT DEFAULT 'standard',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE firms ENABLE ROW LEVEL SECURITY;

-- 5. RLS for Firms (Users can only see their own firm)
DROP POLICY IF EXISTS "firm_isolation" ON firms;
CREATE POLICY "firm_isolation" ON firms
    FOR SELECT
    USING (id = (auth.jwt() -> 'user_metadata' ->> 'firm_id')::uuid);
