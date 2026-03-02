-- Level 7 Phase 1 Audit Fixes: Hardening RPCs
-- 1. Harden create_full_case RPC (Search Path + Governance Check)
-- 2. Harden update_full_case RPC (Search Path + Governance Check)

-- ==========================================
-- 1. Harden create_full_case
-- ==========================================
CREATE OR REPLACE FUNCTION create_full_case(
    p_title TEXT,
    p_description TEXT DEFAULT NULL,
    p_file_ref TEXT DEFAULT NULL,
    p_status TEXT DEFAULT 'Open',
    p_project_id BIGINT DEFAULT NULL,
    p_developer_id BIGINT DEFAULT NULL,
    p_purchase_mode TEXT DEFAULT NULL,
    p_unit_category TEXT DEFAULT NULL,
    p_spa_price NUMERIC DEFAULT NULL,
    p_apdl_price NUMERIC DEFAULT NULL,
    p_developer_discount NUMERIC DEFAULT NULL,
    p_is_bumiputra BOOLEAN DEFAULT FALSE,
    p_approved_purchase_price NUMERIC DEFAULT NULL,
    p_client_name_legacy TEXT DEFAULT NULL,
    p_client_ic_encrypted_legacy TEXT DEFAULT NULL,
    p_unit_no_legacy TEXT DEFAULT NULL,
    p_properties JSONB DEFAULT NULL,
    p_purchasers JSONB[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public -- 🛡️ Fix: Prevent Search Path Hijacking
AS $$
DECLARE
    v_case_id BIGINT;
    v_firm_id UUID;
    v_user_id UUID;
    v_prop_id UUID;
    v_pur_id UUID;
    v_purchaser JSONB;
BEGIN
    -- 1. Governance Check: Minimum 1 Purchaser
    IF array_length(p_purchasers, 1) IS NULL OR array_length(p_purchasers, 1) < 1 THEN
        RAISE EXCEPTION 'Governance Violation: A case must have at least one purchaser.';
    END IF;

    -- Get Context
    v_firm_id := (auth.jwt() ->> 'firm_id')::UUID;
    v_user_id := auth.uid();

    IF v_firm_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No firm_id in token';
    END IF;

    -- 2. Insert Case
    INSERT INTO cases (
        firm_id, project_id, developer_id,
        title, description, fileRef, status,
        purchase_mode, unit_category, spa_price, apdl_price, developer_discount, is_bumiputra, approved_purchase_price,
        client, client_ic_encrypted, unit_no
        -- Removed created_by as it's not in schema
    ) VALUES (
        v_firm_id, p_project_id, p_developer_id,
        p_title, p_description, p_file_ref, p_status,
        p_purchase_mode, p_unit_category, p_spa_price, p_apdl_price, p_developer_discount, p_is_bumiputra, p_approved_purchase_price,
        p_client_name_legacy, p_client_ic_encrypted_legacy, p_unit_no_legacy
    ) RETURNING id INTO v_case_id;

    -- 3. Insert Property (1:1 for now)
    IF p_properties IS NOT NULL THEN
        INSERT INTO case_properties (
            case_id, firm_id, 
            developer_parcel_no, building_type, unit_type, 
            land_area, build_up_area, parcel_area, 
            storey_no, building_no, car_park_no, car_park_level, 
            accessory_parcel_no, share_units
        ) VALUES (
            v_case_id, v_firm_id,
            p_properties->>'developer_parcel_no',
            p_properties->>'building_type',
            p_properties->>'unit_type',
            (p_properties->>'land_area')::numeric,
            (p_properties->>'build_up_area')::numeric,
            (p_properties->>'parcel_area')::numeric,
            p_properties->>'storey_no',
            p_properties->>'building_no',
            p_properties->>'car_park_no',
            p_properties->>'car_park_level',
            p_properties->>'accessory_parcel_no',
            p_properties->>'share_units'
        ) RETURNING id INTO v_prop_id;
    END IF;

    -- 4. Insert Purchasers
    IF p_purchasers IS NOT NULL THEN
        FOREACH v_purchaser IN ARRAY p_purchasers
        LOOP
            INSERT INTO case_purchasers (
                case_id, firm_id, name, id_no, is_company, tin_no, 
                contact_no, email, address_line_1, address_line_2, 
                city, state, postcode, country, sequence_no
            ) VALUES (
                v_case_id, v_firm_id,
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
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'case_id', v_case_id);
END;
$$;

-- ==========================================
-- 2. Harden update_full_case
-- ==========================================
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
SET search_path = public -- 🛡️ Fix: Prevent Search Path Hijacking
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

    -- 2. Governance Check: Minimum 1 Purchaser (If updating purchasers)
    IF p_purchasers IS NOT NULL THEN
        IF array_length(p_purchasers, 1) IS NULL OR array_length(p_purchasers, 1) < 1 THEN
            RAISE EXCEPTION 'Governance Violation: A case must have at least one purchaser.';
        END IF;
    END IF;

    -- 3. Compliance Check (AP/DL Validity)
    IF p_spa_status_updates ? 'spa_date' THEN
        v_spa_date := (p_spa_status_updates ->> 'spa_date')::DATE;

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

    -- 6. Update 'case_spa_status'
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
