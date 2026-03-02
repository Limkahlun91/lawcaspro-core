-- ENTERPRISE REVIEW MODE - LEVEL 6 (KMS SaaS Edition)
-- Date: 2026-03-02
-- Description: Security Hardening, RLS, and RPC Implementation

-- ==========================================
-- 1. ENABLE ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Enable RLS on Core Tables
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_purchasers ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_borrowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_spa_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_compliance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_voucher_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_assignments ENABLE ROW LEVEL SECURITY;

-- Helper Function for RLS (Firm Isolation)
CREATE OR REPLACE FUNCTION public.get_auth_firm_id() RETURNS uuid AS $$
  SELECT (auth.jwt() ->> 'firm_id')::uuid;
$$ LANGUAGE sql STABLE;

-- RLS Policies (Generic Template for Firm Isolation)
-- CASES
CREATE POLICY "Cases Isolation Select" ON cases FOR SELECT USING (firm_id = public.get_auth_firm_id());
CREATE POLICY "Cases Isolation Insert" ON cases FOR INSERT WITH CHECK (firm_id = public.get_auth_firm_id());
CREATE POLICY "Cases Isolation Update" ON cases FOR UPDATE USING (firm_id = public.get_auth_firm_id());
CREATE POLICY "Cases Isolation Delete" ON cases FOR DELETE USING (firm_id = public.get_auth_firm_id());

-- CASE PROPERTIES
CREATE POLICY "Properties Isolation Select" ON case_properties FOR SELECT USING (firm_id = public.get_auth_firm_id());
CREATE POLICY "Properties Isolation Insert" ON case_properties FOR INSERT WITH CHECK (firm_id = public.get_auth_firm_id());
CREATE POLICY "Properties Isolation Update" ON case_properties FOR UPDATE USING (firm_id = public.get_auth_firm_id());

-- CASE PURCHASERS
CREATE POLICY "Purchasers Isolation Select" ON case_purchasers FOR SELECT USING (firm_id = public.get_auth_firm_id());
CREATE POLICY "Purchasers Isolation Insert" ON case_purchasers FOR INSERT WITH CHECK (firm_id = public.get_auth_firm_id());
CREATE POLICY "Purchasers Isolation Update" ON case_purchasers FOR UPDATE USING (firm_id = public.get_auth_firm_id());

-- CASE LOANS
CREATE POLICY "Loans Isolation Select" ON case_loans FOR SELECT USING (firm_id = public.get_auth_firm_id());
CREATE POLICY "Loans Isolation Insert" ON case_loans FOR INSERT WITH CHECK (firm_id = public.get_auth_firm_id());
CREATE POLICY "Loans Isolation Update" ON case_loans FOR UPDATE USING (firm_id = public.get_auth_firm_id());

-- PROJECT COMPLIANCE
CREATE POLICY "Compliance Isolation Select" ON project_compliance_records FOR SELECT USING (firm_id = public.get_auth_firm_id());
CREATE POLICY "Compliance Isolation Insert" ON project_compliance_records FOR INSERT WITH CHECK (firm_id = public.get_auth_firm_id());

-- ==========================================
-- 2. TRANSACTIONAL RPC (create_full_case)
-- ==========================================

