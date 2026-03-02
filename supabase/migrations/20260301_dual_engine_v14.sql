-- MIGRATION v14: DUAL ENGINE STRATEGY (ROUTE A + C)
-- Focus: Litigation Workflow, Conveyancing, API Keys, Partner Portal

-- 🔥 ROUTE A: LEGAL VERTICAL DOMINANCE

-- 1️⃣ Litigation Workflow Stages
-- Extends the generic workflow engine for specific legal matters
CREATE TABLE IF NOT EXISTS litigation_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id),
    case_id BIGINT NOT NULL REFERENCES cases(id),
    
    stage_name TEXT NOT NULL, -- e.g. 'File Writ', 'Case Management', 'Hearing', 'Judgment'
    status TEXT DEFAULT 'pending', -- pending, in_progress, completed
    
    billing_percentage NUMERIC(5,2), -- % of total fee to bill at this stage
    amount_to_bill NUMERIC(15,2),
    
    completed_at TIMESTAMPTZ,
    invoice_id UUID REFERENCES financial_documents(id), -- Auto-generated invoice
    
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE litigation_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firm_isolation_litigation" ON litigation_milestones 
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- 2️⃣ Conveyancing Stakeholder Ledger
-- For holding money (redemption sum, balance purchase price)
CREATE TABLE IF NOT EXISTS stakeholder_funds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id),
    case_id BIGINT NOT NULL REFERENCES cases(id),
    
    fund_type TEXT NOT NULL, -- e.g. 'earnest_deposit', 'balance_purchase_price', 'retention_sum'
    amount NUMERIC(15,2) NOT NULL,
    
    received_date DATE,
    release_date_target DATE,
    actual_release_date DATE,
    
    status TEXT DEFAULT 'held', -- held, releasing, released, refunded
    
    bank_account_id UUID REFERENCES trust_accounts(id), -- Must be in Client Account
    
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE stakeholder_funds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firm_isolation_stakeholder" ON stakeholder_funds 
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));


-- 🔥 ROUTE C: INFRASTRUCTURE LAYER (PUBLIC API)

-- 3️⃣ API Key Management
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id),
    
    name TEXT NOT NULL, -- e.g. 'Production Key', 'Staging Key'
    key_prefix TEXT NOT NULL, -- e.g. 'sk_live_...' (first 8 chars)
    key_hash TEXT NOT NULL, -- Store hashed version only!
    
    scopes TEXT[], -- e.g. ['invoice.write', 'lhdn.read']
    rate_limit_req_per_min INTEGER DEFAULT 60,
    
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firm_isolation_api_keys" ON api_keys 
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- 4️⃣ Webhook Config (For Partners)
CREATE TABLE IF NOT EXISTS partner_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id),
    
    url TEXT NOT NULL,
    events TEXT[], -- e.g. ['invoice.validated', 'payment.received']
    secret_key TEXT NOT NULL, -- To sign payload
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE partner_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firm_isolation_webhooks" ON partner_webhooks 
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- 5️⃣ Permissions for New Modules
INSERT INTO permissions (code) VALUES 
('litigation.manage'),
('conveyancing.manage_funds'),
('api.manage_keys'),
('api.manage_webhooks')
ON CONFLICT (code) DO NOTHING;
