-- Level 8: Internal System Optimization - Workflow & Task Engine
-- 1. Upgrade 'cases' table with Workflow columns
-- 2. Create 'case_tasks' table
-- 3. Create 'workflow_logs' table
-- 4. Create Triggers for Auto-Task Generation and Stage Management

-- ==========================================
-- 1. Upgrade 'cases' Table
-- ==========================================
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS stage TEXT DEFAULT 'Opening', -- Opening, SPA Signing, Stamping, Loan Documentation, Advice to Release, Completion
ADD COLUMN IF NOT EXISTS stage_status TEXT DEFAULT 'Pending', -- Pending, In Progress, Completed, Stuck
ADD COLUMN IF NOT EXISTS sla_due_date TIMESTAMPTZ;

-- ==========================================
-- 2. Create 'case_tasks' Table
-- ==========================================
CREATE TABLE IF NOT EXISTS case_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id BIGINT REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    firm_id UUID REFERENCES firms(id) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    task_type TEXT NOT NULL, -- 'Document', 'Follow-up', 'Submission', 'Billing'
    assigned_to UUID REFERENCES auth.users(id),
    due_date TIMESTAMPTZ,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Overdue', 'Cancelled')),
    priority TEXT DEFAULT 'Medium' CHECK (priority IN ('High', 'Medium', 'Low', 'Critical')),
    auto_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES auth.users(id)
);

-- RLS for case_tasks
ALTER TABLE case_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tasks in their firm" ON case_tasks
    FOR SELECT USING (firm_id = (auth.jwt() ->> 'firm_id')::uuid);

CREATE POLICY "Users can insert tasks in their firm" ON case_tasks
    FOR INSERT WITH CHECK (firm_id = (auth.jwt() ->> 'firm_id')::uuid);

CREATE POLICY "Users can update tasks in their firm" ON case_tasks
    FOR UPDATE USING (firm_id = (auth.jwt() ->> 'firm_id')::uuid);

CREATE POLICY "Users can delete tasks in their firm" ON case_tasks
    FOR DELETE USING (firm_id = (auth.jwt() ->> 'firm_id')::uuid);

-- ==========================================
-- 3. Create 'workflow_logs' Table
-- ==========================================
CREATE TABLE IF NOT EXISTS workflow_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id BIGINT REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    firm_id UUID REFERENCES firms(id) NOT NULL,
    previous_stage TEXT,
    new_stage TEXT NOT NULL,
    changed_by UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- RLS for workflow_logs
ALTER TABLE workflow_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view workflow logs in their firm" ON workflow_logs
    FOR SELECT USING (firm_id = (auth.jwt() ->> 'firm_id')::uuid);

-- ==========================================
-- 4. Trigger: Auto-Task on SPA Date (Level 8 Automation)
-- ==========================================
CREATE OR REPLACE FUNCTION trg_func_on_spa_date_set()
RETURNS TRIGGER AS $$
DECLARE
    v_firm_id UUID;
    v_assigned_lawyer UUID;
BEGIN
    -- Only trigger if spa_date was null and is now set
    IF (OLD.spa_date IS NULL AND NEW.spa_date IS NOT NULL) OR (OLD.spa_date != NEW.spa_date) THEN
        
        -- Get firm_id and assigned lawyer from case
        SELECT firm_id INTO v_firm_id FROM cases WHERE id = NEW.case_id;
        
        -- Try to find assigned lawyer (fallback to NULL if none)
        SELECT staff_id INTO v_assigned_lawyer 
        FROM case_assignments 
        WHERE case_id = NEW.case_id AND role_type = 'LAWYER' 
        LIMIT 1;

        -- 1. Auto-Update Case Stage
        UPDATE cases 
        SET stage = 'Stamping', 
            stage_status = 'Pending',
            sla_due_date = NOW() + INTERVAL '14 days' -- Standard SLA for Stamping
        WHERE id = NEW.case_id;

        -- 2. Auto-Generate Task: Stamping
        INSERT INTO case_tasks (
            case_id, firm_id, title, description, task_type, 
            assigned_to, due_date, priority, auto_generated
        ) VALUES (
            NEW.case_id, 
            v_firm_id, 
            'Submit for Stamping (LHDN)', 
            'SPA Date has been set. Please proceed with LHDN adjudication and stamping.', 
            'Submission',
            v_assigned_lawyer,
            NOW() + INTERVAL '3 days', -- Urgent
            'High',
            TRUE
        );

        -- 3. Auto-Generate Task: CKHT
        INSERT INTO case_tasks (
            case_id, firm_id, title, description, task_type, 
            assigned_to, due_date, priority, auto_generated
        ) VALUES (
            NEW.case_id, 
            v_firm_id, 
            'CKHT 2A/3 Form Submission', 
            'Prepare and submit CKHT forms.', 
            'Document',
            v_assigned_lawyer,
            NOW() + INTERVAL '14 days',
            'Medium',
            TRUE
        );

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind Trigger to case_spa_status
DROP TRIGGER IF EXISTS trg_auto_task_spa_date ON case_spa_status;
CREATE TRIGGER trg_auto_task_spa_date
AFTER UPDATE ON case_spa_status
FOR EACH ROW
EXECUTE FUNCTION trg_func_on_spa_date_set();

-- ==========================================
-- 5. Trigger: Log Workflow Changes
-- ==========================================
CREATE OR REPLACE FUNCTION trg_func_log_workflow_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.stage IS DISTINCT FROM NEW.stage) THEN
        INSERT INTO workflow_logs (
            case_id, firm_id, previous_stage, new_stage, changed_by, notes
        ) VALUES (
            NEW.id, 
            NEW.firm_id, 
            OLD.stage, 
            NEW.stage, 
            auth.uid(),
            'Auto-logged via Trigger'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_log_workflow ON cases;
CREATE TRIGGER trg_log_workflow
AFTER UPDATE ON cases
FOR EACH ROW
EXECUTE FUNCTION trg_func_log_workflow_change();
