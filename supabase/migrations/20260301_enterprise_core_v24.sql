-- Migration: Enterprise Core Upgrade (v24)
-- Description: Adds profile status for suspension and approval rules engine.

-- 1. Profile Status
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE profiles ADD CONSTRAINT profiles_status_check CHECK (status IN ('active', 'suspended', 'pending'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- 2. Approval Rules
CREATE TABLE IF NOT EXISTS approval_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL,
    module TEXT NOT NULL, -- 'payment_voucher', 'case_closure'
    condition JSONB NOT NULL, -- { "field": "amount", "operator": "gt", "value": 50000 }
    required_roles TEXT[] NOT NULL, -- ['partner', 'founder']
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE approval_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "approval_rules_firm_isolation" ON approval_rules;
CREATE POLICY "approval_rules_firm_isolation" ON approval_rules
    FOR ALL
    USING (firm_id = (auth.jwt() -> 'user_metadata' ->> 'firm_id')::uuid);
