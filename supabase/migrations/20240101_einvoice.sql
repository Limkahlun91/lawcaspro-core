
-- Create firm_credentials table
CREATE TABLE IF NOT EXISTS firm_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL, -- In production, this should be encrypted using pgcrypto or similar
    environment TEXT DEFAULT 'preprod',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create einvoices table
CREATE TABLE IF NOT EXISTS einvoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_uid TEXT UNIQUE, -- LHDN UUID
    long_id TEXT, -- The long ID from LHDN
    internal_id TEXT NOT NULL, -- Our Invoice No (e.g. INV-2024-001)
    status TEXT DEFAULT 'DRAFT', -- DRAFT, SUBMITTED, VALIDATED, REJECTED, CANCELLED
    raw_payload JSONB, -- Store the UBL JSON
    lhdn_response JSONB, -- Store full response
    validation_errors JSONB,
    qr_code_url TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE firm_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE einvoices ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for now, assuming authenticated users can access their firm's data)
-- In a real multi-tenant app, we would have a firm_id column.
CREATE POLICY "Allow authenticated read access to firm_credentials"
ON firm_credentials FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read access to einvoices"
ON einvoices FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert access to einvoices"
ON einvoices FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update access to einvoices"
ON einvoices FOR UPDATE TO authenticated USING (true);
