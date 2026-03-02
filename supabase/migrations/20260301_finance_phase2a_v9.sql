-- MIGRATION v9: LEGAL FINANCE PLATFORM - PHASE 2A
-- Focus: Payment Loop, LHDN Core, Accounting Mappings, Audit

-- 1️⃣ Payment Gateway Integration (Closing the Loop)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id),
    document_id UUID NOT NULL REFERENCES financial_documents(id), -- Link to Invoice
    
    gateway TEXT NOT NULL, -- stripe, billplz, toyyibpay, manual
    amount NUMERIC(15,2) NOT NULL,
    currency TEXT DEFAULT 'MYR',
    
    status TEXT DEFAULT 'pending', -- pending, paid, failed, refunded
    gateway_reference TEXT, -- e.g. Stripe Payment Intent ID
    callback_payload JSONB,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firm_isolation_payments" ON payments 
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- 2️⃣ LHDN MyInvois Core (Submission Tracking)
CREATE TABLE IF NOT EXISTS lhdn_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id),
    document_id UUID NOT NULL REFERENCES financial_documents(id),
    
    submission_uid TEXT, -- UUID returned by LHDN
    status TEXT DEFAULT 'pending', -- pending, submitted, validated, rejected, cancelled
    
    request_payload JSONB, -- The JSON sent to LHDN (Encrypted ideally, but JSONB for now)
    response_payload JSONB, -- The validation response
    error_message TEXT,
    
    retry_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE lhdn_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firm_isolation_lhdn_subs" ON lhdn_submissions 
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- 3️⃣ Accounting Engine Upgrade (Dynamic Mappings)
CREATE TABLE IF NOT EXISTS account_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id),
    
    document_type TEXT NOT NULL, -- invoice, credit_note, payment
    item_type TEXT, -- professional_fee, disbursement, sst
    
    debit_account TEXT NOT NULL, -- e.g. '1200-AR'
    credit_account TEXT NOT NULL, -- e.g. '4000-Sales'
    tax_account TEXT, -- e.g. '2200-SST'
    
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(firm_id, document_type, item_type)
);

ALTER TABLE account_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firm_isolation_acc_mappings" ON account_mappings 
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- Seed Default Mappings (System Level or Per Firm Trigger needed later)
-- For now, we assume application logic handles defaults if not found.

-- 4️⃣ Audit Logs (Already exists, but ensuring coverage for new modules)
-- We reuse the existing 'audit_logs' table but define new action types in code.

-- 5️⃣ Permissions for Phase 2
INSERT INTO permissions (code) VALUES 
('payment.create_link'),
('payment.view'),
('lhdn.view_submission'),
('lhdn.retry'),
('accounting.manage_mappings')
ON CONFLICT (code) DO NOTHING;
