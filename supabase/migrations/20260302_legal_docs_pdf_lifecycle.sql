-- Migration: Legal Document Automation - PDF Form Lifecycle
-- Date: 2026-03-02

-- 1. Extend Status Check Constraint
-- Note: Postgres constraints can be tricky to modify. 
-- We will drop the constraint and re-add it with new values.
-- Or better, we just change the check constraint.

-- For firm_templates
ALTER TABLE firm_templates DROP CONSTRAINT IF EXISTS firm_templates_status_check;
ALTER TABLE firm_templates ADD CONSTRAINT firm_templates_status_check 
CHECK (status IN ('draft', 'designing', 'mapping', 'invalid', 'ready', 'archived'));

-- For global_templates
ALTER TABLE global_templates DROP CONSTRAINT IF EXISTS global_templates_status_check;
ALTER TABLE global_templates ADD CONSTRAINT global_templates_status_check 
CHECK (status IN ('draft', 'designing', 'mapping', 'invalid', 'ready', 'archived'));

-- 2. Add render_engine column
ALTER TABLE firm_templates ADD COLUMN IF NOT EXISTS render_engine TEXT CHECK (render_engine IN ('docx_templater', 'pdf_acroform')) DEFAULT 'docx_templater';
ALTER TABLE global_templates ADD COLUMN IF NOT EXISTS render_engine TEXT CHECK (render_engine IN ('docx_templater', 'pdf_acroform')) DEFAULT 'docx_templater';

-- 3. Create pdf_field_mappings table (Versioned)
CREATE TABLE IF NOT EXISTS pdf_field_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL, -- Specific version ID
    pdf_field_name TEXT NOT NULL,
    variable_key TEXT, -- Maps to variable_dictionary.variable_key
    is_required BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE pdf_field_mappings ENABLE ROW LEVEL SECURITY;

-- Policy: Allow read for authenticated
CREATE POLICY "Allow read pdf mappings" ON pdf_field_mappings FOR SELECT TO authenticated USING (true);

-- Policy: Allow write for admins/partners
CREATE POLICY "Allow write pdf mappings" ON pdf_field_mappings FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM firm_templates 
        WHERE firm_templates.id = pdf_field_mappings.template_id 
        AND firm_templates.firm_id = (auth.jwt() -> 'user_metadata' ->> 'firm_id')::uuid
    )
    OR
    EXISTS (
        SELECT 1 FROM global_templates
        WHERE global_templates.id = pdf_field_mappings.template_id
        AND (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'founder')
    )
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_pdf_field_mappings_template_id ON pdf_field_mappings(template_id);
