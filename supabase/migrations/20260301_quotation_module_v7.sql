-- MIGRATION v7: QUOTATION MODULE
-- Focus: Quotation Management, Versioning, Conversion to Invoice

-- 1️⃣ Quotations Table (The Core)
CREATE TABLE IF NOT EXISTS quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id),
    
    quote_no TEXT NOT NULL, -- e.g. QT-2026-001
    title TEXT NOT NULL,
    description TEXT,
    
    client_id UUID REFERENCES clients(id), -- Assuming clients table exists, or generic link
    case_id UUID REFERENCES cases(id), -- Optional link to case
    
    status TEXT DEFAULT 'draft', -- draft, pending_approval, approved, sent, accepted, rejected, converted
    
    subtotal NUMERIC(15,2) DEFAULT 0.00,
    sst_amount NUMERIC(15,2) DEFAULT 0.00,
    sst_percentage NUMERIC(5,2) DEFAULT 0.00, -- e.g. 6.00 or 8.00
    total_amount NUMERIC(15,2) DEFAULT 0.00,
    
    valid_until DATE,
    version INTEGER DEFAULT 1,
    
    converted_invoice_id UUID, -- Link if converted
    
    created_by UUID REFERENCES auth.users(id),
    approved_by UUID REFERENCES auth.users(id),
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(firm_id, quote_no)
);

ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firm_isolation_quotations" ON quotations 
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- 2️⃣ Quotation Items (Line Items)
CREATE TABLE IF NOT EXISTS quotation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
    
    item_type TEXT DEFAULT 'professional_fee', -- professional_fee, disbursement, misc
    description TEXT NOT NULL,
    
    quantity NUMERIC(10,2) DEFAULT 1.00,
    unit_price NUMERIC(15,2) DEFAULT 0.00,
    amount NUMERIC(15,2) DEFAULT 0.00,
    
    item_order INTEGER DEFAULT 0 -- For display sorting
);

ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firm_isolation_quote_items" ON quotation_items 
    FOR ALL USING (
        quotation_id IN (
            SELECT id FROM quotations WHERE firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid())
        )
    );

-- 3️⃣ Quotation Templates (Custom Design)
CREATE TABLE IF NOT EXISTS quotation_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id),
    
    name TEXT NOT NULL,
    header_html TEXT,
    footer_html TEXT,
    logo_url TEXT,
    bank_details TEXT,
    terms_conditions TEXT,
    
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE quotation_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firm_isolation_quote_templates" ON quotation_templates 
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- 4️⃣ Permissions for Quotation Module
INSERT INTO permissions (code) VALUES 
('quotation.view'),
('quotation.create'),
('quotation.edit'),
('quotation.approve'),
('quotation.delete'),
('quotation.convert_invoice')
ON CONFLICT (code) DO NOTHING;
