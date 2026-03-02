-- Add B-tree index on firm_id to optimize the initial filter step
-- Postgres will likely use this index to filter by firm_id before using the GIN index for trigram matching
-- or combine them using a BitmapAnd.
CREATE INDEX IF NOT EXISTS idx_cases_firm_id ON cases (firm_id);
