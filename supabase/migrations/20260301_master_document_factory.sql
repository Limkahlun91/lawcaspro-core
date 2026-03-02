-- 20260301_master_document_factory.sql

-- 1. Templates Table
CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL,
  category text NOT NULL,
  template_name text NOT NULL,
  file_format text CHECK (file_format IN ('docx','pdf')),
  storage_path text NOT NULL,
  version int DEFAULT 1,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. Template Variables Table
CREATE TABLE IF NOT EXISTS template_variables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES templates(id) ON DELETE CASCADE,
  variable_key text NOT NULL,
  data_type text CHECK (data_type IN ('string','date','currency','address','nric')),
  required boolean DEFAULT false,
  priority_rule text,
  created_at timestamptz DEFAULT now()
);

-- 3. Case Data Sources Table
CREATE TABLE IF NOT EXISTS case_data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL, -- Assuming 'cases' table exists, referencing it might be good but user didn't specify FK
  field_name text NOT NULL,
  value text NOT NULL,
  source text,
  confidence_score numeric DEFAULT 1.0,
  created_at timestamptz DEFAULT now()
);

-- 4. Resolved Fields Table
CREATE TABLE IF NOT EXISTS resolved_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  field_name text NOT NULL,
  final_value text NOT NULL,
  resolved_by uuid, -- Assuming auth.users reference
  resolved_at timestamptz DEFAULT now()
);

-- 5. Documents Table
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL,
  case_id uuid NOT NULL,
  template_id uuid NOT NULL, -- Could reference templates(id)
  file_name text NOT NULL,
  storage_path text NOT NULL,
  version int DEFAULT 1,
  generated_by uuid,
  generated_at timestamptz DEFAULT now()
);

-- 6. Print Rules Table
CREATE TABLE IF NOT EXISTS print_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES templates(id),
  default_print_mode text CHECK (default_print_mode IN ('single','duplex')),
  paper_size text DEFAULT 'A4',
  copies int DEFAULT 1
);

-- RLS Policies (Basic Structure - Assuming 'profiles' table exists and links user to firm_id)
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_variables ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE resolved_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_rules ENABLE ROW LEVEL SECURITY;

-- Example Policies (Adjust based on actual auth schema)
-- Allow read/write if user belongs to the same firm_id
-- For now, just a placeholder policy structure

CREATE POLICY "Enable read access for authenticated users based on firm_id" ON templates
FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles WHERE firm_id = templates.firm_id));

CREATE POLICY "Enable insert for authenticated users based on firm_id" ON templates
FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE firm_id = templates.firm_id));

-- (Repeat similar policies for other tables if needed, or rely on application logic for MVP)
