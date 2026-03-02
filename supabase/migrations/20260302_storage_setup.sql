-- Create storage bucket for Legal Documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('legal-docs', 'legal-docs', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'legal-docs');

-- Policy: Allow public read access (or restricted to authenticated)
-- For simplicity in this demo, we make it public read so backend can fetch easily via URL
CREATE POLICY "Allow public read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'legal-docs');

-- Policy: Allow authenticated users to update/delete their own files
CREATE POLICY "Allow individual update/delete"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'legal-docs' AND auth.uid() = owner);
