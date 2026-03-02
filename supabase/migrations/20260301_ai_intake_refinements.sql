-- 20260301_ai_intake_refinements.sql

-- Update temp_case_staging to match v1.0 architecture
ALTER TABLE temp_case_staging 
ADD COLUMN IF NOT EXISTS file_type text CHECK (file_type IN ('IC','LO')),
ADD COLUMN IF NOT EXISTS raw_text text;

-- (Optional) If raw_source was used before, we can keep it or migrate data. 
-- For now, we just add the new columns.
