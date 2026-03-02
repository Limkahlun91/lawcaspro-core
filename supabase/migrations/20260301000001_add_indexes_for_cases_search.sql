-- Enable pg_trgm extension for efficient text search
create extension if not exists pg_trgm;

-- Add columns if they don't exist (handling the user's requirement for client and fileRef)
alter table cases add column if not exists client text;
alter table cases add column if not exists "fileRef" text;

-- Optional: Sync existing data if needed (assuming purchaser_name maps to client)
update cases set client = purchaser_name where client is null;

-- Add GIN indexes for client and fileRef columns to speed up ILIKE queries
create index if not exists idx_cases_client on cases using gin (client gin_trgm_ops);
create index if not exists idx_cases_fileRef on cases using gin ("fileRef" gin_trgm_ops);
