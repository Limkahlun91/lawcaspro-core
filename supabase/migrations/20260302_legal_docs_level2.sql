-- Migration: Legal Document Automation Level 2 Architecture
-- Date: 2026-03-02

-- 1. Add status to templates
ALTER TABLE global_templates ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('draft', 'ready', 'archived')) DEFAULT 'draft';
ALTER TABLE firm_templates ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('draft', 'ready', 'archived')) DEFAULT 'draft';

-- 2. Add confirmation flags to template_variables
ALTER TABLE template_variables ADD COLUMN IF NOT EXISTS is_auto_mapped BOOLEAN DEFAULT false;
ALTER TABLE template_variables ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN DEFAULT false;

-- 3. Add snapshot to generated_documents
ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS template_name_snapshot TEXT;

-- 4. Backfill existing data to avoid breaking the system
-- Set existing templates to 'ready' so they can still be used
UPDATE global_templates SET status = 'ready' WHERE status IS NULL OR status = 'draft';
UPDATE firm_templates SET status = 'ready' WHERE status IS NULL OR status = 'draft';

-- Note: Existing variables will have is_confirmed = false by default, which might block generation if we enforce strictly immediately.
-- For this migration, let's assume existing variables are confirmed.
UPDATE template_variables SET is_confirmed = true WHERE is_confirmed IS FALSE;
