-- Migration: Legal Document Automation Upgrade (v26)
-- Features: Variable Mapping & Template Versioning

-- 1. Template Variables Table (Recreate to ensure schema match)
DROP TABLE IF EXISTS template_variables CASCADE;

CREATE TABLE template_variables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL,
    template_source TEXT CHECK (template_source IN ('global', 'firm')),
    variable_key TEXT NOT NULL, -- e.g. {{BORROWER_NAME}}
    case_field TEXT, -- e.g. borrower_name (Nullable for manual fill)
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE template_variables ENABLE ROW LEVEL SECURITY;

-- RLS: Firm Isolation for firm templates, Read-only for global
-- Simplified logic: Allow access if global OR if firm matches
CREATE POLICY "template_variables_firm_isolation" ON template_variables
    FOR ALL
    USING (
        template_source = 'global' 
        OR 
        (template_source = 'firm' AND EXISTS (
            SELECT 1 FROM firm_templates 
            WHERE firm_templates.id = template_variables.template_id 
            AND firm_templates.firm_id = (auth.jwt() -> 'user_metadata' ->> 'firm_id')::uuid
        ))
    );

-- Grant permissions
GRANT ALL ON template_variables TO authenticated;
GRANT SELECT ON template_variables TO anon;

-- 2. Version Control Columns
-- Global Templates
ALTER TABLE global_templates ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE global_templates ADD COLUMN IF NOT EXISTS parent_template_id UUID; -- Link to previous version (or root)
ALTER TABLE global_templates ADD COLUMN IF NOT EXISTS is_latest BOOLEAN DEFAULT true;

-- Firm Templates
ALTER TABLE firm_templates ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE firm_templates ADD COLUMN IF NOT EXISTS parent_template_id UUID;
ALTER TABLE firm_templates ADD COLUMN IF NOT EXISTS is_latest BOOLEAN DEFAULT true;

-- Generated Documents Version Tracking
ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS template_version INTEGER;
