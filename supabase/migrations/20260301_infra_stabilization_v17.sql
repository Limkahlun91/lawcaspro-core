-- MIGRATION v17: INFRASTRUCTURE STABILIZATION (PHASE 4B)
-- Focus: Webhook DLQ, Metrics, Delivery Logs

-- 1️⃣ Webhook Dead Letter Queue (DLQ) & Logs
ALTER TABLE webhook_jobs ADD COLUMN IF NOT EXISTS failed_permanently BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES webhook_jobs(id),
    
    response_status INTEGER,
    response_body TEXT,
    latency_ms INTEGER,
    attempt INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for debugging partner issues
CREATE INDEX idx_webhook_logs_job ON webhook_delivery_logs(job_id);

-- 2️⃣ System Metrics (Observability Layer)
CREATE TABLE IF NOT EXISTS system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type TEXT NOT NULL, -- api_latency, webhook_success_rate, lhdn_failure_rate
    value NUMERIC NOT NULL,
    metadata JSONB,
    
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- Auto-partitioning or retention policy would be needed for high volume metrics in future.
-- For now, simple table is fine.

-- 3️⃣ Permissions for Monitoring
INSERT INTO permissions (code) VALUES 
('infra.view_metrics'),
('infra.debug_webhooks')
ON CONFLICT (code) DO NOTHING;