CREATE OR REPLACE FUNCTION create_full_case(
    p_title TEXT,
    p_description TEXT,
    p_file_ref TEXT,
    p_status TEXT,
    p_project_id BIGINT,
    p_developer_id BIGINT,
    p_purchase_mode TEXT,
    p_unit_category TEXT,
    p_spa_price NUMERIC,
    p_apdl_price NUMERIC,
    p_developer_discount NUMERIC,
    p_is_bumiputra BOOLEAN,
    p_approved_purchase_price NUMERIC,
    p_client_name_legacy TEXT,
    p_client_ic_encrypted_legacy TEXT,
    p_unit_no_legacy TEXT,
    p_properties JSONB,
    p_purchasers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with owner privileges to bypass RLS during complex inserts if needed, but we check firm_id
AS $$
DECLARE
    v_firm_id UUID;
    v_user_id UUID;
    v_case_id BIGINT;
    v_purchaser JSONB;
BEGIN
    -- 1. Identity & Context
    v_firm_id := public.get_auth_firm_id();
    v_user_id := auth.uid();

    IF v_firm_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: No Firm ID found in JWT';
    END IF;

    -- 2. Insert Core Case
    INSERT INTO cases (
        title, description, file_ref, status, firm_id, created_by,
        project_id, developer_id,
        purchase_mode, unit_category, spa_price, apdl_price, developer_discount, is_bumiputra, approved_purchase_price,
        client, client_ic_encrypted, unit_no
    ) VALUES (
        p_title, p_description, p_file_ref, p_status, v_firm_id, v_user_id,
        p_project_id, p_developer_id,
        p_purchase_mode, p_unit_category, p_spa_price, p_apdl_price, p_developer_discount, p_is_bumiputra, p_approved_purchase_price,
        p_client_name_legacy, p_client_ic_encrypted_legacy, p_unit_no_legacy
    ) RETURNING id INTO v_case_id;

    -- 3. Insert Property (Smart Layout Engine)
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
        );
    END IF;

    -- 4. Insert Purchasers (Purchaser Engine)
    IF p_purchasers IS NOT NULL AND jsonb_array_length(p_purchasers) > 0 THEN
        FOR v_purchaser IN SELECT * FROM jsonb_array_elements(p_purchasers)
        LOOP
            INSERT INTO case_purchasers (
                case_id, firm_id, sequence_no,
                name, id_no, is_company, tin_no, contact_no, email,
                address_line_1, address_line_2, city, state, postcode, country
            ) VALUES (
                v_case_id, v_firm_id, (v_purchaser->>'sequence_no')::int,
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
                COALESCE(v_purchaser->>'country', 'Malaysia')
            );
        END LOOP;
    END IF;

    -- 5. Initialize SPA Status (Process Flow)
    INSERT INTO case_spa_status (case_id, firm_id) VALUES (v_case_id, v_firm_id);

    -- 6. Return Result
    RETURN jsonb_build_object('success', true, 'case_id', v_case_id);

EXCEPTION WHEN OTHERS THEN
    RAISE; -- Transaction rolls back automatically
END;
$$;

-- ==========================================
-- 3. CROSS-FIRM INTEGRITY TRIGGERS
-- ==========================================

-- Trigger Function: Prevent Cross-Firm PV Items
CREATE OR REPLACE FUNCTION check_pv_item_firm_integrity()
RETURNS TRIGGER AS $$
DECLARE
    v_case_firm_id UUID;
    v_pv_firm_id UUID;
BEGIN
    -- Get PV Firm ID
    SELECT firm_id INTO v_pv_firm_id FROM payment_vouchers WHERE id = NEW.pv_id;
    
    -- Check 1: Item must match PV's firm
    IF NEW.firm_id != v_pv_firm_id THEN
        RAISE EXCEPTION 'Integrity Error: PV Item firm_id (%) does not match PV firm_id (%)', NEW.firm_id, v_pv_firm_id;
    END IF;

    -- Check 2: If Case ID is present, Case must match Firm
    IF NEW.case_id IS NOT NULL THEN
        SELECT firm_id INTO v_case_firm_id FROM cases WHERE id = NEW.case_id;
        IF v_case_firm_id != NEW.firm_id THEN
             RAISE EXCEPTION 'Integrity Error: Case firm_id (%) does not match PV Item firm_id (%)', v_case_firm_id, NEW.firm_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger Definition
DROP TRIGGER IF EXISTS trg_check_pv_item_firm ON payment_voucher_items;
CREATE TRIGGER trg_check_pv_item_firm
BEFORE INSERT OR UPDATE ON payment_voucher_items
FOR EACH ROW EXECUTE FUNCTION check_pv_item_firm_integrity();

