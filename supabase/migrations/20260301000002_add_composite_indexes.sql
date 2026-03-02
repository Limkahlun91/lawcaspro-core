-- Enable pg_trgm extension if not already enabled (it was enabled in previous migration, but good to be safe)
create extension if not exists pg_trgm;

-- Create composite partial index for efficient searching within a firm
-- This index targets queries that filter by firm_id (which is almost all queries in this multi-tenant app)
-- and then perform a trigram search on the client name.
CREATE INDEX if not exists idx_cases_firm_client 
ON cases USING gin (client gin_trgm_ops) 
WHERE firm_id IS NOT NULL;

-- Also adding one for fileRef as it's a common search target
CREATE INDEX if not exists idx_cases_firm_fileref
ON cases USING gin ("fileRef" gin_trgm_ops) 
WHERE firm_id IS NOT NULL;
