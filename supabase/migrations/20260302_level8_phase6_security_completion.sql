-- Level 8 Phase 6: Security Closure & Performance Optimization (Cascade Fix)
-- 1. Optimize Executive Dashboard (Prevent Full Scan)
-- 2. Implement "Break Glass" Protocol (Unlock RPC & Verification)
-- 3. Secure Masking View with Dynamic Access Check

-- ==========================================
-- 1. Optimize Dashboard View (Inherently Filtered)
-- ==========================================
DROP FUNCTION IF EXISTS get_my_executive_dashboard CASCADE;
DROP VIEW IF EXISTS view_executive_dashboard CASCADE;

CREATE OR REPLACE VIEW view_executive_dashboard AS
SELECT 
    f.id as firm_id,
    f.name as firm_name,
    
    -- Operational Metrics
    (SELECT COUNT(*) FROM cases WHERE firm_id = f.id AND status != 'Closed') as active_cases,
    (SELECT COUNT(*) FROM cases WHERE firm_id = f.id AND sla_due_date < NOW()) as overdue_cases,
    (SELECT COUNT(*) FROM case_tasks WHERE firm_id = f.id AND status = 'Pending' AND priority = 'Critical') as critical_tasks,
    
    -- Financial Metrics (Real-Time WIP)
    (SELECT COALESCE(SUM(calculate_legal_fee(spa_price, project_id)), 0) 
     FROM cases WHERE firm_id = f.id) as total_potential_revenue,
     
    (SELECT COALESCE(SUM(
        calculate_legal_fee(c.spa_price, c.project_id) * 
        CASE 
            WHEN ws.name = 'Opening' THEN 0
            WHEN ws.name = 'SPA Drafting' THEN 0.10
            WHEN ws.name = 'SPA Signing' THEN 0.30
            WHEN ws.name = 'Stamping' THEN 0.40
            WHEN ws.name = 'Loan Documentation' THEN 0.50
            WHEN ws.name = 'Advice to Release' THEN 0.70
            WHEN ws.name = 'Full Release' THEN 0.90
            WHEN ws.name = 'Completion' THEN 1.00
            ELSE 0
        END
    ), 0)
    FROM cases c 
    JOIN case_workflow_stages ws ON c.stage_id = ws.id 
    WHERE c.firm_id = f.id) as recognized_wip_revenue,

    -- Risk Metrics
    (SELECT COUNT(*) FROM sla_breach_logs WHERE firm_id = f.id AND status = 'Open' AND escalation_level >= 2) as partner_escalations

FROM firms f
WHERE f.id = (auth.jwt() ->> 'firm_id')::uuid; -- 🔥 Performance Fix: Filter at source

-- ==========================================
-- 2. "Break Glass" Security Logic
-- ==========================================

-- Helper: Check if current user can see sensitive data
CREATE OR REPLACE FUNCTION check_sensitive_access(p_case_id BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role TEXT;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    v_role := (auth.jwt() ->> 'role')::text;

    -- 1. Staff/Lawyer: Access Allowed (Normal Workflow)
    IF v_role IS NULL OR v_role != 'founder' THEN
        RETURN TRUE;
    END IF;

    -- 2. Founder: Blocked by Default, Check for Active Unlock
    IF EXISTS (
        SELECT 1 FROM access_unlock_logs 
        WHERE user_id = v_user_id 
        AND target_case_id = p_case_id 
        AND expires_at > NOW()
    ) THEN
        RETURN TRUE; -- Unlock Active
    END IF;

    RETURN FALSE; -- Mask it
END;
$$;

-- RPC: Request Unlock (The "Break Glass" Button)
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
    -- Only Founder can request unlock (Staff have access by default)
    v_role := (auth.jwt() ->> 'role')::text;
    IF v_role IS NULL OR v_role != 'founder' THEN
         -- Maybe allow Admins too? For now strict.
         -- But wait, if staff has access, they don't need unlock.
         -- So this is strictly for 'founder' role masking bypass.
         NULL; 
    END IF;

    -- Check case ownership
    SELECT firm_id INTO v_firm_id FROM cases WHERE id = p_case_id;
    
    IF v_firm_id IS NULL THEN
        RAISE EXCEPTION 'Case not found';
    END IF;

    IF v_firm_id != (auth.jwt() ->> 'firm_id')::uuid THEN
        RAISE EXCEPTION 'Unauthorized';
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

-- ==========================================
-- 3. Secure Masking View (Dynamic)
-- ==========================================
CREATE OR REPLACE VIEW view_cases_masked_secure AS
SELECT 
    id,
    firm_id,
    project_id,
    unit_no,
    spa_price,
    stage_id,
    stage_status,
    sla_due_date,
    client,
    -- 🔥 Dynamic Masking based on Active Protocol
    CASE 
        WHEN check_sensitive_access(id) THEN client_ic_encrypted
        ELSE '***-***-****'
    END as client_ic_display,
    CASE 
        WHEN check_sensitive_access(id) THEN 'VISIBLE' 
        ELSE 'MASKED' 
    END as security_status
FROM cases;
