-- Level 8 Phase 6 Fix: Hardening Unlock Logic
-- Correcting the logic flaw where non-founders were not explicitly rejected

CREATE OR REPLACE FUNCTION request_case_unlock(p_case_id BIGINT, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_firm_id UUID;
    v_role TEXT;
BEGIN
    -- Only Founder can request unlock (Staff have access by default, so they don't need this)
    v_role := (auth.jwt() ->> 'role')::text;
    
    IF v_role IS NULL OR v_role != 'founder' THEN
         RAISE EXCEPTION 'Unauthorized: Only Founder can request security unlock.'; 
    END IF;

    -- Check case ownership
    SELECT firm_id INTO v_firm_id FROM cases WHERE id = p_case_id;
    
    IF v_firm_id IS NULL THEN
        RAISE EXCEPTION 'Case not found';
    END IF;

    IF v_firm_id != (auth.jwt() ->> 'firm_id')::uuid THEN
        RAISE EXCEPTION 'Unauthorized: Case belongs to another firm';
    END IF;

    -- Log Unlock (1 Hour Duration)
    INSERT INTO access_unlock_logs (user_id, firm_id, target_case_id, reason, expires_at)
    VALUES (auth.uid(), v_firm_id, p_case_id, p_reason, NOW() + INTERVAL '1 hour');

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Security Unlock Granted for 1 Hour',
        'expires_at', NOW() + INTERVAL '1 hour'
    );
END;
$$;
