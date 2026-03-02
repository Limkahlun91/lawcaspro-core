-- ENTERPRISE DOCUMENT ENGINE - REFINEMENT MIGRATION
-- Based on "Full SQL Migration (v1.0 – Centralized Template Control)"
-- Adapted to integrate with existing schema

-- 0️⃣ Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1️⃣ Firms (Refinement)
-- Existing: id, name, created_at, updated_at, billing_plan, ai_addon_enabled
ALTER TABLE firms ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'basic';
ALTER TABLE firms ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_firms_active ON firms(is_active);

-- 2️⃣ Users (Mapped to public.profiles)
-- Existing: id, firm_id, full_name, role, updated_at
-- Ensuring consistency with enterprise requirements
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255); -- Often in auth.users, but useful here for quick lookup if synced

CREATE INDEX IF NOT EXISTS idx_profiles_firm ON profiles(firm_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- 3️⃣ Document Templates (Centralized)
-- Existing: id, firm_id, name, type, category, content_html, content_json, file_url, version, is_active
ALTER TABLE document_templates ADD COLUMN IF NOT EXISTS current_version_id UUID;
-- Type check constraint might need adjustment if already exists with different values
-- We will add a check constraint if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_template_type') THEN
        ALTER TABLE document_templates ADD CONSTRAINT check_template_type CHECK (type IN ('editor', 'word', 'pdf'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_templates_firm ON document_templates(firm_id);
CREATE INDEX IF NOT EXISTS idx_templates_active ON document_templates(is_active);

-- 4️⃣ Template Versions
-- Existing: id, template_id, version, content_html, content_json, file_url, created_by, created_at
ALTER TABLE template_versions ADD COLUMN IF NOT EXISTS version_number INT;
-- Backfill version_number from version if null
UPDATE template_versions SET version_number = version WHERE version_number IS NULL;
ALTER TABLE template_versions ALTER COLUMN version_number SET NOT NULL;

-- Add Unique constraint
ALTER TABLE template_versions DROP CONSTRAINT IF EXISTS template_versions_template_id_version_number_key;
ALTER TABLE template_versions ADD CONSTRAINT template_versions_template_id_version_number_key UNIQUE (template_id, version_number);

CREATE INDEX IF NOT EXISTS idx_template_versions_template ON template_versions(template_id);

-- Add Circular FK for current_version_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_current_version') THEN
        ALTER TABLE document_templates ADD CONSTRAINT fk_current_version FOREIGN KEY (current_version_id) REFERENCES template_versions(id);
    END IF;
END $$;

-- 5️⃣ System Variables
-- Existing: id, category, label, variable_key, source_table, source_column, data_type, created_at
ALTER TABLE system_variables ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_variables_category ON system_variables(category);

-- 6️⃣ Generated Documents
-- Existing: id, firm_id, case_id, template_id, file_url, file_type, generated_by, generated_at, version_used
ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS template_version_id UUID REFERENCES template_versions(id);
ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS file_hash VARCHAR(255);
ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS output_format VARCHAR(20);
ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'completed';

-- Map existing file_type to output_format if needed
UPDATE generated_documents SET output_format = file_type WHERE output_format IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_output_format') THEN
        ALTER TABLE generated_documents ADD CONSTRAINT check_output_format CHECK (output_format IN ('pdf', 'docx', 'html'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_generated_firm ON generated_documents(firm_id);
CREATE INDEX IF NOT EXISTS idx_generated_case ON generated_documents(case_id);
CREATE INDEX IF NOT EXISTS idx_generated_template ON generated_documents(template_id);

-- 7️⃣ Audit Logs
-- Existing: id, table_name, record_id, action, old_data, new_data, user_id, firm_id, timestamp
-- User wants: action, module, target_id, metadata, ip_address
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS module VARCHAR(100);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target_id UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_audit_firm ON audit_logs(firm_id);
CREATE INDEX IF NOT EXISTS idx_audit_module ON audit_logs(module);

-- 8️⃣ Role Permissions (Future Expandable)
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role VARCHAR(50) NOT NULL,
    module VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(role, module, action)
);

-- 9️⃣ Soft Delete Trigger
CREATE OR REPLACE FUNCTION prevent_template_hard_delete()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Hard delete not allowed. Use is_active = false.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS no_template_delete ON document_templates;
CREATE TRIGGER no_template_delete
BEFORE DELETE ON document_templates
FOR EACH ROW
EXECUTE FUNCTION prevent_template_hard_delete();

-- 🔟 Performance Enhancements
CREATE INDEX IF NOT EXISTS idx_templates_active_only
ON document_templates(firm_id)
WHERE is_active = true;

-- 🔐 Row Level Security (Refinement)
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

-- Ensure policy exists (Drop and Recreate to be safe or IF NOT EXISTS logic)
DROP POLICY IF EXISTS "firm_isolation_templates" ON document_templates;
CREATE POLICY "firm_isolation_templates"
ON document_templates
FOR ALL
USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));
