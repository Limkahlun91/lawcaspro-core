-- Phase 5: Document Automation Engine Schema

-- 1. Document Templates (The Core)
CREATE TABLE IF NOT EXISTS document_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    firm_id UUID NOT NULL REFERENCES firms(id),
    name TEXT NOT NULL,
    category TEXT, -- 'SPA', 'Loan', 'General'
    type TEXT NOT NULL DEFAULT 'editor', -- 'editor' (HTML), 'word' (.docx), 'pdf' (legacy PDF)
    content_html TEXT, -- For Editor
    content_json JSONB, -- For Editor State / Logic / Coordinates
    file_url TEXT, -- For Word/PDF uploads
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view templates for their firm" ON document_templates
    FOR SELECT USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage templates for their firm" ON document_templates
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- 2. Template Versions (Versioning)
CREATE TABLE IF NOT EXISTS template_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES document_templates(id),
    version INTEGER NOT NULL,
    content_html TEXT,
    content_json JSONB,
    file_url TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    change_log TEXT
);

ALTER TABLE template_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view versions for their firm" ON template_versions
    FOR SELECT USING (template_id IN (SELECT id FROM document_templates WHERE firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid())));

-- 3. System Variables (The Variable Engine)
CREATE TABLE IF NOT EXISTS system_variables (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT NOT NULL, -- 'Basic Info', 'Purchaser', 'Vendor'
    label TEXT NOT NULL, -- 'Purchaser Name'
    variable_key TEXT NOT NULL UNIQUE, -- 'PURCHASER_NAME'
    source_table TEXT, -- 'cases'
    source_column TEXT, -- 'purchaser_name'
    data_type TEXT DEFAULT 'text', -- 'text', 'date', 'currency', 'list'
    description TEXT
);

-- Seed some system variables (optional, but good for testing)
INSERT INTO system_variables (category, label, variable_key, source_table, source_column, data_type) VALUES
('Basic Info', 'Case File Ref', 'FILE_REF', 'cases', 'fileRef', 'text'),
('Basic Info', 'Unit Number', 'UNIT_NO', 'cases', 'unit_no', 'text'),
('Purchaser', 'Purchaser Name', 'PURCHASER_NAME', 'cases', 'purchaser_name', 'text'),
('Purchaser', 'IC Number', 'PURCHASER_IC', 'cases', 'ic_no', 'text'),
('Finance', 'SPA Price', 'SPA_PRICE', 'cases', 'spa_price', 'currency')
ON CONFLICT (variable_key) DO NOTHING;

-- 4. Generated Documents (History)
CREATE TABLE IF NOT EXISTS generated_documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    firm_id UUID NOT NULL REFERENCES firms(id),
    case_id BIGINT REFERENCES cases(id), -- Note: cases.id is bigint
    template_id UUID REFERENCES document_templates(id),
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL, -- 'pdf', 'docx'
    generated_by UUID REFERENCES auth.users(id),
    generated_at TIMESTAMPTZ DEFAULT now(),
    version_used INTEGER
);

ALTER TABLE generated_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view generated docs for their firm" ON generated_documents
    FOR SELECT USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- 5. Template Variables Map (Optimization)
CREATE TABLE IF NOT EXISTS template_variables_map (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES document_templates(id),
    variable_key TEXT NOT NULL REFERENCES system_variables(variable_key),
    UNIQUE(template_id, variable_key)
);
