-- 20260301_two_stage_intake.sql

-- 1. Temporary Staging Table
CREATE TABLE IF NOT EXISTS temp_case_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL,
  raw_source text, -- 'IC_UPLOAD', 'LO_UPLOAD', 'BOOKING_FORM'
  extracted_json jsonb NOT NULL,
  ai_confidence numeric,
  status text DEFAULT 'pending', -- 'pending', 'confirmed', 'rejected'
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

-- RLS for Staging
ALTER TABLE temp_case_staging ENABLE ROW LEVEL SECURITY;

-- Placeholder Policy (Adjust based on actual auth schema)
CREATE POLICY "Enable read access for authenticated users based on firm_id" ON temp_case_staging
FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles WHERE firm_id = temp_case_staging.firm_id));

CREATE POLICY "Enable insert for authenticated users based on firm_id" ON temp_case_staging
FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE firm_id = temp_case_staging.firm_id));

CREATE POLICY "Enable update for authenticated users based on firm_id" ON temp_case_staging
FOR UPDATE USING (auth.uid() IN (SELECT id FROM profiles WHERE firm_id = temp_case_staging.firm_id));

-- Note: case_data_sources table already created in previous migration
-- Note: cases table assumed to exist

