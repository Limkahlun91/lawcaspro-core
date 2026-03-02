-- MIGRATION v2: DOCUMENT GOVERNANCE ARCHITECTURE
-- Includes: Approval Workflows, Dependency Tracking, and Hash Verification

-- 3️⃣ Migration v2 – 审批流程支持 (Approval Workflows)

-- 3.1 Template Approvals Table
CREATE TABLE IF NOT EXISTS template_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE, -- Ensure RLS works
    template_version_id UUID NOT NULL REFERENCES template_versions(id),
    requested_by UUID REFERENCES auth.users(id), -- Changed from users(id) to auth.users for Supabase
    approved_by UUID REFERENCES auth.users(id),
    status VARCHAR(50) CHECK (
        status IN ('pending', 'approved', 'rejected')
    ) DEFAULT 'pending',
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    decided_at TIMESTAMPTZ,
    remarks TEXT
);

ALTER TABLE template_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm_isolation_approvals" ON template_approvals
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- 3.2 Update Template Versions
ALTER TABLE template_versions 
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) 
CHECK (approval_status IN ('draft', 'pending', 'approved', 'rejected')) 
DEFAULT 'draft';

-- 4️⃣ 模板依赖追踪系统 (Template Dependencies)

-- 4.1 Template Dependencies Table
CREATE TABLE IF NOT EXISTS template_dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE, -- Ensure RLS works
    template_id UUID REFERENCES document_templates(id),
    variable_key VARCHAR(255) NOT NULL,
    is_required BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(template_id, variable_key)
);

ALTER TABLE template_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm_isolation_dependencies" ON template_dependencies
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- 5️⃣ 文件哈希防篡改设计 (File Hash Integrity)

-- 5.1 Add Hash Column (Already added in previous step, ensuring exist)
ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS file_hash VARCHAR(255);

-- 5.2 Document Hash Logs (Audit Trail for Verification Checks)
CREATE TABLE IF NOT EXISTS document_hash_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id UUID NOT NULL REFERENCES firms(id),
    document_id UUID NOT NULL REFERENCES generated_documents(id),
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMPTZ DEFAULT NOW(),
    hash_match BOOLEAN NOT NULL,
    ip_address VARCHAR(50)
);

ALTER TABLE document_hash_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm_isolation_hash_logs" ON document_hash_logs
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- 🔒 RLS Policy Refinements (Bank-Grade Security)

-- Drop existing generic policies to apply stricter ones if needed
-- We use conditional drops to avoid errors

-- document_templates RLS Update
DROP POLICY IF EXISTS "select_templates" ON document_templates;
DROP POLICY IF EXISTS "insert_templates" ON document_templates;
DROP POLICY IF EXISTS "update_templates" ON document_templates;
DROP POLICY IF EXISTS "no_delete_templates" ON document_templates;
DROP POLICY IF EXISTS "firm_isolation_templates" ON document_templates; -- Drop old one

-- Select: Only Active (or draft if owner/admin)
CREATE POLICY "select_templates" ON document_templates
FOR SELECT USING (
  firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid())
);

-- Insert: Founder/Partner Only
CREATE POLICY "insert_templates" ON document_templates
FOR INSERT WITH CHECK (
  firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('Founder', 'Partner', 'Admin') -- Case sensitive check needed
  )
);

-- Update: Founder/Partner Only
CREATE POLICY "update_templates" ON document_templates
FOR UPDATE USING (
  firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role IN ('Founder', 'Partner', 'Admin')
  )
);

-- Delete: Forbidden (Soft Delete only via Update)
CREATE POLICY "no_delete_templates" ON document_templates
FOR DELETE USING (false);

-- generated_documents RLS
DROP POLICY IF EXISTS "select_generated_docs" ON generated_documents;
DROP POLICY IF EXISTS "insert_generated_docs" ON generated_documents;
DROP POLICY IF EXISTS "Users can view generated docs for their firm" ON generated_documents; -- Drop old

CREATE POLICY "select_generated_docs" ON generated_documents
FOR SELECT USING (
  firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "insert_generated_docs" ON generated_documents
FOR INSERT WITH CHECK (
  firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid())
);
