-- Migration: Legal Document Automation Level 3 Architecture
-- Date: 2026-03-02

-- 1. Add data_snapshot to generated_documents for audit compliance
ALTER TABLE generated_documents 
ADD COLUMN IF NOT EXISTS data_snapshot JSONB;

-- 2. Create Variable Dictionary System
CREATE TABLE IF NOT EXISTS variable_dictionary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    variable_key TEXT NOT NULL UNIQUE, -- e.g. BORROWER_NAME
    description TEXT,
    data_type TEXT CHECK (data_type IN ('text', 'number', 'date', 'currency', 'list', 'boolean')) DEFAULT 'text',
    source_table TEXT, -- e.g. borrowers
    source_field TEXT, -- e.g. name
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for variable_dictionary
ALTER TABLE variable_dictionary ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read active variables
CREATE POLICY "Allow public read active variables" 
ON variable_dictionary FOR SELECT 
USING (is_active = true);

-- Policy: Only admins can modify
CREATE POLICY "Allow admin modify variables" 
ON variable_dictionary FOR ALL 
USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- 3. Populate Initial Dictionary (Standard Variables)
INSERT INTO variable_dictionary (variable_key, description, data_type, source_table, source_field)
VALUES 
('BORROWER_NAME', 'Full name of the borrower', 'text', 'borrowers', 'name'),
('BORROWER_IC', 'IC/Passport number of the borrower', 'text', 'borrowers', 'ic_no'),
('LOAN_AMOUNT', 'Total loan amount', 'currency', 'cases', 'loan_amount'),
('BANK_NAME', 'Name of the lending bank', 'text', 'cases', 'bank_name'),
('PROPERTY_ADDRESS', 'Full address of the property', 'text', 'properties', 'address'),
('CASE_REF', 'File reference number', 'text', 'cases', 'case_number'),
('DATE', 'Current generation date', 'date', 'system', 'now')
ON CONFLICT (variable_key) DO UPDATE SET 
description = EXCLUDED.description,
source_table = EXCLUDED.source_table,
source_field = EXCLUDED.source_field;
