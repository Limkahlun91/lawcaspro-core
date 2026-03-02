-- MIGRATION v11: PHASE 3 - SAAS READY
-- Focus: Billing, Usage Metering, Rate Limits, Disaster Recovery Prep

-- 1️⃣ Subscription & Billing Layer
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id) UNIQUE, -- One active sub per firm
    
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    
    plan_code TEXT DEFAULT 'basic', -- basic, pro, enterprise
    status TEXT DEFAULT 'active', -- active, past_due, canceled, trialing
    
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    
    lhdn_quota_limit INTEGER DEFAULT 100,
    storage_limit_gb NUMERIC DEFAULT 2.0,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firm_isolation_subscriptions" ON subscriptions 
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- 2️⃣ Usage Metering Log
CREATE TABLE IF NOT EXISTS usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id),
    
    usage_type TEXT NOT NULL CHECK (usage_type IN ('lhdn_submission', 'storage_upload', 'payment_link')),
    quantity INTEGER DEFAULT 1,
    reference_id UUID, -- Link to document/submission ID
    
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firm_isolation_usage" ON usage_logs 
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- Index for fast quota checking (count by firm + type + month)
CREATE INDEX idx_usage_logs_metering ON usage_logs(firm_id, usage_type, created_at);

-- 3️⃣ Usage Metering Helper Function
CREATE OR REPLACE FUNCTION check_usage_quota(p_firm_id UUID, p_usage_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_limit INTEGER;
    v_current_usage INTEGER;
    v_period_start TIMESTAMPTZ;
BEGIN
    -- Get Plan Limit
    SELECT 
        CASE 
            WHEN p_usage_type = 'lhdn_submission' THEN lhdn_quota_limit 
            ELSE 999999 -- Default unlimited for others unless specified
        END,
        current_period_start
    INTO v_limit, v_period_start
    FROM subscriptions
    WHERE firm_id = p_firm_id;
    
    IF v_limit IS NULL THEN RETURN TRUE; END IF; -- No subscription? Allow or block policy. Assume Free Tier logic elsewhere.
    
    -- Count Usage in Current Period
    SELECT COUNT(*) INTO v_current_usage
    FROM usage_logs
    WHERE firm_id = p_firm_id 
    AND usage_type = p_usage_type
    AND created_at >= v_period_start;
    
    RETURN v_current_usage < v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4️⃣ Document Storage Metadata (S3 Integration)
ALTER TABLE financial_documents ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE financial_documents ADD COLUMN IF NOT EXISTS storage_checksum TEXT;
ALTER TABLE financial_documents ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;

-- 5️⃣ Permissions for Phase 3
INSERT INTO permissions (code) VALUES 
('billing.view'),
('billing.manage'),
('admin.view_usage')
ON CONFLICT (code) DO NOTHING;
