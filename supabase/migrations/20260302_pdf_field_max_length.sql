-- Add max_length column to pdf_field_mappings

ALTER TABLE public.pdf_field_mappings
ADD COLUMN max_length INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.pdf_field_mappings.max_length IS 'Maximum allowed characters for the PDF field';
