-- Level 8 Phase 5: Governance Lockdown & Dashboard Intelligence
-- 1. Fix Fee Engine Isolation (Multi-Tenant Risk)
-- 2. Create Executive Dashboard View (SaaS Product)
-- 3. Prepare Founder Access Control (Sensitive Field Masking)

-- ==========================================
-- 1. Fix Fee Engine Isolation (Multi-Tenant Risk)
-- ==========================================
-- Update calculate_legal_fee to strictly check firm_id
CREATE OR REPLACE FUNCTION calculate_legal_fee(p_spa_price NUMERIC, p_project_id BIGINT)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_fee NUMERIC := 0;
    v_scale RECORD;
    v_tier JSONB;
    v_remaining_price NUMERIC := p_spa_price;
    v_tier_limit NUMERIC;
    v_tier_rate NUMERIC;
    v_prev_limit NUMERIC := 0;
    v_taxable_amount NUMERIC;
    v_current_firm_id UUID;
BEGIN
    -- Get current firm_id from JWT
    v_current_firm_id := (auth.jwt() ->> 'firm_id')::UUID;

    -- 1. Try to find active project-specific scale (WITH FIRM ISOLATION)
    SELECT * INTO v_scale 
    FROM project_fee_scales 
    WHERE project_id = p_project_id 
    AND firm_id = v_current_firm_id -- 🔥 Fix: Strict Multi-Tenant Check
    AND is_active = TRUE 
    LIMIT 1;

    -- 2. Fallback to SRO 2023 Logic
    IF v_scale IS NULL THEN
        IF p_spa_price <= 500000 THEN
            RETURN p_spa_price * 0.0125;
        ELSE
            v_fee := 500000 * 0.0125;
            v_fee := v_fee + (p_spa_price - 500000) * 0.01;
            RETURN v_fee;
        END IF;
    END IF;

    -- 3. Calculate based on Configured Scale
    IF v_scale.scale_type = 'FIXED' THEN
        RETURN v_scale.fixed_amount;
    ELSIF v_scale.scale_type = 'PERCENTAGE' THEN
        RETURN p_spa_price * (v_scale.percentage_rate / 100);
    ELSIF v_scale.scale_type = 'TIERED' THEN
        FOR v_tier IN SELECT * FROM jsonb_array_elements(v_scale.tiers)
        LOOP
            v_tier_limit := (v_tier->>'limit')::numeric;
            v_tier_rate := (v_tier->>'rate')::numeric;
            IF v_remaining_price <= 0 THEN EXIT; END IF;
            v_taxable_amount := LEAST(v_remaining_price, v_tier_limit - v_prev_limit);
            v_fee := v_fee + (v_taxable_amount * (v_tier_rate / 100));
            v_remaining_price := v_remaining_price - v_taxable_amount;
            v_prev_limit := v_tier_limit;
        END LOOP;
        IF v_remaining_price > 0 THEN
             v_fee := v_fee + (v_remaining_price * (v_tier_rate / 100));
        END IF;
        RETURN v_fee;
    END IF;

    RETURN 0;
END;
$$;

-- ==========================================
-- 2. Executive Dashboard View (Decision Layer)
-- ==========================================
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

FROM firms f;

-- RLS for Dashboard View
-- Although views usually inherit table RLS, for explicit safety:
-- Since we are querying firms table directly, we should ensure only firm members see their row.
-- But standard RLS on 'firms' table might be tricky if it's public readable.
-- Let's rely on the subqueries using RLS-enabled tables (cases, tasks) which are filtered by firm_id.
-- BUT, we must ensure users can only see *their* firm row in this view.
-- Assuming 'firms' has RLS or we use a wrapper function.
-- Let's create a secure wrapper function to return ONLY the caller's firm data.

CREATE OR REPLACE FUNCTION get_my_executive_dashboard()
RETURNS SETOF view_executive_dashboard
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT * 
    FROM view_executive_dashboard
    WHERE firm_id = (auth.jwt() ->> 'firm_id')::uuid;
$$;

-- ==========================================
-- 3. Founder Access Control (Sensitive Field Masking)
-- ==========================================
-- Create a masked view for sensitive data
CREATE OR REPLACE VIEW view_cases_masked AS
SELECT 
    id,
    firm_id,
    project_id,
    unit_no,
    spa_price,
    stage_id,
    stage_status,
    sla_due_date,
    -- Mask Sensitive Fields
    CASE 
        WHEN (auth.jwt() ->> 'role') = 'founder' THEN '***-***-****' -- Mask for Founder
        ELSE client_ic_encrypted -- Show (encrypted) for Lawyer (decryption happens in App level or via specific RPC)
    END as client_ic_display,
    client -- Name might be okay, but strict privacy might mask this too.
FROM cases;

-- Audit Log for "Unlock" (Preparation)
CREATE TABLE IF NOT EXISTS access_unlock_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    firm_id UUID REFERENCES firms(id),
    target_case_id BIGINT REFERENCES cases(id),
    reason TEXT NOT NULL,
    access_token TEXT, -- Temporary token
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE access_unlock_logs ENABLE ROW LEVEL SECURITY;
