-- 1. Enforce firm_id NOT NULL on cases
ALTER TABLE public.cases
ALTER COLUMN firm_id SET NOT NULL;

-- 2. Revoke ANON access (Critical Security)
REVOKE ALL ON public.cases FROM anon;
REVOKE ALL ON public.profiles FROM anon;

-- 3. Ensure firm_id is foreign key with CASCADE
-- (First drop existing if needed to ensure correct behavior)
ALTER TABLE public.cases
DROP CONSTRAINT IF EXISTS cases_firm_id_fkey;

ALTER TABLE public.cases
ADD CONSTRAINT cases_firm_id_fkey
FOREIGN KEY (firm_id) REFERENCES public.firms(id)
ON DELETE CASCADE;

-- 4. Enable RLS on Firms table itself (often overlooked)
ALTER TABLE public.firms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view own firm" ON public.firms;
CREATE POLICY "Members can view own firm" ON public.firms
    FOR SELECT
    USING (
        id IN (
            SELECT firm_id FROM public.profiles WHERE id = auth.uid()
        )
    );
