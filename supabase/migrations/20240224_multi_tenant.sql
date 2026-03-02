
-- 1. Create firms table
CREATE TABLE IF NOT EXISTS firms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create firm_users table (Link auth.users to firms)
CREATE TABLE IF NOT EXISTS firm_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    firm_id UUID REFERENCES firms(id) NOT NULL,
    role TEXT DEFAULT 'Staff', -- Founder, Partner, Staff
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, firm_id)
);

-- 3. Create cases table (if not exists)
CREATE TABLE IF NOT EXISTS cases (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    project_id BIGINT REFERENCES projects(id),
    unit_no TEXT,
    purchaser_name TEXT,
    spa_price NUMERIC,
    status TEXT DEFAULT 'Open',
    data JSONB, -- Store all dynamic fields here
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    firm_id UUID REFERENCES firms(id)
);

-- Ensure firm_id exists if table already existed (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cases' AND column_name='firm_id') THEN
        ALTER TABLE cases ADD COLUMN firm_id UUID REFERENCES firms(id);
    END IF;
END $$;

-- 4. Create finance_logs table (if not exists)
CREATE TABLE IF NOT EXISTS finance_logs (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    action TEXT,
    details TEXT,
    user_id UUID REFERENCES auth.users(id),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    firm_id UUID REFERENCES firms(id)
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='finance_logs' AND column_name='firm_id') THEN
        ALTER TABLE finance_logs ADD COLUMN firm_id UUID REFERENCES firms(id);
    END IF;
END $$;

-- 5. Create einvoices table (if not exists)
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
    amount NUMERIC,
    date DATE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    firm_id UUID REFERENCES firms(id)
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='einvoices' AND column_name='firm_id') THEN
        ALTER TABLE einvoices ADD COLUMN firm_id UUID REFERENCES firms(id);
    END IF;
END $$;

-- 6. Create gl_entries (future ledger tables)
CREATE TABLE IF NOT EXISTS gl_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    description TEXT,
    debit_account TEXT,
    credit_account TEXT,
    amount NUMERIC,
    posted_by UUID REFERENCES auth.users(id),
    firm_id UUID REFERENCES firms(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Migrate Data
-- Create Default Firm
INSERT INTO firms (name, address)
SELECT 'Default Law Firm', '123 Legal Avenue, KL'
WHERE NOT EXISTS (SELECT 1 FROM firms WHERE name = 'Default Law Firm');

-- Get Default Firm ID and migrate
DO $$
DECLARE
    default_firm_id UUID;
BEGIN
    SELECT id INTO default_firm_id FROM firms WHERE name = 'Default Law Firm' LIMIT 1;

    -- Assign existing users to default firm as Founder if not already assigned
    INSERT INTO firm_users (user_id, firm_id, role)
    SELECT id, default_firm_id, 'Founder'
    FROM auth.users
    WHERE NOT EXISTS (SELECT 1 FROM firm_users WHERE user_id = auth.users.id);

    -- Update existing records to default firm
    UPDATE cases SET firm_id = default_firm_id WHERE firm_id IS NULL;
    UPDATE finance_logs SET firm_id = default_firm_id WHERE firm_id IS NULL;
    UPDATE einvoices SET firm_id = default_firm_id WHERE firm_id IS NULL;
    UPDATE gl_entries SET firm_id = default_firm_id WHERE firm_id IS NULL;
END $$;

-- 8. Enable RLS
ALTER TABLE firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE firm_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE einvoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_entries ENABLE ROW LEVEL SECURITY;

-- 9. Create RLS Policies

-- Helper function to check firm access (idempotent)
CREATE OR REPLACE FUNCTION public.get_user_firm_id()
RETURNS UUID AS $$
    SELECT firm_id FROM firm_users WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Drop existing policies to avoid conflict
DROP POLICY IF EXISTS "Users can read own firm" ON firms;
DROP POLICY IF EXISTS "Users can read own firm users" ON firm_users;
DROP POLICY IF EXISTS "Users can access own firm cases" ON cases;
DROP POLICY IF EXISTS "Users can access own firm logs" ON finance_logs;
DROP POLICY IF EXISTS "Users can access own firm invoices" ON einvoices;
DROP POLICY IF EXISTS "Users can access own firm GL" ON gl_entries;

-- Firms: Users can read their own firm
CREATE POLICY "Users can read own firm" ON firms
    FOR SELECT USING (id = public.get_user_firm_id());

-- Firm Users: Users can read their own firm's user list
CREATE POLICY "Users can read own firm users" ON firm_users
    FOR SELECT USING (firm_id = public.get_user_firm_id());

-- Cases: Users can access records where firm_id matches
CREATE POLICY "Users can access own firm cases" ON cases
    FOR ALL USING (firm_id = public.get_user_firm_id());

-- Finance Logs: Users can access own firm logs
CREATE POLICY "Users can access own firm logs" ON finance_logs
    FOR ALL USING (firm_id = public.get_user_firm_id());

-- e-Invoices: Users can access own firm invoices
CREATE POLICY "Users can access own firm invoices" ON einvoices
    FOR ALL USING (firm_id = public.get_user_firm_id());

-- GL Entries: Users can access own firm GL
CREATE POLICY "Users can access own firm GL" ON gl_entries
    FOR ALL USING (firm_id = public.get_user_firm_id());
