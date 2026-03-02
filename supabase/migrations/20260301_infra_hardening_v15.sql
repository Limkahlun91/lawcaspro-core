-- MIGRATION v15: INFRASTRUCTURE HARDENING (PHASE 4A)
-- Focus: Concurrency, Security, Job Locking, Audit Integrity

-- 1️⃣ Stripe Webhook Hardening (Concurrency)
-- Drop old RLS or logic if needed, ensure unique constraint is strict
-- Already done in v13 (event_id UNIQUE), but we add a function to handle safe insert
CREATE OR REPLACE FUNCTION safe_insert_stripe_event(p_event_id TEXT, p_type TEXT, p_payload JSONB)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO stripe_webhook_events (event_id, event_type, payload, status)
    VALUES (p_event_id, p_type, p_payload, 'pending');
    RETURN TRUE;
EXCEPTION WHEN unique_violation THEN
    RETURN FALSE; -- Already exists, skip processing
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2️⃣ Feature Flag Security Hardening
-- Drop insecure public policy
DROP POLICY IF EXISTS "public_read_flags" ON feature_flags;

-- New Policy: Only allow access via secure view/function, or only service role
-- We'll allow authenticated users to read, but usually we filter by what applies to them.
-- For now, restrictive policy:
CREATE POLICY "service_role_manage_flags" ON feature_flags USING (auth.role() = 'service_role');
-- We don't allow direct SELECT from client. Use check_feature_flag RPC.

-- 3️⃣ Job Locking for Workers (Data Export)
ALTER TABLE data_export_requests ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE data_export_requests ADD COLUMN IF NOT EXISTS locked_by TEXT; -- Worker ID

-- 4️⃣ Audit Integrity (Hash Chain)
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS previous_hash TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS chain_hash TEXT;

-- Trigger to auto-calculate hash on insert
CREATE OR REPLACE FUNCTION calculate_audit_hash() RETURNS TRIGGER AS $$
DECLARE
    v_prev_hash TEXT;
    v_payload TEXT;
BEGIN
    -- Get last hash for this firm (or global if system-wide chain)
    -- For scalability, per-firm chain is better.
    SELECT chain_hash INTO v_prev_hash
    FROM audit_logs
    WHERE firm_id = NEW.firm_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_prev_hash IS NULL THEN
        v_prev_hash := 'GENESIS_HASH';
    END IF;
    
    -- Payload = prev_hash + action + record_id + timestamp
    v_payload := v_prev_hash || NEW.action || NEW.record_id::text || NEW.created_at::text;
    
    -- Calculate SHA256
    NEW.previous_hash := v_prev_hash;
    NEW.chain_hash := encode(digest(v_payload, 'sha256'), 'hex');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Enable pgcrypto if not enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TRIGGER trigger_audit_hash
BEFORE INSERT ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION calculate_audit_hash();

-- 5️⃣ API Keys & Gateway (Already created in v14, refining)
-- Add last_used_ip for security tracking
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS last_used_ip TEXT;

-- 6️⃣ Permissions for Infrastructure
INSERT INTO permissions (code) VALUES 
('infra.manage_workers'),
('infra.view_audit_chain')
ON CONFLICT (code) DO NOTHING;
