-- LEVEL 9 PHASE 3: Enterprise Audit Trigger
-- Created at: 2026-03-03
-- Description: Automated audit logging for critical case fields.

-- 1. Create Trigger Function
CREATE OR REPLACE FUNCTION public.trigger_audit_case_changes()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id UUID;
BEGIN
    -- Get current user ID (Supabase specific)
    current_user_id := auth.uid();
    
    -- If no user (e.g. system update), use NULL or a system user ID if available
    -- We'll just log NULL if no user context found
    
    -- 1. SPA Status Changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO case_audit_logs (case_id, module, field_name, old_value, new_value, changed_by)
        VALUES (NEW.id, 'SPA_STATUS', 'status', OLD.status, NEW.status, current_user_id);
    END IF;

    IF OLD.stage_status IS DISTINCT FROM NEW.stage_status THEN
        INSERT INTO case_audit_logs (case_id, module, field_name, old_value, new_value, changed_by)
        VALUES (NEW.id, 'SPA_STATUS', 'stage_status', OLD.stage_status, NEW.stage_status, current_user_id);
    END IF;

    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
        INSERT INTO case_audit_logs (case_id, module, field_name, old_value, new_value, changed_by)
        VALUES (NEW.id, 'SPA_STATUS', 'stage_id', OLD.stage_id::text, NEW.stage_id::text, current_user_id);
    END IF;

    -- 2. Pricing Changes
    IF OLD.spa_price IS DISTINCT FROM NEW.spa_price THEN
        INSERT INTO case_audit_logs (case_id, module, field_name, old_value, new_value, changed_by)
        VALUES (NEW.id, 'PRICING', 'spa_price', OLD.spa_price::text, NEW.spa_price::text, current_user_id);
    END IF;

    IF OLD.approved_purchase_price IS DISTINCT FROM NEW.approved_purchase_price THEN
        INSERT INTO case_audit_logs (case_id, module, field_name, old_value, new_value, changed_by)
        VALUES (NEW.id, 'PRICING', 'approved_purchase_price', OLD.approved_purchase_price::text, NEW.approved_purchase_price::text, current_user_id);
    END IF;
    
    -- 3. Property Changes
    IF OLD.unit_no IS DISTINCT FROM NEW.unit_no THEN
        INSERT INTO case_audit_logs (case_id, module, field_name, old_value, new_value, changed_by)
        VALUES (NEW.id, 'PROPERTY', 'unit_no', OLD.unit_no, NEW.unit_no, current_user_id);
    END IF;

    IF OLD.unit_category IS DISTINCT FROM NEW.unit_category THEN
        INSERT INTO case_audit_logs (case_id, module, field_name, old_value, new_value, changed_by)
        VALUES (NEW.id, 'PROPERTY', 'unit_category', OLD.unit_category::text, NEW.unit_category::text, current_user_id);
    END IF;

    -- 4. Loan/Financial Changes
    IF OLD.purchase_mode IS DISTINCT FROM NEW.purchase_mode THEN
        INSERT INTO case_audit_logs (case_id, module, field_name, old_value, new_value, changed_by)
        VALUES (NEW.id, 'LOAN', 'purchase_mode', OLD.purchase_mode::text, NEW.purchase_mode::text, current_user_id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach Trigger to cases table
DROP TRIGGER IF EXISTS audit_case_changes_trigger ON cases;
CREATE TRIGGER audit_case_changes_trigger
AFTER UPDATE ON cases
FOR EACH ROW
EXECUTE FUNCTION trigger_audit_case_changes();
