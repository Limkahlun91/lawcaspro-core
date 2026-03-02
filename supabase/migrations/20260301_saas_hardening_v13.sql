-- MIGRATION v13: SAAS HARDENING - WEBHOOK & WORKERS
-- Focus: Stripe Idempotency, Data Export Worker, Feature Flags

-- 1️⃣ Stripe Webhook Idempotency Layer
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT UNIQUE NOT NULL, -- Stripe event ID
    event_type TEXT NOT NULL, -- invoice.paid etc
    status TEXT DEFAULT 'pending', -- pending, processed, failed
    payload JSONB,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- No RLS for this, it's system level. Or restricted to service role.
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- Only service role can access

-- 2️⃣ Feature Flag System (Rollout Control)
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_key TEXT UNIQUE NOT NULL, -- e.g. 'new_dashboard_v2'
    description TEXT,
    is_enabled BOOLEAN DEFAULT false, -- Global switch
    
    allowed_plans TEXT[], -- e.g. ['pro', 'enterprise']
    allowed_firms UUID[], -- Specific firm overrides
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_flags" ON feature_flags FOR SELECT USING (true); -- Everyone can check flags

-- 3️⃣ Feature Flag Helper
CREATE OR REPLACE FUNCTION check_feature_flag(p_firm_id UUID, p_flag_key TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_flag RECORD;
    v_plan TEXT;
BEGIN
    SELECT * INTO v_flag FROM feature_flags WHERE flag_key = p_flag_key;
    
    IF v_flag IS NULL THEN RETURN FALSE; END IF;
    IF NOT v_flag.is_enabled THEN RETURN FALSE; END IF;
    
    -- Check specific firm override
    IF p_firm_id = ANY(v_flag.allowed_firms) THEN RETURN TRUE; END IF;
    
    -- Check plan
    IF v_flag.allowed_plans IS NOT NULL THEN
        SELECT plan_code INTO v_plan FROM subscriptions WHERE firm_id = p_firm_id;
        IF v_plan = ANY(v_flag.allowed_plans) THEN RETURN TRUE; END IF;
        RETURN FALSE;
    END IF;
    
    RETURN TRUE; -- If enabled and no restrictions
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4️⃣ Additional Permissions
INSERT INTO permissions (code) VALUES 
('admin.manage_flags')
ON CONFLICT (code) DO NOTHING;
