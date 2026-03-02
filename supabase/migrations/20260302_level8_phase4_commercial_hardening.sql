-- Level 8 Phase 4: Commercial Hardening (SLA Idempotency & Fee Engine)
-- 1. Fix SLA Idempotency (Prevent DB Bloat)
-- 2. Implement Commercial Fee Engine (Tiered Scales)
-- 3. Update Revenue View to use Real Fee Logic

-- ==========================================
-- 1. Fix SLA Idempotency
-- ==========================================
-- Add Unique Constraint to allow UPSERT
ALTER TABLE sla_breach_logs 
ADD CONSTRAINT uq_sla_breach_active 
UNIQUE (case_id, stage_id, status); -- Only one 'Open' breach per case/stage

-- Update RPC to handle Idempotency
CREATE OR REPLACE FUNCTION process_daily_sla_check()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_breached_case RECORD;
    v_breach_count INTEGER := 0;
BEGIN
    -- Loop through ALL active cases where SLA is breached
    FOR v_breached_case IN 
        SELECT c.id, c.firm_id, c.stage_id, c.sla_due_date, c.stage_status,
               EXTRACT(DAY FROM (NOW() - c.sla_due_date))::INTEGER as days_overdue,
               ca.staff_id as assigned_lawyer
        FROM cases c
        LEFT JOIN case_assignments ca ON c.id = ca.case_id AND ca.role_type = 'LAWYER'
        WHERE c.sla_due_date < NOW() 
        AND c.stage_status != 'Completed'
        AND c.stage_id NOT IN (SELECT id FROM case_workflow_stages WHERE is_terminal = TRUE)
    LOOP
        -- 1. Log/Update Breach (Idempotent)
        INSERT INTO sla_breach_logs (
            case_id, firm_id, stage_id, sla_due_date, days_overdue, escalation_level, status
        ) VALUES (
            v_breached_case.id,
            v_breached_case.firm_id,
            v_breached_case.stage_id,
            v_breached_case.sla_due_date,
            v_breached_case.days_overdue,
            CASE 
                WHEN v_breached_case.days_overdue > 7 THEN 2 -- Partner Level
                ELSE 1 -- Lawyer Level
            END,
            'Open'
        )
        ON CONFLICT (case_id, stage_id, status) 
        DO UPDATE SET
            days_overdue = EXCLUDED.days_overdue,
            escalation_level = EXCLUDED.escalation_level,
            breach_date = NOW(); -- Update timestamp to show it's still active
        
        -- 2. Create Escalation Task (Idempotent via existing unique index)
        IF v_breached_case.days_overdue > 3 THEN
             INSERT INTO case_tasks (
                case_id, firm_id, title, description, task_type, 
                assigned_to, due_date, priority, auto_generated, status
            ) VALUES (
                v_breached_case.id, 
                v_breached_case.firm_id, 
                'SLA BREACH: Case Overdue', 
                'This case has exceeded its stage SLA by ' || v_breached_case.days_overdue || ' days. Immediate action required.', 
                'Follow-up',
                v_breached_case.assigned_lawyer,
                NOW() + INTERVAL '1 day',
                'Critical',
                TRUE,
                'Pending'
            )
            ON CONFLICT (case_id, title) WHERE auto_generated = TRUE DO NOTHING;
        END IF;

        v_breach_count := v_breach_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'breached_cases_processed', v_breach_count);
END;
$$;

-- ==========================================
-- 2. Commercial Fee Engine
-- ==========================================
CREATE TABLE IF NOT EXISTS project_fee_scales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id BIGINT REFERENCES projects(id) ON DELETE CASCADE,
    firm_id UUID REFERENCES firms(id) NOT NULL,
    name TEXT NOT NULL, -- e.g. "SRO 2023", "Developer Promo Rate"
    scale_type TEXT CHECK (scale_type IN ('FIXED', 'TIERED', 'PERCENTAGE')),
    fixed_amount NUMERIC DEFAULT 0,
    percentage_rate NUMERIC DEFAULT 0,
    tiers JSONB DEFAULT NULL, -- e.g. [{"limit": 500000, "rate": 1.0}, {"limit": 1000000, "rate": 0.8}]
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE project_fee_scales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Firms manage own fee scales" ON project_fee_scales
    FOR ALL USING (firm_id = (auth.jwt() ->> 'firm_id')::uuid);

-- Fee Calculation Function
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
BEGIN
    -- 1. Try to find active project-specific scale
    SELECT * INTO v_scale 
    FROM project_fee_scales 
    WHERE project_id = p_project_id AND is_active = TRUE 
    LIMIT 1;

    -- 2. Fallback to SRO 2023 Logic (Hardcoded Standard if no specific scale)
    -- SRO 2023: First 500k @ 1.25%, Next 7M @ 1.0%... (Simplified for Demo)
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
        -- Basic Tiered Logic (Iterate JSONB)
        -- Assumes sorted JSON: [{"limit": 500000, "rate": 1.0}, ...]
        FOR v_tier IN SELECT * FROM jsonb_array_elements(v_scale.tiers)
        LOOP
            v_tier_limit := (v_tier->>'limit')::numeric;
            v_tier_rate := (v_tier->>'rate')::numeric;
            
            IF v_remaining_price <= 0 THEN EXIT; END IF;

            -- Determine amount in this tier
            v_taxable_amount := LEAST(v_remaining_price, v_tier_limit - v_prev_limit);
            
            v_fee := v_fee + (v_taxable_amount * (v_tier_rate / 100));
            v_remaining_price := v_remaining_price - v_taxable_amount;
            v_prev_limit := v_tier_limit;
        END LOOP;
        
        -- Remainder (if price exceeds max tier)
        IF v_remaining_price > 0 THEN
             -- Apply last rate or default? Let's assume last rate for now
             v_fee := v_fee + (v_remaining_price * (v_tier_rate / 100));
        END IF;
        
        RETURN v_fee;
    END IF;

    RETURN 0;
END;
$$;

-- ==========================================
-- 3. Upgrade Revenue View
-- ==========================================
DROP VIEW IF EXISTS view_case_revenue_recognition;

CREATE OR REPLACE VIEW view_case_revenue_recognition AS
SELECT 
    c.firm_id,
    c.project_id,
    p.name as project_name,
    COUNT(c.id) as total_cases,
    SUM(c.spa_price) as total_gdv,
    -- 🔥 Use Dynamic Fee Calculation
    SUM(calculate_legal_fee(c.spa_price, c.project_id)) as total_potential_fees,
    
    -- Recognized Revenue
    SUM(
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
    ) as recognized_revenue
FROM cases c
JOIN case_workflow_stages ws ON c.stage_id = ws.id
JOIN projects p ON c.project_id = p.id
GROUP BY c.firm_id, c.project_id, p.name;
