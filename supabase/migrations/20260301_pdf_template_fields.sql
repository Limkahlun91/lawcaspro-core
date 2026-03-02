-- Phase 5.1: PDF Template Fields Schema (Coordinates for PDF Generation)

CREATE TABLE IF NOT EXISTS pdf_template_fields (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    template_id UUID NOT NULL REFERENCES document_templates(id),
    variable_key TEXT NOT NULL REFERENCES system_variables(variable_key),
    x NUMERIC NOT NULL,
    y NUMERIC NOT NULL,
    page_number INTEGER DEFAULT 1,
    font_size INTEGER DEFAULT 12,
    font_family TEXT DEFAULT 'Helvetica',
    color TEXT DEFAULT '#000000',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pdf_template_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage PDF fields for their firm" ON pdf_template_fields
    FOR ALL USING (template_id IN (SELECT id FROM document_templates WHERE firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid())));
