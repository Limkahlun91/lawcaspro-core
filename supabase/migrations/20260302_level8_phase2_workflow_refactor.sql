-- Level 8 Phase 2: Structured Workflow Refactor (Corrected)
-- 1. Create 'case_workflow_stages' (avoid conflict with existing 'workflow_stages')
-- 2. Refactor 'cases' to use stage_id (FK)
-- 3. Drop 'Hidden Logic' Triggers
-- 4. Create 'process_workflow_event' RPC

-- ==========================================
-- 1. Create 'case_workflow_stages'
-- ==========================================
CREATE TABLE IF NOT EXISTS case_workflow_stages (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    sequence INTEGER NOT NULL,
    is_terminal BOOLEAN DEFAULT FALSE,
    default_sla_days INTEGER DEFAULT 14,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Standard Legal Workflow Stages
INSERT INTO case_workflow_stages (name, sequence, is_terminal, default_sla_days) VALUES
('Opening', 1, FALSE, 7),
('SPA Drafting', 2, FALSE, 5),
('SPA Signing', 3, FALSE, 14),
('Stamping', 4, FALSE, 14), -- LHDN Adjudication
('Loan Documentation', 5, FALSE, 30),
('Advice to Release', 6, FALSE, 7),
('Full Release', 7, FALSE, 14),
('Completion', 8, TRUE, 0),
('Archived', 9, TRUE, 0)
ON CONFLICT (name) DO NOTHING;

-- ==========================================
-- 2. Refactor 'cases' Table
-- ==========================================
-- Add stage_id
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS stage_id INTEGER REFERENCES case_workflow_stages(id);

-- Migrate existing text stages to IDs
UPDATE cases c
SET stage_id = ws.id
FROM case_workflow_stages ws
WHERE c.stage = ws.name;

-- Set default to 'Opening' if null
UPDATE cases 
SET stage_id = (SELECT id FROM case_workflow_stages WHERE name = 'Opening')
WHERE stage_id IS NULL;

-- ==========================================
-- 3. Drop Dangerous Triggers
-- ==========================================
DROP TRIGGER IF EXISTS trg_auto_task_spa_date ON case_spa_status;
DROP FUNCTION IF EXISTS trg_func_on_spa_date_set;

-- ==========================================
-- 4. Logic in RPC (Explicit Workflow Engine)
-- ==========================================

-- Helper RPC to handle Workflow Events explicitly
CREATE OR REPLACE FUNCTION process_workflow_event(
    p_case_id BIGINT,
    p_event_type TEXT, -- 'SPA_DATE_SET', 'LOAN_APPROVED', etc.
    p_firm_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_stage_id INTEGER;
    v_stamping_stage_id INTEGER;
    v_assigned_lawyer UUID;
    v_current_stage_seq INTEGER;
BEGIN
    -- Get assigned lawyer
    SELECT staff_id INTO v_assigned_lawyer 
    FROM case_assignments 
    WHERE case_id = p_case_id AND role_type = 'LAWYER' 
    LIMIT 1;

    -- Event: SPA Date Set -> Move to Stamping
    IF p_event_type = 'SPA_DATE_SET' THEN
        SELECT id, sequence INTO v_stamping_stage_id, v_current_stage_seq 
        FROM case_workflow_stages WHERE name = 'Stamping';

        -- Update Case Stage (Only if not already further ahead)
        UPDATE cases 
        SET stage_id = v_stamping_stage_id,
            stage_status = 'Pending',
            sla_due_date = NOW() + (SELECT default_sla_days FROM case_workflow_stages WHERE id = v_stamping_stage_id) * INTERVAL '1 day'
        WHERE id = p_case_id 
        AND stage_id IN (SELECT id FROM case_workflow_stages WHERE sequence < v_current_stage_seq);

        -- Generate Task: Stamping
        INSERT INTO case_tasks (
            case_id, firm_id, title, description, task_type, 
            assigned_to, due_date, priority, auto_generated, status
        ) VALUES (
            p_case_id, p_firm_id, 
            'Submit for Stamping (LHDN)', 
            'SPA Date set. Proceed with adjudication.', 
            'Submission',
            v_assigned_lawyer,
            NOW() + INTERVAL '3 days',
            'High',
            TRUE,
            'Pending'
        ) ON CONFLICT DO NOTHING;

        -- Generate Task: CKHT
        INSERT INTO case_tasks (
            case_id, firm_id, title, description, task_type, 
            assigned_to, due_date, priority, auto_generated, status
        ) VALUES (
            p_case_id, p_firm_id, 
            'CKHT 2A/3 Form Submission', 
            'Prepare CKHT forms.', 
            'Document',
            v_assigned_lawyer,
            NOW() + INTERVAL '14 days',
            'Medium',
            TRUE,
            'Pending'
        ) ON CONFLICT DO NOTHING;
    END IF;
END;
$$;

-- Update 'update_full_case' to call the workflow engine
CREATE OR REPLACE FUNCTION update_full_case(
    p_case_id BIGINT,
    p_case_updates JSONB DEFAULT NULL,
    p_property_updates JSONB DEFAULT NULL,
    p_purchasers JSONB[] DEFAULT NULL,
    p_spa_status_updates JSONB DEFAULT NULL,
    p_loans JSONB[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_project_id BIGINT;
    v_spa_date DATE;
    v_current_firm_id UUID;
    v_case_firm_id UUID;
    v_purchaser JSONB;
    v_loan JSONB;
    v_pur_id UUID;
    v_loan_id UUID;
    v_kept_purchaser_ids UUID[] := ARRAY[]::UUID[];
    v_kept_loan_ids UUID[] := ARRAY[]::UUID[];
    v_old_spa_date DATE;
BEGIN
    -- 1. Authorization & Existence Check
    SELECT firm_id, project_id INTO v_case_firm_id, v_project_id
    FROM cases WHERE id = p_case_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Case not found';
    END IF;

    v_current_firm_id := (auth.jwt() ->> 'firm_id')::UUID;
    
    IF v_current_firm_id IS NOT NULL AND v_case_firm_id != v_current_firm_id THEN
         RAISE EXCEPTION 'Unauthorized: Case belongs to another firm';
    END IF;

    -- 2. Governance Check
    IF p_purchasers IS NOT NULL THEN
        IF array_length(p_purchasers, 1) IS NULL OR array_length(p_purchasers, 1) < 1 THEN
            RAISE EXCEPTION 'Governance Violation: A case must have at least one purchaser.';
        END IF;
    END IF;

    -- 3. Compliance Check & State Tracking
    IF p_spa_status_updates ? 'spa_date' THEN
        v_spa_date := (p_spa_status_updates ->> 'spa_date')::DATE;
        
        -- Get old date for change detection
        SELECT spa_date INTO v_old_spa_date FROM case_spa_status WHERE case_id = p_case_id;

        IF v_spa_date IS NOT NULL THEN
            -- Check AP
            IF EXISTS (SELECT 1 FROM project_compliance_records WHERE project_id = v_project_id AND document_type = 'AP' AND status = 'Active') THEN
                IF NOT EXISTS (
                    SELECT 1 FROM project_compliance_records 
                    WHERE project_id = v_project_id 
                    AND document_type = 'AP'
                    AND status = 'Active'
                    AND v_spa_date BETWEEN issue_date AND expiry_date
                ) THEN
                    RAISE EXCEPTION 'Compliance Violation: SPA Date % is not covered by any active Advertising Permit (AP)', v_spa_date;
                END IF;
            END IF;

            -- Check DL
            IF EXISTS (SELECT 1 FROM project_compliance_records WHERE project_id = v_project_id AND document_type = 'DL' AND status = 'Active') THEN
                IF NOT EXISTS (
                    SELECT 1 FROM project_compliance_records 
                    WHERE project_id = v_project_id 
                    AND document_type = 'DL'
                    AND status = 'Active'
                    AND v_spa_date BETWEEN issue_date AND expiry_date
                ) THEN
                    RAISE EXCEPTION 'Compliance Violation: SPA Date % is not covered by any active Developer License (DL)', v_spa_date;
                END IF;
            END IF;
        END IF;
    END IF;

    -- 4. Update 'cases' Table
    IF p_case_updates IS NOT NULL THEN
        UPDATE cases 
        SET 
            unit_no = COALESCE((p_case_updates->>'unit_no'), unit_no),
            spa_price = COALESCE((p_case_updates->>'spa_price')::numeric, spa_price),
            client = COALESCE((p_case_updates->>'client'), client),
            fileRef = COALESCE((p_case_updates->>'fileRef'), fileRef),
            purchase_mode = COALESCE((p_case_updates->>'purchase_mode'), purchase_mode),
            unit_category = COALESCE((p_case_updates->>'unit_category'), unit_category),
            is_bumiputra = COALESCE((p_case_updates->>'is_bumiputra')::boolean, is_bumiputra),
            updated_at = NOW()
        WHERE id = p_case_id;
    END IF;

    -- 5. Update 'case_properties'
    IF p_property_updates IS NOT NULL THEN
        IF (p_property_updates->>'id') IS NOT NULL THEN
            UPDATE case_properties SET
                developer_parcel_no = COALESCE(p_property_updates->>'developer_parcel_no', developer_parcel_no),
                building_type = COALESCE(p_property_updates->>'building_type', building_type),
                unit_type = COALESCE(p_property_updates->>'unit_type', unit_type),
                land_area = COALESCE((p_property_updates->>'land_area')::numeric, land_area),
                build_up_area = COALESCE((p_property_updates->>'build_up_area')::numeric, build_up_area),
                parcel_area = COALESCE((p_property_updates->>'parcel_area')::numeric, parcel_area),
                storey_no = COALESCE(p_property_updates->>'storey_no', storey_no),
                building_no = COALESCE(p_property_updates->>'building_no', building_no),
                car_park_no = COALESCE(p_property_updates->>'car_park_no', car_park_no),
                car_park_level = COALESCE(p_property_updates->>'car_park_level', car_park_level),
                accessory_parcel_no = COALESCE(p_property_updates->>'accessory_parcel_no', accessory_parcel_no),
                share_units = COALESCE(p_property_updates->>'share_units', share_units)
            WHERE id = (p_property_updates->>'id')::uuid AND case_id = p_case_id;
        ELSE
            UPDATE case_properties SET
                developer_parcel_no = COALESCE(p_property_updates->>'developer_parcel_no', developer_parcel_no),
                building_type = COALESCE(p_property_updates->>'building_type', building_type),
                unit_type = COALESCE(p_property_updates->>'unit_type', unit_type),
                land_area = COALESCE((p_property_updates->>'land_area')::numeric, land_area),
                build_up_area = COALESCE((p_property_updates->>'build_up_area')::numeric, build_up_area),
                parcel_area = COALESCE((p_property_updates->>'parcel_area')::numeric, parcel_area),
                storey_no = COALESCE(p_property_updates->>'storey_no', storey_no),
                building_no = COALESCE(p_property_updates->>'building_no', building_no),
                car_park_no = COALESCE(p_property_updates->>'car_park_no', car_park_no),
                car_park_level = COALESCE(p_property_updates->>'car_park_level', car_park_level),
                accessory_parcel_no = COALESCE(p_property_updates->>'accessory_parcel_no', accessory_parcel_no),
                share_units = COALESCE(p_property_updates->>'share_units', share_units)
            WHERE case_id = p_case_id;
            
            IF NOT FOUND THEN
                 INSERT INTO case_properties (
                    case_id, firm_id, 
                    developer_parcel_no, building_type, unit_type, 
                    land_area, build_up_area, parcel_area, 
                    storey_no, building_no, car_park_no, car_park_level, 
                    accessory_parcel_no, share_units
                )
                VALUES (
                    p_case_id, v_case_firm_id,
                    p_property_updates->>'developer_parcel_no',
                    p_property_updates->>'building_type',
                    p_property_updates->>'unit_type',
                    (p_property_updates->>'land_area')::numeric,
                    (p_property_updates->>'build_up_area')::numeric,
                    (p_property_updates->>'parcel_area')::numeric,
                    p_property_updates->>'storey_no',
                    p_property_updates->>'building_no',
                    p_property_updates->>'car_park_no',
                    p_property_updates->>'car_park_level',
                    p_property_updates->>'accessory_parcel_no',
                    p_property_updates->>'share_units'
                );
            END IF;
        END IF;
    END IF;

    -- 6. Update 'case_spa_status' & TRIGGER WORKFLOW
    IF p_spa_status_updates IS NOT NULL THEN
        INSERT INTO case_spa_status (
            case_id, firm_id, 
            spa_date, spa_stamping_date, completion_date, 
            extended_completion_date, actual_vp_date, defect_liability_months
        )
        VALUES (
            p_case_id,
            v_case_firm_id,
            (p_spa_status_updates->>'spa_date')::date,
            (p_spa_status_updates->>'spa_stamping_date')::date,
            (p_spa_status_updates->>'completion_date')::date,
            (p_spa_status_updates->>'extended_completion_date')::date,
            (p_spa_status_updates->>'actual_vp_date')::date,
            (p_spa_status_updates->>'defect_liability_months')::int
        )
        ON CONFLICT (case_id) DO UPDATE SET
            spa_date = EXCLUDED.spa_date,
            spa_stamping_date = EXCLUDED.spa_stamping_date,
            completion_date = EXCLUDED.completion_date,
            extended_completion_date = EXCLUDED.extended_completion_date,
            actual_vp_date = EXCLUDED.actual_vp_date,
            defect_liability_months = EXCLUDED.defect_liability_months,
            updated_at = NOW();

        -- 🔥 EXPLICIT WORKFLOW TRIGGER
        -- If SPA Date was Set/Changed, trigger workflow event
        IF v_spa_date IS NOT NULL AND (v_old_spa_date IS NULL OR v_old_spa_date IS DISTINCT FROM v_spa_date) THEN
            PERFORM process_workflow_event(p_case_id, 'SPA_DATE_SET', v_case_firm_id);
        END IF;
    END IF;

    -- 7. Purchasers Sync
    IF p_purchasers IS NOT NULL THEN
        FOREACH v_purchaser IN ARRAY p_purchasers
        LOOP
            IF (v_purchaser->>'id') IS NOT NULL AND (v_purchaser->>'id') != '' THEN
                v_pur_id := (v_purchaser->>'id')::uuid;
                UPDATE case_purchasers SET
                    name = COALESCE(v_purchaser->>'name', name),
                    id_no = COALESCE(v_purchaser->>'id_no', id_no),
                    is_company = COALESCE((v_purchaser->>'is_company')::boolean, is_company),
                    tin_no = COALESCE(v_purchaser->>'tin_no', tin_no),
                    contact_no = COALESCE(v_purchaser->>'contact_no', contact_no),
                    email = COALESCE(v_purchaser->>'email', email),
                    address_line_1 = COALESCE(v_purchaser->>'address_line_1', address_line_1),
                    address_line_2 = COALESCE(v_purchaser->>'address_line_2', address_line_2),
                    city = COALESCE(v_purchaser->>'city', city),
                    state = COALESCE(v_purchaser->>'state', state),
                    postcode = COALESCE(v_purchaser->>'postcode', postcode),
                    country = COALESCE(v_purchaser->>'country', country),
                    sequence_no = COALESCE((v_purchaser->>'sequence_no')::int, sequence_no)
                WHERE id = v_pur_id AND case_id = p_case_id;
                
                IF FOUND THEN
                    v_kept_purchaser_ids := array_append(v_kept_purchaser_ids, v_pur_id);
                END IF;
            ELSE
                INSERT INTO case_purchasers (
                    case_id, firm_id, name, id_no, is_company, tin_no, 
                    contact_no, email, address_line_1, address_line_2, 
                    city, state, postcode, country, sequence_no
                ) VALUES (
                    p_case_id, v_case_firm_id,
                    v_purchaser->>'name',
                    v_purchaser->>'id_no',
                    (v_purchaser->>'is_company')::boolean,
                    v_purchaser->>'tin_no',
                    v_purchaser->>'contact_no',
                    v_purchaser->>'email',
                    v_purchaser->>'address_line_1',
                    v_purchaser->>'address_line_2',
                    v_purchaser->>'city',
                    v_purchaser->>'state',
                    v_purchaser->>'postcode',
                    COALESCE(v_purchaser->>'country', 'Malaysia'),
                    (v_purchaser->>'sequence_no')::int
                ) RETURNING id INTO v_pur_id;
                v_kept_purchaser_ids := array_append(v_kept_purchaser_ids, v_pur_id);
            END IF;
        END LOOP;

        DELETE FROM case_purchasers 
        WHERE case_id = p_case_id AND id != ALL(v_kept_purchaser_ids);
    END IF;

    -- 8. Loans Sync
    IF p_loans IS NOT NULL THEN
        FOREACH v_loan IN ARRAY p_loans
        LOOP
             IF (v_loan->>'id') IS NOT NULL AND (v_loan->>'id') != '' THEN
                v_loan_id := (v_loan->>'id')::uuid;
                UPDATE case_loans SET
                    party_type = COALESCE(v_loan->>'party_type', party_type),
                    bank_name = COALESCE(v_loan->>'bank_name', bank_name),
                    bank_ref = COALESCE(v_loan->>'bank_ref', bank_ref),
                    branch_address = COALESCE(v_loan->>'branch_address', branch_address),
                    property_financing_sum = COALESCE((v_loan->>'property_financing_sum')::numeric, property_financing_sum),
                    others_amount = COALESCE((v_loan->>'others_amount')::numeric, others_amount),
                    legal_fees = COALESCE((v_loan->>'legal_fees')::numeric, legal_fees),
                    total_loan = COALESCE((v_loan->>'total_loan')::numeric, total_loan)
                WHERE id = v_loan_id AND case_id = p_case_id;
                
                IF FOUND THEN
                    v_kept_loan_ids := array_append(v_kept_loan_ids, v_loan_id);
                END IF;
             ELSE
                INSERT INTO case_loans (
                    case_id, firm_id, party_type, bank_name, bank_ref, branch_address,
                    property_financing_sum, others_amount, legal_fees, total_loan
                ) VALUES (
                    p_case_id, v_case_firm_id,
                    v_loan->>'party_type',
                    v_loan->>'bank_name',
                    v_loan->>'bank_ref',
                    v_loan->>'branch_address',
                    (v_loan->>'property_financing_sum')::numeric,
                    (v_loan->>'others_amount')::numeric,
                    (v_loan->>'legal_fees')::numeric,
                    (v_loan->>'total_loan')::numeric
                ) RETURNING id INTO v_loan_id;
                v_kept_loan_ids := array_append(v_kept_loan_ids, v_loan_id);
             END IF;
        END LOOP;
        
        DELETE FROM case_loans
        WHERE case_id = p_case_id AND id != ALL(v_kept_loan_ids);
    END IF;

    RETURN jsonb_build_object('success', true, 'case_id', p_case_id);
END;
$$;
