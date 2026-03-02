-- MIGRATION v8: LAWYER FINANCIAL CORE ENGINE v1
-- Focus: Unified Financial Documents, LHDN Compliance, Accounting Ledger

-- 1️⃣ Unified Financial Documents Table
-- Replaces separate 'quotations', 'invoices', 'payment_vouchers' with a single robust structure.
-- NOTE: We keep 'payment_vouchers' for expense side (money out), this table is for REVENUE side (money in).
-- Or we can merge ALL. For now, let's focus on Revenue Side (Quote -> Invoice -> Credit Note) as requested.

CREATE TABLE IF NOT EXISTS financial_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id),
    client_id UUID REFERENCES clients(id),
    case_id BIGINT REFERENCES cases(id),
    
    document_type TEXT NOT NULL CHECK (document_type IN ('quotation', 'invoice', 'credit_note', 'debit_note', 'receipt')),
    document_no TEXT NOT NULL, -- e.g. INV-2026-001
    
    status TEXT DEFAULT 'draft', -- draft, pending_approval, approved, sent, converted, lhdn_submitted, lhdn_validated, paid, cancelled
    currency TEXT DEFAULT 'MYR',
    
    -- Financials
    subtotal NUMERIC(15,2) DEFAULT 0.00,
    sst_amount NUMERIC(15,2) DEFAULT 0.00,
    sst_percentage NUMERIC(5,2) DEFAULT 0.00,
    total_amount NUMERIC(15,2) DEFAULT 0.00,
    balance_due NUMERIC(15,2) DEFAULT 0.00, -- Tracks partial payments
    
    -- LHDN e-Invoice Fields
    lhdn_status TEXT DEFAULT 'not_applicable', -- not_applicable, pending, submitted, validated, rejected, cancelled
    lhdn_uuid TEXT,
    lhdn_submission_uid TEXT,
    lhdn_qr_url TEXT,
    lhdn_validated_at TIMESTAMPTZ,
    lhdn_errors JSONB,
    
    -- Payment Link
    payment_link_url TEXT,
    payment_status TEXT DEFAULT 'unpaid', -- unpaid, partially_paid, paid
    payment_reference TEXT, -- Gateway Ref ID
    
    -- Relationships
    source_document_id UUID REFERENCES financial_documents(id), -- e.g. Quote ID for an Invoice
    
    -- Audit
    created_by UUID REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(firm_id, document_no)
);

ALTER TABLE financial_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firm_isolation_fin_docs" ON financial_documents 
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- 2️⃣ Financial Document Items
CREATE TABLE IF NOT EXISTS financial_document_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES financial_documents(id) ON DELETE CASCADE,
    
    description TEXT NOT NULL,
    qty NUMERIC(10,2) DEFAULT 1.00,
    unit_price NUMERIC(15,2) DEFAULT 0.00,
    amount NUMERIC(15,2) DEFAULT 0.00,
    
    -- Accounting & Tax
    account_code TEXT, -- e.g. '4000-ProfFee', '4100-Disbursement'
    tax_code TEXT, -- e.g. 'SV-6' (Standard Rated 6%)
    
    item_order INTEGER DEFAULT 0
);

ALTER TABLE financial_document_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firm_isolation_fin_items" ON financial_document_items 
    FOR ALL USING (
        document_id IN (
            SELECT id FROM financial_documents WHERE firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid())
        )
    );

-- 3️⃣ Accounting Ledger (Double Entry System)
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id),
    
    reference_document_id UUID REFERENCES financial_documents(id), -- Link to Invoice/Receipt
    reference_no TEXT, -- e.g. INV-2026-001
    
    entry_date DATE NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'posted', -- draft, posted, voided
    
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    
    account_code TEXT NOT NULL, -- e.g. '1200-AR', '4000-Sales'
    description TEXT,
    
    debit NUMERIC(15,2) DEFAULT 0.00,
    credit NUMERIC(15,2) DEFAULT 0.00
);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm_isolation_journals" ON journal_entries 
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "firm_isolation_journal_lines" ON journal_entry_lines 
    FOR ALL USING (
        journal_id IN (
            SELECT id FROM journal_entries WHERE firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid())
        )
    );

-- 4️⃣ LHDN Compliance Updates
-- Firms Table Update
ALTER TABLE firms ADD COLUMN IF NOT EXISTS tin_no TEXT;
ALTER TABLE firms ADD COLUMN IF NOT EXISTS sst_no TEXT;
ALTER TABLE firms ADD COLUMN IF NOT EXISTS msic_code TEXT;
ALTER TABLE firms ADD COLUMN IF NOT EXISTS business_activity TEXT;

-- Clients Table Update
ALTER TABLE clients ADD COLUMN IF NOT EXISTS tin_no TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS id_type TEXT; -- NRIC, BRN, PASSPORT, ARMY
ALTER TABLE clients ADD COLUMN IF NOT EXISTS id_no TEXT;

-- 5️⃣ Permissions for Financial Engine
INSERT INTO permissions (code) VALUES 
('finance.view'),
('finance.create_quote'),
('finance.create_invoice'),
('finance.approve'),
('finance.lhdn_submit'),
('finance.view_ledger')
ON CONFLICT (code) DO NOTHING;
