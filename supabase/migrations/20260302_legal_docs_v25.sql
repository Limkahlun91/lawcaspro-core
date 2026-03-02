-- Migration: Legal Document Template System (v25)

-- 1. Global Templates (Founder Only)
CREATE TABLE IF NOT EXISTS global_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    folder_name TEXT,
    file_url TEXT NOT NULL,
    file_type TEXT CHECK (file_type IN ('docx','pdf')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE global_templates ENABLE ROW LEVEL SECURITY;

-- RLS: All authenticated users can read, only Founder can modify
CREATE POLICY "global_templates_read_all" ON global_templates
    FOR SELECT
    TO authenticated
    USING (true);

-- Note: Founder write access is typically handled via Service Role or specific admin checks.
-- Here we enforce it via checking user metadata if possible, or assume Admin Client usage for writes.
-- For safety, we deny all writes via RLS and use Admin Client for management.
CREATE POLICY "global_templates_deny_write" ON global_templates
    FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "global_templates_deny_update" ON global_templates
    FOR UPDATE TO authenticated USING (false);
CREATE POLICY "global_templates_deny_delete" ON global_templates
    FOR DELETE TO authenticated USING (false);


-- 2. Firm Templates (Firm Private)
CREATE TABLE IF NOT EXISTS firm_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL,
    name TEXT NOT NULL,
    folder_name TEXT,
    file_url TEXT NOT NULL,
    file_type TEXT CHECK (file_type IN ('docx','pdf')),
    is_active BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE firm_templates ENABLE ROW LEVEL SECURITY;

-- RLS: Firm Isolation
CREATE POLICY "firm_templates_isolation" ON firm_templates
    FOR ALL
    USING (firm_id = (auth.jwt() -> 'user_metadata' ->> 'firm_id')::uuid);

-- 3. Generated Documents (Records)
CREATE TABLE IF NOT EXISTS generated_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id),
    template_id UUID NOT NULL,
    template_source TEXT CHECK (template_source IN ('global','firm')),
    generated_by UUID,
    file_url TEXT NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE generated_documents ENABLE ROW LEVEL SECURITY;

-- RLS: Access based on Case ownership (which is Firm isolated)
CREATE POLICY "generated_docs_access" ON generated_documents
    FOR ALL
    USING (
        case_id IN (
            SELECT id FROM cases 
            WHERE firm_id = (auth.jwt() -> 'user_metadata' ->> 'firm_id')::uuid
        )
    );
