-- 1. Ensure profiles table exists and has firm_id
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT,
  firm_id UUID REFERENCES public.firms(id),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- 2. Add firm_id if missing (idempotent check)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'firm_id') THEN
        ALTER TABLE public.profiles ADD COLUMN firm_id UUID REFERENCES public.firms(id);
    END IF;
END $$;

-- 3. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

-- 4. Policies

-- Profiles: Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

-- Profiles: Users can update their own profile (Security Fix)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
    ON public.profiles 
    FOR UPDATE 
    USING (auth.uid() = id) 
    WITH CHECK (auth.uid() = id);

-- Cases: Firm Isolation Policy with WRITE PROTECTION (Critical Security Fix)
DROP POLICY IF EXISTS "Firm Isolation Policy" ON public.cases;
CREATE POLICY "Firm Isolation Policy" ON public.cases
    FOR ALL
    USING (
        firm_id IN (
            SELECT firm_id FROM public.profiles WHERE id = auth.uid()
        )
    )
    WITH CHECK (
        firm_id IN (
            SELECT firm_id FROM public.profiles WHERE id = auth.uid()
        )
    );

-- 5. JWT Claim Injection Hook (Advanced)
-- Instructions: Go to Supabase Dashboard -> Auth -> Hooks -> MFA/Custom Claims -> Select this function
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
  DECLARE
    claims jsonb;
    user_firm_id uuid;
    user_role text;
  BEGIN
    -- Check if the user is a firm member
    SELECT firm_id, role INTO user_firm_id, user_role FROM public.profiles WHERE id = (event->>'user_id')::uuid;

    claims := event->'claims';

    IF user_firm_id IS NOT NULL THEN
      -- Inject firm_id into app_metadata
      claims := jsonb_set(claims, '{app_metadata, firm_id}', to_jsonb(user_firm_id));
      -- Inject role into app_metadata
      claims := jsonb_set(claims, '{app_metadata, role}', to_jsonb(user_role));
    END IF;

    -- Update the claims
    event := jsonb_set(event, '{claims}', claims);

    RETURN event;
  END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO service_role;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
