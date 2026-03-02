-- 1. Add Soft Delete column
ALTER TABLE public.cases
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Drop legacy policies to rebuild them
DROP POLICY IF EXISTS "Firm Isolation Policy" ON public.cases;
DROP POLICY IF EXISTS "Users cannot delete cases" ON public.cases;

-- 3. Standard Access (Select): Filter out deleted rows
CREATE POLICY "Firm Isolation Standard Select" ON public.cases
FOR SELECT
USING (
    firm_id IN (SELECT firm_id FROM public.profiles WHERE id = auth.uid())
    AND deleted_at IS NULL
);

-- 4. Standard Access (Update): Can only update active records
CREATE POLICY "Firm Isolation Standard Update" ON public.cases
FOR UPDATE
USING (
    firm_id IN (SELECT firm_id FROM public.profiles WHERE id = auth.uid())
    AND deleted_at IS NULL
)
WITH CHECK (
    firm_id IN (SELECT firm_id FROM public.profiles WHERE id = auth.uid())
);

-- 5. Standard Access (Insert): Can insert new records (deleted_at is NULL by default)
CREATE POLICY "Firm Isolation Standard Insert" ON public.cases
FOR INSERT
WITH CHECK (
    firm_id IN (SELECT firm_id FROM public.profiles WHERE id = auth.uid())
);

-- 6. Admin Hard Delete (Founder/Admin/Partner ONLY)
-- Allows physical deletion, but restricted to high-level roles within the same firm
CREATE POLICY "Admin Hard Delete" ON public.cases
FOR DELETE
USING (
    firm_id IN (SELECT firm_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('Founder', 'Admin', 'Partner')
    )
);
