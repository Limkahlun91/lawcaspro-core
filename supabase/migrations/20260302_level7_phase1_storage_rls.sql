-- Level 7 Phase 1 Audit Fixes: Storage RLS Policies
-- Attempting to create policies without ALTER TABLE (RLS is already enabled)

-- Policy 1: Global Templates (Read-Only for Everyone Authenticated)
CREATE POLICY "Global templates are readable by all authenticated users"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'legal-docs' 
    AND (storage.foldername(name))[1] = 'global'
);

-- Policy 2: Global Templates (Write for Admins/Founders Only)
CREATE POLICY "Global templates writable by Founders"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'legal-docs' 
    AND (storage.foldername(name))[1] = 'global'
    AND (
        (auth.jwt() ->> 'role')::text = 'founder' 
        OR (auth.jwt() ->> 'role')::text = 'admin'
    )
);

-- Policy 3: Firm Templates (Strict Isolation)
CREATE POLICY "Firm templates isolated access"
ON storage.objects
FOR ALL
TO authenticated
USING (
    bucket_id = 'legal-docs' 
    AND (storage.foldername(name))[1]::uuid = (auth.jwt() ->> 'firm_id')::uuid
)
WITH CHECK (
    bucket_id = 'legal-docs' 
    AND (storage.foldername(name))[1]::uuid = (auth.jwt() ->> 'firm_id')::uuid
);
