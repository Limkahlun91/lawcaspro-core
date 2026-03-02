-- Migration: Legal Document Automation Level 2 Architecture (Strict)
-- Date: 2026-03-02

-- 1. Add status to templates with strict checks
-- firm_templates
ALTER TABLE firm_templates 
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('draft', 'ready', 'archived')) DEFAULT 'draft';

-- global_templates
ALTER TABLE global_templates 
ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('draft', 'ready', 'archived')) DEFAULT 'draft';

-- 2. Add confirmation flags to template_variables
ALTER TABLE template_variables 
ADD COLUMN IF NOT EXISTS is_auto_mapped BOOLEAN DEFAULT false;

ALTER TABLE template_variables 
ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN DEFAULT false;

-- 3. Add snapshot to generated_documents
ALTER TABLE generated_documents 
ADD COLUMN IF NOT EXISTS template_name_snapshot TEXT;

-- 4. Backfill existing data
-- Set existing latest templates to 'ready' (assuming they were working)
UPDATE firm_templates SET status = 'ready' WHERE is_latest = true AND status IS NULL;
UPDATE firm_templates SET status = 'archived' WHERE is_latest = false AND status IS NULL;

UPDATE global_templates SET status = 'ready' WHERE is_latest = true AND status IS NULL;
UPDATE global_templates SET status = 'archived' WHERE is_latest = false AND status IS NULL;

-- Set existing variables to confirmed (legacy support)
UPDATE template_variables SET is_confirmed = true WHERE is_confirmed IS FALSE;
