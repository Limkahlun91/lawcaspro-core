-- 20260226_lawcaspro_2_0_backend_v2.sql
-- IMPROVED VERSION: Security Hardening & Logic Enhancements

-- ==========================================
-- 1. Workflow Engine Tables
-- ==========================================

CREATE TABLE IF NOT EXISTS workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    case_type TEXT NOT NULL,
    description TEXT,
    firm_id UUID, -- NULL = global template
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES workflow_templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    stage_order INTEGER NOT NULL,
    is_final BOOLEAN DEFAULT FALSE,
    firm_id UUID, -- NULL if template is global
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_stage_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_stage_id UUID REFERENCES workflow_stages(id) ON DELETE CASCADE,
    to_stage_id UUID REFERENCES workflow_stages(id) ON DELETE CASCADE,
    allow_backward BOOLEAN DEFAULT FALSE,
    require_role TEXT,
    firm_id UUID, -- NULL if template is global
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_stage_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID REFERENCES workflow_stages(id) ON DELETE CASCADE,
    trigger_type TEXT CHECK (trigger_type IN ('CREATE_TASK', 'CREATE_DEADLINE', 'GOV_SUBMISSION', 'CREATE_INVOICE')),
    trigger_payload JSONB,
    firm_id UUID, -- NULL if template is global
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Case Instance Tables

