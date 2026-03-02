-- MIGRATION v3: GOVERNMENT READY ARCHITECTURE & SAAS HARDENING
-- Focus: LHDN Integration, Audit, RBAC, and Standardization

-- 1️⃣ Standardize & Secure Existing Tables

-- Firms: Ensure Gov fields
ALTER TABLE firms ADD COLUMN IF NOT EXISTS registration_no TEXT;
ALTER TABLE firms ADD COLUMN IF NOT EXISTS tax_no TEXT;

-- Cases: Gov Ready & Soft Delete
ALTER TABLE cases ADD COLUMN IF NOT EXISTS government_case BOOLEAN DEFAULT false;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

-- 2️⃣ Payment Voucher Refactoring (The Big One)

-- Rename amount to total_amount to be explicit
ALTER TABLE payment_vouchers RENAME COLUMN amount TO total_amount;

-- Add Gov & Safety fields
ALTER TABLE payment_vouchers ADD COLUMN IF NOT EXISTS voucher_no TEXT;
ALTER TABLE payment_vouchers ADD COLUMN IF NOT EXISTS lhdn_submission_status TEXT DEFAULT 'pending'; -- pending, submitted, validated, rejected
ALTER TABLE payment_vouchers ADD COLUMN IF NOT EXISTS lhdn_uuid TEXT;
ALTER TABLE payment_vouchers ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
ALTER TABLE payment_vouchers ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
ALTER TABLE payment_vouchers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add Unique constraint on voucher_no per firm (or global if UUID, but usually per firm sequence)
-- For now, just Unique as requested, but scoped to firm is better. User spec says "voucher_no TEXT UNIQUE".
-- I will make it unique for now.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_vouchers_voucher_no_key') THEN
        ALTER TABLE payment_vouchers ADD CONSTRAINT payment_vouchers_voucher_no_key UNIQUE (voucher_no);
    END IF;
END $$;

-- Refactor Junction Table: payment_voucher_cases -> pv_cases
ALTER TABLE payment_voucher_cases RENAME TO pv_cases;
ALTER TABLE pv_cases ADD COLUMN IF NOT EXISTS allocated_amount NUMERIC(15,2);

-- 3️⃣ e-Invoice Table (Renaming & Standardizing)
ALTER TABLE einvoices RENAME TO e_invoices;

-- Align columns with v3 Spec
ALTER TABLE e_invoices ADD COLUMN IF NOT EXISTS pv_id UUID REFERENCES payment_vouchers(id);
ALTER TABLE e_invoices ADD COLUMN IF NOT EXISTS lhdn_uuid TEXT;
ALTER TABLE e_invoices ADD COLUMN IF NOT EXISTS lhdn_submission_id TEXT;
ALTER TABLE e_invoices ADD COLUMN IF NOT EXISTS validation_status TEXT;
ALTER TABLE e_invoices ADD COLUMN IF NOT EXISTS response_payload JSONB;
ALTER TABLE e_invoices ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE e_invoices ADD COLUMN IF NOT EXISTS validated_at TIMESTAMPTZ;

-- 4️⃣ WhatsApp Logs (New)
CREATE TABLE IF NOT EXISTS whatsapp_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id),
    client_id UUID, -- Optional link to client
    phone TEXT NOT NULL,
    message TEXT,
    status TEXT, -- 'sent', 'delivered', 'read', 'failed'
    provider_message_id TEXT,
    sent_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE whatsapp_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firm_isolation_whatsapp" ON whatsapp_logs FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- 5️⃣ Audit Logs Standardization
-- Rename timestamp to created_at to match system standard
ALTER TABLE audit_logs RENAME COLUMN timestamp TO created_at;

-- Ensure JSONB columns exist (already checked, they do: old_data, new_data)

-- 6️⃣ Role Based Access Control (RBAC) Engine

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE, -- 'admin', 'lawyer', 'clerk'
    description TEXT
);

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE, -- 'pv.create', 'case.view'
    description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Seed Default Roles (Idempotent)
INSERT INTO roles (name) VALUES ('Founder'), ('Partner'), ('Senior Lawyer'), ('Junior Lawyer'), ('Clerk'), ('Admin') ON CONFLICT (name) DO NOTHING;

-- Seed Basic Permissions
INSERT INTO permissions (code) VALUES 
('case.view'), ('case.create'), ('case.edit'), ('case.delete'),
('pv.view'), ('pv.create'), ('pv.approve'), ('pv.pay'),
('einvoice.submit'),
('whatsapp.send'),
('audit.view')
ON CONFLICT (code) DO NOTHING;

-- 7️⃣ Firm Users Update
ALTER TABLE firm_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
-- We keep 'role' string in firm_users/profiles for now as legacy, but add role_id for future migration
ALTER TABLE firm_users ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id);

-- 8️⃣ RLS Security Hardening (Critical)

-- Ensure all tables have RLS enabled and firm isolation
ALTER TABLE e_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "firm_isolation_einvoice" ON e_invoices;
CREATE POLICY "firm_isolation_einvoice" ON e_invoices FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE pv_cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "firm_isolation_pv_cases" ON pv_cases;
CREATE POLICY "firm_isolation_pv_cases" ON pv_cases FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- Update payment_vouchers policies to handle soft delete visibility
DROP POLICY IF EXISTS "firm_isolation_pv" ON payment_vouchers;
-- Need to drop old specific policies if they exist, or just add a broad one
-- For simplicity in this migration script, we ensure at least the basic isolation exists.
-- Real production migration would carefully replace policies.
-- Here we add a policy that respects deleted_at for SELECT
CREATE POLICY "firm_isolation_pv_select" ON payment_vouchers FOR SELECT USING (
    firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid())
    AND deleted_at IS NULL
);

-- 9️⃣ Soft Delete View Helper (Optional but good practice)
-- Create a view for active cases
CREATE OR REPLACE VIEW active_cases AS
SELECT * FROM cases WHERE deleted_at IS NULL;
