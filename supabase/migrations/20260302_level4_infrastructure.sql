-- Level 4 Financial-Grade Infrastructure
-- 1. Mapping Snapshot (Audit Trail for Logic)

ALTER TABLE public.generated_documents
ADD COLUMN mapping_snapshot JSONB DEFAULT NULL;

COMMENT ON COLUMN public.generated_documents.mapping_snapshot IS 'Snapshot of the field-to-variable mapping used at generation time';
COMMENT ON COLUMN public.generated_documents.file_hash IS 'SHA-256 Hash of the generated file content for integrity verification';
