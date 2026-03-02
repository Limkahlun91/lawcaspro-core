-- 1. Hardening: Ensure role is never NULL
-- First, fill any existing NULLs with a safe default (e.g., 'Junior Clerk')
UPDATE public.profiles
SET role = 'Junior Clerk'
WHERE role IS NULL;

-- Then enforce NOT NULL constraint
ALTER TABLE public.profiles
ALTER COLUMN role SET NOT NULL;

-- Set a default for future inserts if not provided
ALTER TABLE public.profiles
ALTER COLUMN role SET DEFAULT 'Junior Clerk';

-- 2. Explicitly DENY profile deletion by users
-- (Even if no policy exists, default is deny, but explicit is better for audit/clarity)
DROP POLICY IF EXISTS "Users cannot delete profile" ON public.profiles;
CREATE POLICY "Users cannot delete profile"
ON public.profiles
FOR DELETE
USING (false);

-- 3. Hardening: Also prevent users from deleting Cases (only Soft Delete usually preferred in SaaS)
-- Or restricted to Admin/Partner. For now, let's explicitly block generic delete to be safe.
-- We can add a specific "Admins can delete cases" policy later if needed.
DROP POLICY IF EXISTS "Users cannot delete cases" ON public.cases;
CREATE POLICY "Users cannot delete cases"
ON public.cases
FOR DELETE
USING (false);
