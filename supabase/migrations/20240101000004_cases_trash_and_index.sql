-- 1. Indexing (Critical for RLS performance)
CREATE INDEX IF NOT EXISTS idx_cases_firm_deleted
ON public.cases (firm_id, deleted_at);

-- 2. Refine UPDATE Policy: Prevent Standard Users from Soft Deleting
DROP POLICY IF EXISTS "Firm Isolation Standard Update" ON public.cases;
CREATE POLICY "Firm Isolation Standard Update" ON public.cases
FOR UPDATE
USING (
    firm_id IN (SELECT firm_id FROM public.profiles WHERE id = auth.uid())
    AND deleted_at IS NULL -- Can only update active records
)
WITH CHECK (
    firm_id IN (SELECT firm_id FROM public.profiles WHERE id = auth.uid())
    AND deleted_at IS NULL -- Cannot set deleted_at (soft delete)
);

-- 3. Admin Soft Delete: Allow Founder/Admin/Partner to set deleted_at
CREATE POLICY "Admin Soft Delete" ON public.cases
FOR UPDATE
USING (
    firm_id IN (SELECT firm_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('Founder', 'Admin', 'Partner')
    )
)
WITH CHECK (
    firm_id IN (SELECT firm_id FROM public.profiles WHERE id = auth.uid())
    -- No deleted_at restriction here, allowing them to archive
);

-- 4. Admin View Trash: Allow Founder/Admin/Partner to see deleted records
-- Note: This overlaps with standard select, but standard select enforces deleted_at IS NULL
-- So we need a separate policy for viewing deleted items.
CREATE POLICY "Admin View All (Including Deleted)" ON public.cases
FOR SELECT
USING (
    firm_id IN (SELECT firm_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('Founder', 'Admin', 'Partner')
    )
);
