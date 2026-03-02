
-- 1. Create payment_voucher_cases table for Many-to-Many relationship
CREATE TABLE IF NOT EXISTS payment_voucher_cases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pv_id uuid REFERENCES payment_vouchers(id) ON DELETE CASCADE,
    case_id bigint REFERENCES cases(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(pv_id, case_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_payment_voucher_cases_pv_id ON payment_voucher_cases(pv_id);
CREATE INDEX IF NOT EXISTS idx_payment_voucher_cases_case_id ON payment_voucher_cases(case_id);

-- 2. Create pv_templates table for PV Layout Engine
CREATE TABLE IF NOT EXISTS pv_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id uuid NOT NULL, -- Multi-tenancy support
    name text NOT NULL,
    html_content text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Add index for firm_id
CREATE INDEX IF NOT EXISTS idx_pv_templates_firm_id ON pv_templates(firm_id);

-- 3. Update payment_vouchers table to link with templates
ALTER TABLE payment_vouchers ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES pv_templates(id);

-- 4. Enable RLS (Row Level Security)
ALTER TABLE payment_voucher_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE pv_templates ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies

-- Policy for payment_voucher_cases: Users can access if they can access the parent PV
-- Note: This assumes payment_vouchers has firm_id and RLS set up properly.
-- A simpler approach for now is to check if the user belongs to the firm of the linked PV.
-- However, since we don't have firm_id on this table, we rely on join.
-- For performance in Supabase, it's often better to denormalize firm_id, but let's stick to the user's design for now
-- and rely on the application layer to ensure users only see PVs they have access to.
-- BUT, for strict security, we should add firm_id or use a join policy.
-- Given the "Law Firm Internal OS" context, I will add firm_id to payment_voucher_cases to simplify RLS and performance.
ALTER TABLE payment_voucher_cases ADD COLUMN IF NOT EXISTS firm_id uuid;
-- Update firm_id based on pv_id for existing records (if any, though this is a new table)
-- UPDATE payment_voucher_cases SET firm_id = pv.firm_id FROM payment_vouchers pv WHERE payment_voucher_cases.pv_id = pv.id;

CREATE POLICY "Users can view payment_voucher_cases of their firm" ON payment_voucher_cases
    FOR SELECT
    USING (auth.uid() IN (
        SELECT id FROM profiles WHERE firm_id = payment_voucher_cases.firm_id
    ));

CREATE POLICY "Users can insert payment_voucher_cases of their firm" ON payment_voucher_cases
    FOR INSERT
    WITH CHECK (auth.uid() IN (
        SELECT id FROM profiles WHERE firm_id = payment_voucher_cases.firm_id
    ));

CREATE POLICY "Users can delete payment_voucher_cases of their firm" ON payment_voucher_cases
    FOR DELETE
    USING (auth.uid() IN (
        SELECT id FROM profiles WHERE firm_id = payment_voucher_cases.firm_id
    ));

-- Policy for pv_templates
CREATE POLICY "Users can view pv_templates of their firm" ON pv_templates
    FOR SELECT
    USING (firm_id IN (
        SELECT firm_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can insert pv_templates of their firm" ON pv_templates
    FOR INSERT
    WITH CHECK (firm_id IN (
        SELECT firm_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can update pv_templates of their firm" ON pv_templates
    FOR UPDATE
    USING (firm_id IN (
        SELECT firm_id FROM profiles WHERE id = auth.uid()
    ));

CREATE POLICY "Users can delete pv_templates of their firm" ON pv_templates
    FOR DELETE
    USING (firm_id IN (
        SELECT firm_id FROM profiles WHERE id = auth.uid()
    ));
