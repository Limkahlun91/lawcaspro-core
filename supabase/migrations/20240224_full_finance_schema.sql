
-- ⚠️ FULL DATABASE REBUILD SCRIPT ⚠️
-- This script resets the schema and rebuilds it from scratch for the Test Environment.

-- 1. CLEANUP (Drop existing tables to ensure clean state)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS gl_lines CASCADE;
DROP TABLE IF EXISTS gl_entries CASCADE;
DROP TABLE IF EXISTS category_gl_mapping CASCADE;
DROP TABLE IF EXISTS chart_of_accounts CASCADE;
DROP TABLE IF EXISTS einvoices CASCADE;
DROP TABLE IF EXISTS payment_vouchers CASCADE;
DROP TABLE IF EXISTS finance_logs CASCADE;
DROP TABLE IF EXISTS cases CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS developers CASCADE;
DROP TABLE IF EXISTS firm_users CASCADE;
DROP TABLE IF EXISTS firms CASCADE;

-- 2. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 3. CORE TABLES

-- 3.1 Firms (Multi-Tenant Root)
CREATE TABLE IF NOT EXISTS firms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.2 Firm Users (RBAC)
CREATE TABLE IF NOT EXISTS firm_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    firm_id UUID REFERENCES firms(id) NOT NULL,
    role TEXT DEFAULT 'Staff', -- Founder, Partner, Senior Lawyer, Junior Lawyer, Senior Clerk, Junior Clerk, Account, Admin, Runner
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, firm_id)
);

