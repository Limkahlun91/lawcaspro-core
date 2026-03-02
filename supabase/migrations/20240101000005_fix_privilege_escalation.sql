-- 1. Create a Trigger Function to prevent Privilege Escalation
-- This ensures that even if RLS allows the update, users cannot modify sensitive columns
CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_columns()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if sensitive columns are being modified
    IF (NEW.role IS DISTINCT FROM OLD.role) OR (NEW.firm_id IS DISTINCT FROM OLD.firm_id) THEN
        -- If the user is updating their OWN profile via the API (auth.uid() matches)
        -- We strictly FORBID role/firm changes for self-updates
        IF auth.uid() = OLD.id THEN
            RAISE EXCEPTION 'You are not allowed to change your own Role or Firm.';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach Trigger to Profiles
DROP TRIGGER IF EXISTS tr_protect_profile_columns ON public.profiles;
CREATE TRIGGER tr_protect_profile_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_sensitive_profile_columns();

-- 3. Allow Admins/Founders to manage OTHER users in their firm
-- (This was missing! Currently only self-update is allowed)
CREATE POLICY "Admins can update firm members" ON public.profiles
FOR UPDATE
USING (
    firm_id IN (SELECT firm_id FROM public.profiles WHERE id = auth.uid()) -- Target is in same firm
    AND EXISTS ( -- Executing user is Admin/Founder
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() 
        AND role IN ('Founder', 'Admin')
    )
    AND id != auth.uid() -- Not self (self is handled by own-profile policy + trigger)
)
WITH CHECK (
    firm_id IN (SELECT firm_id FROM public.profiles WHERE id = auth.uid())
);

-- 4. Allow Admins/Founders to DELETE users (e.g. fire staff)
-- (We previously blocked ALL deletes, now we open it for Admins)
DROP POLICY IF EXISTS "Users cannot delete profile" ON public.profiles;

CREATE POLICY "Admins can delete firm members" ON public.profiles
FOR DELETE
USING (
    firm_id IN (SELECT firm_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() 
        AND role IN ('Founder', 'Admin')
    )
    AND id != auth.uid() -- Cannot delete self (prevent accidental lockout)
);
