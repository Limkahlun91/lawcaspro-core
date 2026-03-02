-- MIGRATION v16: PLATFORM INFRASTRUCTURE & TRUST ACCOUNTS
-- Focus: Webhook Queue, Trust Ledger Hardening, API Versioning

-- 1️⃣ Partner Webhook Queue (Infrastructure Grade)
CREATE TABLE IF NOT EXISTS webhook_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id),
    partner_webhook_id UUID REFERENCES partner_webhooks(id),
    
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    
    status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
    response_status INTEGER, -- HTTP status code
    response_body TEXT,
    
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMPTZ DEFAULT now(),
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for worker polling
CREATE INDEX idx_webhook_jobs_pending ON webhook_jobs(status, next_retry_at) 
WHERE status IN ('pending', 'failed') AND retry_count < 5;

-- 2️⃣ Trust Account Ledger Hardening (Legal Specific)
-- Ensuring double entry and no negative balance constraints

-- Check Constraint: Trust Balance cannot be negative (Legal Requirement)
ALTER TABLE trust_accounts ADD CONSTRAINT check_trust_balance_positive CHECK (balance >= 0);

-- Trigger to update main account balance on ledger insert
CREATE OR REPLACE FUNCTION update_trust_balance() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.transaction_type = 'deposit' THEN
        UPDATE trust_accounts 
        SET balance = balance + NEW.credit
        WHERE id = NEW.trust_account_id;
    ELSIF NEW.transaction_type = 'withdrawal' THEN
        -- Check sufficient funds first
        IF (SELECT balance FROM trust_accounts WHERE id = NEW.trust_account_id) < NEW.debit THEN
            RAISE EXCEPTION 'Insufficient funds in Trust Account';
        END IF;
        
        UPDATE trust_accounts 
        SET balance = balance - NEW.debit
        WHERE id = NEW.trust_account_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_trust_balance
AFTER INSERT ON trust_ledger_entries
FOR EACH ROW
EXECUTE FUNCTION update_trust_balance();

-- 3️⃣ API Usage Tracking (Granular)
CREATE TABLE IF NOT EXISTS api_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID REFERENCES api_keys(id),
    firm_id UUID NOT NULL,
    
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    
    ip_address TEXT,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4️⃣ Permissions for Infrastructure
INSERT INTO permissions (code) VALUES 
('trust.manage_transfers'),
('api.view_logs')
ON CONFLICT (code) DO NOTHING;
