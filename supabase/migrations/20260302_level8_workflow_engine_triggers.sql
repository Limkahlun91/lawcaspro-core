-- Level 8: Trigger Bindings (Corrected)
-- Trigger functions must be created before triggers.

-- 1. Create Function: Auto-Generate Tasks on SPA Date
CREATE OR REPLACE FUNCTION trg_func_on_spa_date_set()
RETURNS TRIGGER AS $$
DECLARE
    v_firm_id UUID;
    v_assigned_lawyer UUID;
BEGIN
    -- Only trigger if spa_date was null and is now set OR changed
    IF (OLD.spa_date IS NULL AND NEW.spa_date IS NOT NULL) OR (OLD.spa_date IS DISTINCT FROM NEW.spa_date) THEN
        
        -- Get firm_id from case
        SELECT firm_id INTO v_firm_id FROM cases WHERE id = NEW.case_id;
        
        -- Try to find assigned lawyer
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

        -- 2. Auto-Generate Task: Stamping (If not exists)
        IF NOT EXISTS (SELECT 1 FROM case_tasks WHERE case_id = NEW.case_id AND title = 'Submit for Stamping (LHDN)') THEN
            INSERT INTO case_tasks (
                case_id, firm_id, title, description, task_type, 
                assigned_to, due_date, priority, auto_generated, status
            ) VALUES (
                NEW.case_id, 
                v_firm_id, 
                'Submit for Stamping (LHDN)', 
                'SPA Date has been set. Please proceed with LHDN adjudication and stamping.', 
                'Submission',
                v_assigned_lawyer,
                NOW() + INTERVAL '3 days', -- Urgent
                'High',
                TRUE,
                'Pending'
            );
        END IF;

        -- 3. Auto-Generate Task: CKHT (If not exists)
        IF NOT EXISTS (SELECT 1 FROM case_tasks WHERE case_id = NEW.case_id AND title = 'CKHT 2A/3 Form Submission') THEN
            INSERT INTO case_tasks (
                case_id, firm_id, title, description, task_type, 
                assigned_to, due_date, priority, auto_generated, status
            ) VALUES (
                NEW.case_id, 
                v_firm_id, 
                'CKHT 2A/3 Form Submission', 
                'Prepare and submit CKHT forms.', 
                'Document',
                v_assigned_lawyer,
                NOW() + INTERVAL '14 days',
                'Medium',
                TRUE,
                'Pending'
            );
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Bind Trigger to case_spa_status
DROP TRIGGER IF EXISTS trg_auto_task_spa_date ON case_spa_status;
CREATE TRIGGER trg_auto_task_spa_date
AFTER UPDATE ON case_spa_status
FOR EACH ROW
EXECUTE FUNCTION trg_func_on_spa_date_set();

-- 3. Create Function: Log Workflow Changes
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
            auth.uid(), -- Might be null if triggered by system/RPC without user context? No, SECURITY DEFINER handles permissions but auth.uid() depends on session.
            'Auto-logged via Trigger'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Bind Trigger to cases
DROP TRIGGER IF EXISTS trg_log_workflow ON cases;
CREATE TRIGGER trg_log_workflow
AFTER UPDATE ON cases
FOR EACH ROW
EXECUTE FUNCTION trg_func_log_workflow_change();