-- 3.3 Developers (Master Data)
CREATE TABLE IF NOT EXISTS developers (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.4 Projects (Master Data)
CREATE TABLE IF NOT EXISTS projects (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    name TEXT NOT NULL,
    phase TEXT,
    developer_id BIGINT REFERENCES developers(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.5 Cases (Core Business Object)
CREATE TABLE IF NOT EXISTS cases (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    project_id BIGINT REFERENCES projects(id),
    unit_no TEXT,
    purchaser_name TEXT,
    spa_price NUMERIC,
    status TEXT DEFAULT 'Open',
    data JSONB, -- Stores dynamic fields (262 fields)
    firm_id UUID REFERENCES firms(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.6 Payment Vouchers (Finance)
CREATE TABLE IF NOT EXISTS payment_vouchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pv_no TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    payee_name TEXT NOT NULL,
    type TEXT, -- 'Cash', 'Cheque', 'Online Transfer'
    amount NUMERIC NOT NULL DEFAULT 0,
    category TEXT, -- 'Office', 'Client', 'Utility', 'Other'
    status TEXT DEFAULT 'Draft', -- Draft, Submitted, Categorized, Approved, Paid
    purpose TEXT,
    
    -- Locking & Security
    is_amount_locked BOOLEAN DEFAULT FALSE,
    is_paid BOOLEAN DEFAULT FALSE,
    
    -- Workflow Metadata
    created_by UUID REFERENCES auth.users(id),
    firm_id UUID REFERENCES firms(id),
    submitted_at TIMESTAMP WITH TIME ZONE,
    categorized_by UUID REFERENCES auth.users(id),
    categorized_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    paid_by UUID REFERENCES auth.users(id),
    paid_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.7 e-Invoices (LHDN Integration)
CREATE TABLE IF NOT EXISTS einvoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_uid TEXT UNIQUE, -- LHDN UUID
    long_id TEXT, 
    internal_id TEXT NOT NULL, -- INV-2024-001
    status TEXT DEFAULT 'DRAFT', -- DRAFT, SUBMITTED, VALIDATED, REJECTED, CANCELLED
    raw_payload JSONB,
    lhdn_response JSONB,
    validation_errors JSONB,
    qr_code_url TEXT,
    amount NUMERIC,
    date DATE,
    created_by UUID REFERENCES auth.users(id),
    firm_id UUID REFERENCES firms(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.8 Chart of Accounts (Accounting)
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- Asset, Liability, Equity, Revenue, Expense
    category TEXT, -- Office, Client
    is_system BOOLEAN DEFAULT FALSE,
    firm_id UUID REFERENCES firms(id), -- Null for system accounts
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.9 GL Entries (Header)
CREATE TABLE IF NOT EXISTS gl_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    description TEXT,
    reference_type TEXT, -- 'PV', 'Invoice', 'Manual'
    reference_id UUID,
    firm_id UUID REFERENCES firms(id) NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3.10 GL Lines (Details)
CREATE TABLE IF NOT EXISTS gl_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gl_entry_id UUID REFERENCES gl_entries(id) ON DELETE CASCADE,
    account_code TEXT REFERENCES chart_of_accounts(code),
    debit NUMERIC DEFAULT 0,
    credit NUMERIC DEFAULT 0,
    description TEXT,
    firm_id UUID REFERENCES firms(id) NOT NULL
);

-- 3.11 Category Mapping
CREATE TABLE IF NOT EXISTS category_gl_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_name TEXT NOT NULL,
    debit_account_code TEXT REFERENCES chart_of_accounts(code),
    credit_account_code TEXT REFERENCES chart_of_accounts(code),
    firm_id UUID REFERENCES firms(id)
);

-- 3.12 Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    record_id UUID,
    action TEXT NOT NULL, -- INSERT, UPDATE, DELETE, APPROVE, PAY
    old_data JSONB,
    new_data JSONB,
    user_id UUID REFERENCES auth.users(id),
    firm_id UUID REFERENCES firms(id),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. INDEXES (Performance)
CREATE INDEX IF NOT EXISTS idx_cases_firm ON cases(firm_id);
CREATE INDEX IF NOT EXISTS idx_pv_firm ON payment_vouchers(firm_id);
CREATE INDEX IF NOT EXISTS idx_pv_status ON payment_vouchers(status);
CREATE INDEX IF NOT EXISTS idx_gl_firm ON gl_entries(firm_id);
CREATE INDEX IF NOT EXISTS idx_gl_date ON gl_entries(date);
CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_logs(table_name);

-- 5. ROW LEVEL SECURITY (RLS)

-- Enable RLS
ALTER TABLE firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE firm_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE einvoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_gl_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 5.1 Helper Function
CREATE OR REPLACE FUNCTION public.get_user_firm_id()
RETURNS UUID AS $$
    SELECT firm_id FROM firm_users WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 5.2 Policies

-- Firms
CREATE POLICY "Users can read own firm" ON firms FOR SELECT USING (id = public.get_user_firm_id());

-- Firm Users
CREATE POLICY "Users can read own firm users" ON firm_users FOR SELECT USING (firm_id = public.get_user_firm_id());

-- Cases
CREATE POLICY "Users can access own firm cases" ON cases FOR ALL USING (firm_id = public.get_user_firm_id());

-- Payment Vouchers (Strict Permissions)
-- View
CREATE POLICY "View PV" ON payment_vouchers FOR SELECT USING (
    firm_id = public.get_user_firm_id() 
    AND (
        created_by = auth.uid() -- Staff sees own
        OR 
        EXISTS (SELECT 1 FROM firm_users WHERE user_id = auth.uid() AND role IN ('Account', 'Partner', 'Founder', 'Senior Lawyer'))
    )
);
-- Create
CREATE POLICY "Create PV" ON payment_vouchers FOR INSERT WITH CHECK (firm_id = public.get_user_firm_id());
-- Update (Strict Workflow)
CREATE POLICY "Update PV" ON payment_vouchers FOR UPDATE USING (firm_id = public.get_user_firm_id()) WITH CHECK (
    firm_id = public.get_user_firm_id()
    AND (
        (created_by = auth.uid() AND status = 'Draft') OR
        (EXISTS (SELECT 1 FROM firm_users WHERE user_id = auth.uid() AND role = 'Account') AND status IN ('Submitted', 'Approved')) OR
        (EXISTS (SELECT 1 FROM firm_users WHERE user_id = auth.uid() AND role IN ('Partner', 'Founder')) AND status = 'Categorized')
    )
);

-- GL & Accounting
CREATE POLICY "View GL" ON gl_entries FOR ALL USING (firm_id = public.get_user_firm_id());
CREATE POLICY "View GL Lines" ON gl_lines FOR ALL USING (firm_id = public.get_user_firm_id());
CREATE POLICY "View CoA" ON chart_of_accounts FOR SELECT USING (firm_id = public.get_user_firm_id() OR firm_id IS NULL);
CREATE POLICY "View Mappings" ON category_gl_mapping FOR ALL USING (firm_id = public.get_user_firm_id() OR firm_id IS NULL);

-- Audit
CREATE POLICY "View Audit" ON audit_logs FOR SELECT USING (firm_id = public.get_user_firm_id());
CREATE POLICY "Insert Audit" ON audit_logs FOR INSERT WITH CHECK (firm_id = public.get_user_firm_id());

-- 6. FUNCTIONS & TRIGGERS

-- 6.1 Set Firm ID Trigger
CREATE OR REPLACE FUNCTION public.set_firm_id_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.firm_id IS NULL THEN
        NEW.firm_id := public.get_user_firm_id();
    END IF;
    IF NEW.firm_id != public.get_user_firm_id() THEN
        RAISE EXCEPTION 'User does not belong to the specified firm.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_firm_id_cases BEFORE INSERT ON cases FOR EACH ROW EXECUTE FUNCTION public.set_firm_id_trigger();
CREATE TRIGGER set_firm_id_pv BEFORE INSERT ON payment_vouchers FOR EACH ROW EXECUTE FUNCTION public.set_firm_id_trigger();
CREATE TRIGGER set_firm_id_inv BEFORE INSERT ON einvoices FOR EACH ROW EXECUTE FUNCTION public.set_firm_id_trigger();
CREATE TRIGGER set_firm_id_gl BEFORE INSERT ON gl_entries FOR EACH ROW EXECUTE FUNCTION public.set_firm_id_trigger();

-- 6.2 PV Hard Lock & Auto-Timestamp
CREATE OR REPLACE FUNCTION public.check_pv_lock()
RETURNS TRIGGER AS $$
BEGIN
    -- Lock Check
    IF OLD.is_amount_locked = TRUE THEN
        IF NEW.amount != OLD.amount OR NEW.payee_name != OLD.payee_name OR NEW.purpose != OLD.purpose THEN
            RAISE EXCEPTION 'Payment Voucher is Locked.';
        END IF;
    END IF;

    -- Auto-Lock on Approval
    IF NEW.status = 'Approved' AND OLD.status != 'Approved' THEN
        NEW.is_amount_locked := TRUE;
        NEW.approved_at := NOW();
        NEW.approved_by := auth.uid();
    END IF;
    
    -- Auto-Mark Paid
    IF NEW.status = 'Paid' AND OLD.status != 'Paid' THEN
        NEW.is_paid := TRUE;
        NEW.paid_at := NOW();
        NEW.paid_by := auth.uid();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER enforce_pv_lock BEFORE UPDATE ON payment_vouchers FOR EACH ROW EXECUTE FUNCTION public.check_pv_lock();

-- 6.3 Auto-GL Posting
CREATE OR REPLACE FUNCTION public.auto_post_gl_pv()
RETURNS TRIGGER AS $$
DECLARE
    mapping_record RECORD;
    entry_id UUID;
    v_firm_id UUID;
BEGIN
    IF NEW.status = 'Approved' AND OLD.status != 'Approved' THEN
        v_firm_id := NEW.firm_id;
        SELECT * INTO mapping_record FROM category_gl_mapping WHERE category_name = NEW.category LIMIT 1;
        
        IF FOUND THEN
            INSERT INTO gl_entries (date, description, reference_type, reference_id, firm_id, created_by)
            VALUES (CURRENT_DATE, 'PV Accrual: ' || NEW.pv_no, 'PV', NEW.id, v_firm_id, auth.uid())
            RETURNING id INTO entry_id;

            INSERT INTO gl_lines (gl_entry_id, account_code, debit, credit, description, firm_id)
            VALUES 
            (entry_id, mapping_record.debit_account_code, NEW.amount, 0, NEW.purpose, v_firm_id),
            (entry_id, '2000', 0, NEW.amount, 'Accounts Payable', v_firm_id);
        END IF;
    
    ELSIF NEW.status = 'Paid' AND OLD.status != 'Paid' THEN
        v_firm_id := NEW.firm_id;
        INSERT INTO gl_entries (date, description, reference_type, reference_id, firm_id, created_by)
        VALUES (CURRENT_DATE, 'PV Payment: ' || NEW.pv_no, 'PV', NEW.id, v_firm_id, auth.uid())
        RETURNING id INTO entry_id;

        INSERT INTO gl_lines (gl_entry_id, account_code, debit, credit, description, firm_id)
        VALUES 
        (entry_id, '2000', NEW.amount, 0, 'Clear AP', v_firm_id),
        (entry_id, '1000', 0, NEW.amount, 'Bank Payment', v_firm_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_auto_gl_pv AFTER UPDATE ON payment_vouchers FOR EACH ROW EXECUTE FUNCTION public.auto_post_gl_pv();

-- 6.4 Audit Log
CREATE OR REPLACE FUNCTION public.log_audit_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, user_id, firm_id)
    VALUES (TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), TG_OP, row_to_json(OLD), row_to_json(NEW), auth.uid(), COALESCE(NEW.firm_id, OLD.firm_id));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_pv AFTER INSERT OR UPDATE OR DELETE ON payment_vouchers FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();

-- 7. SEED DATA

-- 7.1 Default Firm
INSERT INTO firms (name, address) VALUES ('Default Law Firm', 'HQ, Kuala Lumpur');

-- 7.2 Chart of Accounts
INSERT INTO chart_of_accounts (code, name, type, category, is_system) VALUES
('1000', 'Bank - Office Account', 'Asset', 'Office', TRUE),
('1001', 'Bank - Client Account', 'Asset', 'Client', TRUE),
('2000', 'Accounts Payable', 'Liability', 'Office', TRUE),
('2001', 'SST Payable', 'Liability', 'Office', TRUE),
('3000', 'Capital', 'Equity', 'Office', TRUE),
('4000', 'Legal Fees Revenue', 'Revenue', 'Office', TRUE),
('5000', 'General Expenses', 'Expense', 'Office', TRUE),
('5001', 'Client Disbursements', 'Expense', 'Client', TRUE),
('5002', 'Utilities', 'Expense', 'Office', TRUE)
ON CONFLICT DO NOTHING;

-- 7.3 Category Mapping
INSERT INTO category_gl_mapping (category_name, debit_account_code, credit_account_code) VALUES
('Office', '5000', '2000'),
('Client', '5001', '2000'),
('Utility', '5002', '2000'),
('Other', '5000', '2000')
ON CONFLICT DO NOTHING;

-- 7.4 Assign existing users to Default Firm (if any exist in auth.users)
DO $$
DECLARE
    default_firm_id UUID;
BEGIN
    SELECT id INTO default_firm_id FROM firms WHERE name = 'Default Law Firm' LIMIT 1;
    
    INSERT INTO firm_users (user_id, firm_id, role)
    SELECT id, default_firm_id, 'Founder'
    FROM auth.users
    WHERE NOT EXISTS (SELECT 1 FROM firm_users WHERE user_id = auth.users.id);
END $$;
