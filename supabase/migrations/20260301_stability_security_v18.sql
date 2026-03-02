-- MIGRATION v18: STABILITY & SECURITY HARDENING
-- Focus: Transactional Integrity, Key Rotation, Alerting

-- 1️⃣ Transactional Integrity Helper (Atomic Operations)
-- Supabase JS doesn't support complex transactions easily.
-- We move critical multi-table writes to Stored Procedures.

-- Example: Complete Milestone -> Create Invoice -> Log Audit (Atomic)
CREATE OR REPLACE FUNCTION complete_litigation_milestone(
    p_milestone_id UUID,
    p_user_id UUID,
    p_firm_id UUID,
    p_amount NUMERIC
) RETURNS UUID AS $$
DECLARE
    v_case_record RECORD;
    v_invoice_id UUID;
    v_milestone_status TEXT;
BEGIN
    -- Lock milestone row
    SELECT status, case_id INTO v_milestone_status, v_case_record 
    FROM litigation_milestones 
    WHERE id = p_milestone_id 
    FOR UPDATE;

    IF v_milestone_status = 'completed' THEN
        RAISE EXCEPTION 'Milestone already completed';
    END IF;

    -- Create Invoice
    INSERT INTO financial_documents (
        firm_id, document_type, document_no, client_id, case_id, 
        status, subtotal, total_amount, created_by
    )
    SELECT 
        p_firm_id, 'invoice', 'INV-' || floor(extract(epoch from now())), 
        c.client_id, m.case_id, 'draft', p_amount, p_amount, p_user_id
    FROM litigation_milestones m
    JOIN cases c ON m.case_id = c.id
    WHERE m.id = p_milestone_id
    RETURNING id INTO v_invoice_id;

    -- Update Milestone
    UPDATE litigation_milestones
    SET status = 'completed',
        completed_at = now(),
        amount_to_bill = p_amount,
        invoice_id = v_invoice_id
    WHERE id = p_milestone_id;

    -- Log Audit
    INSERT INTO audit_logs (firm_id, user_id, action, table_name, record_id, created_at)
    VALUES (p_firm_id, p_user_id, 'COMPLETE_MILESTONE', 'litigation_milestones', p_milestone_id, now());

    RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2️⃣ Webhook Secret Rotation Support
ALTER TABLE partner_webhooks ADD COLUMN IF NOT EXISTS previous_secret_key TEXT;
ALTER TABLE partner_webhooks ADD COLUMN IF NOT EXISTS secret_rotated_at TIMESTAMPTZ;

-- 3️⃣ Alerting Thresholds Table
CREATE TABLE IF NOT EXISTS system_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type TEXT NOT NULL, -- lhdn_failure_rate, api_latency
    threshold_value NUMERIC NOT NULL,
    condition TEXT NOT NULL, -- >, <, =
    is_active BOOLEAN DEFAULT true,
    notify_email TEXT,
    
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed Default Alerts
INSERT INTO system_alerts (alert_type, threshold_value, condition, notify_email) VALUES
('lhdn_failure_rate', 5.0, '>', 'admin@lawcaspro.com'),
('webhook_permanent_failures', 10, '>', 'admin@lawcaspro.com'),
('api_p95_latency_ms', 2000, '>', 'devops@lawcaspro.com');

-- 4️⃣ Key Rotation Audit
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMPTZ;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS previous_key_hash TEXT;

-- 5️⃣ Permissions for Rotation
INSERT INTO permissions (code) VALUES 
('api.rotate_keys'),
('infra.manage_alerts')
ON CONFLICT (code) DO NOTHING;
