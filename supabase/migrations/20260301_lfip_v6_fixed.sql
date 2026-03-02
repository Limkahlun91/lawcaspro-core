-- MIGRATION v6: LEGAL FINANCE INTELLIGENCE PLATFORM (LFIP)
-- Focus: AI Risk, Digital Signature, Gov Queue, and Trust Account Foundation

-- 1️⃣ Digital Signature for Finance (Enterprise Security)
CREATE TABLE IF NOT EXISTS finance_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id),
    record_type TEXT NOT NULL CHECK (record_type IN ('payment_voucher', 'credit_note', 'debit_note')),
    record_id UUID NOT NULL, -- Link to payment_vouchers.id etc.
    
    hash_value TEXT NOT NULL, 
    signature TEXT NOT NULL, 
    signed_by UUID REFERENCES auth.users(id),
    signed_at TIMESTAMPTZ DEFAULT now(),
    signature_algorithm TEXT DEFAULT 'RSA-SHA256',
    
    public_key_fingerprint TEXT, 
    
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE finance_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firm_isolation_signatures" ON finance_signatures 
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX idx_finance_signatures_record ON finance_signatures(record_id);

-- 2️⃣ AI Risk Monitoring (Finance Risk Detector)
CREATE TABLE IF NOT EXISTS ai_finance_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id),
    
    target_type TEXT NOT NULL CHECK (target_type IN ('payment_voucher', 'case', 'invoice')),
    target_id UUID NOT NULL,
    
    flag_type TEXT NOT NULL, 
    risk_score INTEGER CHECK (risk_score BETWEEN 0 AND 100),
    description TEXT,
    
    status TEXT DEFAULT 'pending', 
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_finance_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firm_isolation_ai_flags" ON ai_finance_flags 
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- 3️⃣ Government Integration Queue (Reliability Layer)
CREATE TABLE IF NOT EXISTS gov_submission_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id),
    
    document_type TEXT NOT NULL, 
    document_id UUID NOT NULL, -- Link to e_invoices.id
    
    status TEXT DEFAULT 'queued', 
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    
    last_error TEXT,
    next_retry_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE gov_submission_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firm_isolation_gov_queue" ON gov_submission_queue 
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX idx_gov_queue_pending ON gov_submission_queue(status, next_retry_at) 
WHERE status IN ('queued', 'retrying');

-- 4️⃣ Trust Account Ledger (Foundation)
CREATE TABLE IF NOT EXISTS trust_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id),
    
    account_name TEXT NOT NULL, 
    account_number TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    
    balance NUMERIC(15,2) DEFAULT 0.00,
    currency TEXT DEFAULT 'MYR',
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- NOTE: case_id is BIGINT in 'cases' table. Fixed type mismatch.
CREATE TABLE IF NOT EXISTS trust_ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id),
    trust_account_id UUID NOT NULL REFERENCES trust_accounts(id),
    
    case_id BIGINT REFERENCES cases(id), -- Fixed type from UUID to BIGINT
    client_id UUID, 
    
    transaction_date DATE NOT NULL,
    description TEXT NOT NULL,
    
    debit NUMERIC(15,2) DEFAULT 0.00, 
    credit NUMERIC(15,2) DEFAULT 0.00, 
    balance_after NUMERIC(15,2) NOT NULL,
    
    transaction_type TEXT, 
    reference_no TEXT, 
    
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE trust_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm_isolation_trust_acc" ON trust_accounts 
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "firm_isolation_trust_ledger" ON trust_ledger_entries 
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- 5️⃣ Additional Permissions
INSERT INTO permissions (code) VALUES 
('finance.sign'),
('finance.verify'),
('trust.view'),
('trust.deposit'),
('trust.withdraw'),
('ai.risk_view')
ON CONFLICT (code) DO NOTHING;