CREATE TABLE IF NOT EXISTS case_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL, -- Assumes 'cases' table exists
    template_id UUID REFERENCES workflow_templates(id),
    firm_id UUID NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS case_current_stage (
    case_id UUID PRIMARY KEY,
    stage_id UUID REFERENCES workflow_stages(id),
    firm_id UUID NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS case_stage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL,
    firm_id UUID NOT NULL,
    from_stage UUID REFERENCES workflow_stages(id),
    to_stage UUID REFERENCES workflow_stages(id),
    changed_by UUID REFERENCES auth.users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_workflows_case_id ON case_workflows(case_id);
CREATE INDEX IF NOT EXISTS idx_case_current_stage_stage_id ON case_current_stage(stage_id);
CREATE INDEX IF NOT EXISTS idx_case_stage_history_case_id ON case_stage_history(case_id);

-- ==========================================
-- 2. Task & Deadline Engine
-- ==========================================

CREATE TABLE IF NOT EXISTS task_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    auto_assign_role TEXT,
    firm_id UUID, -- NULL for global
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS case_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL,
    firm_id UUID NOT NULL,
    title TEXT NOT NULL,
    assigned_to UUID REFERENCES auth.users(id),
    due_date TIMESTAMP WITH TIME ZONE,
    status TEXT CHECK (status IN ('PENDING', 'DONE', 'CANCELLED')) DEFAULT 'PENDING',
    source TEXT CHECK (source IN ('MANUAL', 'WORKFLOW')) DEFAULT 'MANUAL',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deadline_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES workflow_templates(id) ON DELETE CASCADE,
    reference_field TEXT NOT NULL, -- e.g., 'spa_date', 'writ_date'
    offset_days INTEGER NOT NULL,
    description TEXT,
    firm_id UUID, -- NULL for global
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS case_deadlines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL,
    firm_id UUID NOT NULL,
    title TEXT NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT CHECK (status IN ('UPCOMING', 'OVERDUE', 'COMPLETED')) DEFAULT 'UPCOMING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_case_deadlines_due_date ON case_deadlines(due_date);

-- ==========================================
-- 3. Government Integration Layer
-- ==========================================

CREATE TABLE IF NOT EXISTS gov_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT CHECK (provider IN ('LHDN', 'STAMPS', 'CKHT')),
    firm_id UUID NOT NULL,
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gov_api_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL,
    provider TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gov_submission_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL,
    firm_id UUID NOT NULL,
    provider TEXT NOT NULL,
    submission_type TEXT NOT NULL,
    payload JSONB,
    status TEXT CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED')) DEFAULT 'PENDING',
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gov_submission_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID REFERENCES gov_submission_queue(id),
    firm_id UUID NOT NULL,
    request_payload JSONB,
    response_payload JSONB,
    http_status INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gov_queue_status ON gov_submission_queue(status);
CREATE INDEX IF NOT EXISTS idx_gov_queue_provider ON gov_submission_queue(provider);

-- 2️⃣ GOV_QUEUE Unique Constraint to prevent duplicate submissions
CREATE UNIQUE INDEX IF NOT EXISTS idx_gov_queue_unique_active 
ON gov_submission_queue (case_id, provider, submission_type) 
WHERE status IN ('PENDING', 'PROCESSING');

-- ==========================================
-- 4. RLS Policies
-- ==========================================

-- Enable RLS
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_stage_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_stage_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_current_stage ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE deadline_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_deadlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE gov_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gov_api_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE gov_submission_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE gov_submission_logs ENABLE ROW LEVEL SECURITY;

-- Policies (Standard read access based on firm_id)
CREATE POLICY "Access Workflow Templates" ON workflow_templates FOR ALL USING (firm_id IS NULL OR firm_id = public.get_user_firm_id());
CREATE POLICY "Access Workflow Stages" ON workflow_stages FOR ALL USING (firm_id IS NULL OR firm_id = public.get_user_firm_id());
CREATE POLICY "Access Workflow Transitions" ON workflow_stage_transitions FOR ALL USING (firm_id IS NULL OR firm_id = public.get_user_firm_id());
CREATE POLICY "Access Workflow Triggers" ON workflow_stage_triggers FOR ALL USING (firm_id IS NULL OR firm_id = public.get_user_firm_id());

CREATE POLICY "Access Case Workflows" ON case_workflows FOR ALL USING (firm_id = public.get_user_firm_id());
CREATE POLICY "Access Case Current Stage" ON case_current_stage FOR ALL USING (firm_id = public.get_user_firm_id());
CREATE POLICY "Access Case Stage History" ON case_stage_history FOR ALL USING (firm_id = public.get_user_firm_id());

CREATE POLICY "Access Task Templates" ON task_templates FOR ALL USING (firm_id IS NULL OR firm_id = public.get_user_firm_id());
CREATE POLICY "Access Case Tasks" ON case_tasks FOR ALL USING (firm_id = public.get_user_firm_id());
CREATE POLICY "Access Deadline Rules" ON deadline_rules FOR ALL USING (firm_id IS NULL OR firm_id = public.get_user_firm_id());
CREATE POLICY "Access Case Deadlines" ON case_deadlines FOR ALL USING (firm_id = public.get_user_firm_id());

CREATE POLICY "Access Gov Integrations" ON gov_integrations FOR ALL USING (firm_id = public.get_user_firm_id());
CREATE POLICY "Access Gov Tokens" ON gov_api_tokens FOR ALL USING (firm_id = public.get_user_firm_id());
CREATE POLICY "Access Gov Queue" ON gov_submission_queue FOR ALL USING (firm_id = public.get_user_firm_id());
CREATE POLICY "Access Gov Logs" ON gov_submission_logs FOR ALL USING (firm_id = public.get_user_firm_id());

-- ==========================================
-- 5. Functions (SECURITY HARDENED)
-- ==========================================

-- 6. Enforce Stage Transition Validation
CREATE OR REPLACE FUNCTION validate_stage_transition(p_from_stage UUID, p_to_stage UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_transition RECORD;
    v_user_role TEXT;
    v_from_template UUID;
    v_to_template UUID;
BEGIN
    -- 1. 3️⃣ Stage Order Validation: Ensure both stages belong to same template
    SELECT template_id INTO v_from_template FROM workflow_stages WHERE id = p_from_stage;
    SELECT template_id INTO v_to_template FROM workflow_stages WHERE id = p_to_stage;

    IF v_from_template IS DISTINCT FROM v_to_template THEN
        RAISE EXCEPTION 'Cross-template transition not allowed';
    END IF;

    -- 2. Get Transition Config
    SELECT * INTO v_transition 
    FROM workflow_stage_transitions 
    WHERE from_stage_id = p_from_stage AND to_stage_id = p_to_stage;
    
    IF NOT FOUND THEN
        RETURN FALSE; -- Transition not allowed
    END IF;

    -- 3. Check Role Requirement
    IF v_transition.require_role IS NOT NULL THEN
        -- Get User Role
        SELECT role INTO v_user_role FROM firm_users WHERE user_id = p_user_id LIMIT 1;
        
        -- Check if user has required role
        IF v_user_role IS NULL OR v_user_role != v_transition.require_role THEN
             -- Allow Founder/Partner/Admin to override
             IF v_user_role NOT IN ('Founder', 'Partner', 'Admin') THEN
                 RETURN FALSE;
             END IF;
        END IF;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Event-Driven Trigger Function (HARDENED)
CREATE OR REPLACE FUNCTION handle_stage_change(
    p_case_id UUID,
    p_new_stage_id UUID,
    p_user_id UUID -- Passed explicitly
)
RETURNS JSONB AS $$
DECLARE
    v_old_stage_id UUID;
    v_firm_id UUID;
    v_user_firm_id UUID;
    v_trigger RECORD;
    v_valid_transition BOOLEAN;
    v_deadline_date DATE;
    v_ref_date DATE;
    v_query TEXT;
BEGIN
    -- 1. ❹ Stage Ownership Validation (Horizontal Privilege Escalation Check)
    -- Verify user belongs to the firm that owns the case
    -- Get Case Firm ID (Assuming cases table exists and has firm_id)
    SELECT firm_id INTO v_firm_id FROM cases WHERE id = p_case_id;
    
    -- If cases table not found or firm_id missing, try case_workflows as backup source of truth
    IF v_firm_id IS NULL THEN
        SELECT firm_id INTO v_firm_id FROM case_workflows WHERE case_id = p_case_id LIMIT 1;
    END IF;

    IF v_firm_id IS NULL THEN
        RAISE EXCEPTION 'Case Firm ID not found';
    END IF;

    -- Get User Firm ID
    SELECT firm_id INTO v_user_firm_id FROM firm_users WHERE user_id = p_user_id LIMIT 1;

    IF v_user_firm_id IS NULL OR v_user_firm_id != v_firm_id THEN
        RAISE EXCEPTION 'Unauthorized: User does not belong to Case Firm';
    END IF;

    -- 2. ❸ Lock Row to prevent Race Condition
    -- Improved Lock: Lock Workflow Instance to handle first-stage concurrency
    PERFORM 1 FROM case_workflows WHERE case_id = p_case_id FOR UPDATE;

    SELECT stage_id INTO v_old_stage_id 
    FROM case_current_stage 
    WHERE case_id = p_case_id; 
    -- Note: Row lock on case_workflows covers the concurrency control for the whole case workflow state.

    -- 3. Validate Transition (if not first stage)
    IF v_old_stage_id IS NOT NULL THEN
        v_valid_transition := validate_stage_transition(v_old_stage_id, p_new_stage_id, p_user_id);
        IF NOT v_valid_transition THEN
            RAISE EXCEPTION 'Invalid Stage Transition or Insufficient Permissions';
        END IF;
    END IF;

    -- 4. Update Tables
    -- Insert History
    INSERT INTO case_stage_history (case_id, firm_id, from_stage, to_stage, changed_by, changed_at)
    VALUES (p_case_id, v_firm_id, v_old_stage_id, p_new_stage_id, p_user_id, NOW());

    -- Update Current Stage
    INSERT INTO case_current_stage (case_id, stage_id, firm_id, updated_at)
    VALUES (p_case_id, p_new_stage_id, v_firm_id, NOW())
    ON CONFLICT (case_id) 
    DO UPDATE SET stage_id = EXCLUDED.stage_id, updated_at = NOW();

    -- 5. Check Triggers
    FOR v_trigger IN SELECT * FROM workflow_stage_triggers WHERE stage_id = p_new_stage_id LOOP
        
        IF v_trigger.trigger_type = 'CREATE_TASK' THEN
            INSERT INTO case_tasks (case_id, firm_id, title, status, source, created_at)
            VALUES (p_case_id, v_firm_id, v_trigger.trigger_payload->>'title', 'PENDING', 'WORKFLOW', NOW());
            
        ELSIF v_trigger.trigger_type = 'CREATE_DEADLINE' THEN
            -- 1️⃣ Logic for deadline calculation: Dynamic Field Lookup
            v_deadline_date := NULL;
            
            -- Check if payload specifies a reference field (or lookup deadline_rules)
            -- For simplicity, payload can contain "ref_field"
            IF v_trigger.trigger_payload->>'ref_field' IS NOT NULL THEN
                 -- 🛡️ Whitelist Validation for Dynamic SQL
                 IF v_trigger.trigger_payload->>'ref_field' NOT IN ('spa_date', 'writ_date', 'loan_approval_date', 'completion_date') THEN
                     RAISE EXCEPTION 'Invalid reference field: %', v_trigger.trigger_payload->>'ref_field';
                 END IF;

                 -- Dynamic SQL to fetch date from cases table
                 -- Requires `cases` table to have the column
                 v_query := format('SELECT %I FROM cases WHERE id = %L', v_trigger.trigger_payload->>'ref_field', p_case_id);
                 BEGIN
                     EXECUTE v_query INTO v_ref_date;
                 EXCEPTION WHEN OTHERS THEN
                     v_ref_date := NULL; -- Fallback if column missing or error
                 END;
            END IF;

            -- Calculate Due Date
            IF v_ref_date IS NOT NULL THEN
                v_deadline_date := v_ref_date + ((v_trigger.trigger_payload->>'days')::int || ' days')::interval;
            ELSE
                -- Fallback to NOW() if no ref date found
                v_deadline_date := NOW() + ((v_trigger.trigger_payload->>'days')::int || ' days')::interval;
            END IF;

            INSERT INTO case_deadlines (case_id, firm_id, title, due_date, status, created_at)
            VALUES (
                p_case_id, 
                v_firm_id, 
                v_trigger.trigger_payload->>'title', 
                v_deadline_date,
                'UPCOMING',
                NOW()
            );

        ELSIF v_trigger.trigger_type = 'GOV_SUBMISSION' THEN
            -- 2️⃣ Insert with ON CONFLICT DO NOTHING to utilize unique index
            INSERT INTO gov_submission_queue (case_id, firm_id, provider, submission_type, payload, status, created_at)
            VALUES (
                p_case_id, 
                v_firm_id, 
                v_trigger.trigger_payload->>'provider', 
                v_trigger.trigger_payload->>'type', 
                v_trigger.trigger_payload, -- Pass full payload
                'PENDING',
                NOW()
            )
            ON CONFLICT (case_id, provider, submission_type) WHERE status IN ('PENDING', 'PROCESSING')
            DO NOTHING; -- Avoid duplicates

        ELSIF v_trigger.trigger_type = 'CREATE_INVOICE' THEN
            -- Placeholder for invoice
            NULL; 
        END IF;

    END LOOP;

    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- 6. Seed Data (Conveyancing Global Workflow)
-- ==========================================

DO $$
DECLARE
    v_template_id UUID;
    v_s1 UUID;
    v_s2 UUID;
    v_s3 UUID;
    v_s4 UUID;
    v_s5 UUID;
BEGIN
    -- Create Template
    INSERT INTO workflow_templates (name, case_type, description, firm_id)
    VALUES ('Conveyancing Standard', 'CONVEYANCING', 'Standard SPA to Transfer Process', NULL)
    RETURNING id INTO v_template_id;

    -- Create Stages
    INSERT INTO workflow_stages (template_id, name, stage_order, is_final, firm_id) VALUES 
    (v_template_id, 'SPA Signed', 1, FALSE, NULL) RETURNING id INTO v_s1;
    
    INSERT INTO workflow_stages (template_id, name, stage_order, is_final, firm_id) VALUES 
    (v_template_id, 'Loan Approved', 2, FALSE, NULL) RETURNING id INTO v_s2;

    INSERT INTO workflow_stages (template_id, name, stage_order, is_final, firm_id) VALUES 
    (v_template_id, 'Stamp Submitted', 3, FALSE, NULL) RETURNING id INTO v_s3;

    INSERT INTO workflow_stages (template_id, name, stage_order, is_final, firm_id) VALUES 
    (v_template_id, 'MOT Submitted', 4, FALSE, NULL) RETURNING id INTO v_s4;

    INSERT INTO workflow_stages (template_id, name, stage_order, is_final, firm_id) VALUES 
    (v_template_id, 'Registration Completed', 5, TRUE, NULL) RETURNING id INTO v_s5;

    -- Create Transitions (Sequential)
    INSERT INTO workflow_stage_transitions (from_stage_id, to_stage_id, firm_id) VALUES
    (v_s1, v_s2, NULL),
    (v_s2, v_s3, NULL),
    (v_s3, v_s4, NULL),
    (v_s4, v_s5, NULL);

    -- Create Triggers
    -- 1. SPA Signed -> CREATE_DEADLINE (CKHT +60 days) - Uses SPA_DATE reference ideally
    INSERT INTO workflow_stage_triggers (stage_id, trigger_type, trigger_payload, firm_id)
    VALUES (v_s1, 'CREATE_DEADLINE', '{"title": "CKHT Submission Deadline", "days": 60, "ref_field": "spa_date"}', NULL);

    -- 2. Stamp Submitted -> GOV_SUBMISSION (STAMPS API)
    INSERT INTO workflow_stage_triggers (stage_id, trigger_type, trigger_payload, firm_id)
    VALUES (v_s3, 'GOV_SUBMISSION', '{"provider": "STAMPS", "type": "ADJUDICATION_REQ"}', NULL);

    -- 3. MOT Submitted -> CREATE_TASK (Registration follow-up)
    INSERT INTO workflow_stage_triggers (stage_id, trigger_type, trigger_payload, firm_id)
    VALUES (v_s4, 'CREATE_TASK', '{"title": "Follow up on MOT Registration"}', NULL);

    -- 4. Registration Completed -> CREATE_INVOICE (Final Billing)
    INSERT INTO workflow_stage_triggers (stage_id, trigger_type, trigger_payload, firm_id)
    VALUES (v_s5, 'CREATE_INVOICE', '{"type": "FINAL_BILL"}', NULL);

END $$;

-- Grants
GRANT EXECUTE ON FUNCTION handle_stage_change TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION validate_stage_transition TO authenticated, service_role;
