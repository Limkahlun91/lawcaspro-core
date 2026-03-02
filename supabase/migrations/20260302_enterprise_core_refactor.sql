-- ENTERPRISE CORE REFACTOR MIGRATION
-- Date: 2026-03-02
-- Description: Implementation of Level 5 Enterprise Architecture

-- 1. Project Metadata Engine
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS firm_id UUID REFERENCES firms(id),
ADD COLUMN IF NOT EXISTS project_type TEXT CHECK (project_type IN ('LANDED', 'HIGHRISE', 'TOWNHOUSE', 'COMMERCIAL', 'INDUSTRIAL', 'MIXED')),
ADD COLUMN IF NOT EXISTS title_type TEXT CHECK (title_type IN ('FREEHOLD', 'LEASEHOLD')),
ADD COLUMN IF NOT EXISTS title_sub_type TEXT CHECK (title_sub_type IN ('MASTER', 'INDIVIDUAL', 'STRATA')),
ADD COLUMN IF NOT EXISTS land_use TEXT,
ADD COLUMN IF NOT EXISTS development_condition TEXT;

-- 2. Compliance Engine (AP/DL)
CREATE TABLE IF NOT EXISTS project_compliance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id BIGINT REFERENCES projects(id) NOT NULL,
    firm_id UUID REFERENCES firms(id) NOT NULL, -- Denormalized for RLS
    document_type TEXT NOT NULL CHECK (document_type IN ('AP', 'DL')),
    reference_no TEXT NOT NULL,
    issue_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- 3. Case Governance Engine
ALTER TABLE cases
ADD COLUMN IF NOT EXISTS developer_id BIGINT REFERENCES developers(id),
ADD COLUMN IF NOT EXISTS purchase_mode TEXT CHECK (purchase_mode IN ('CASH', 'LOAN', 'OTHERS')),
ADD COLUMN IF NOT EXISTS unit_category TEXT CHECK (unit_category IN ('RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL')),
ADD COLUMN IF NOT EXISTS apdl_price NUMERIC,
ADD COLUMN IF NOT EXISTS developer_discount NUMERIC,
ADD COLUMN IF NOT EXISTS is_bumiputra BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS approved_purchase_price NUMERIC;

-- 4. Property Smart Layout Engine
CREATE TABLE IF NOT EXISTS case_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id BIGINT REFERENCES cases(id) NOT NULL,
    firm_id UUID REFERENCES firms(id) NOT NULL,
    developer_parcel_no TEXT,
    building_type TEXT,
    unit_type TEXT,
    land_area NUMERIC,
    build_up_area NUMERIC,
    parcel_area NUMERIC,
    storey_no TEXT,
    building_no TEXT,
    car_park_no TEXT,
    car_park_level TEXT,
    accessory_parcel_no TEXT,
    share_units TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Purchaser Engine
CREATE TABLE IF NOT EXISTS case_purchasers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id BIGINT REFERENCES cases(id) NOT NULL,
    firm_id UUID REFERENCES firms(id) NOT NULL,
    sequence_no INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    id_no TEXT,
    is_company BOOLEAN DEFAULT false,
    tin_no TEXT,
    contact_no TEXT,
    email TEXT,
    address_line_1 TEXT,
    address_line_2 TEXT,
    city TEXT,
    state TEXT,
    postcode TEXT,
    country TEXT DEFAULT 'Malaysia',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Loan Engine
CREATE TABLE IF NOT EXISTS case_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id BIGINT REFERENCES cases(id) NOT NULL,
    firm_id UUID REFERENCES firms(id) NOT NULL,
    party_type TEXT CHECK (party_type IN ('1ST', '3RD')), -- 1st Party (Purchaser=Borrower) or 3rd Party
    bank_name TEXT,
    bank_ref TEXT,
    branch_address TEXT,
    property_financing_sum NUMERIC,
    others_amount NUMERIC,
    legal_fees NUMERIC,
    total_loan NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS case_borrowers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_loan_id UUID REFERENCES case_loans(id) NOT NULL,
    firm_id UUID REFERENCES firms(id) NOT NULL,
    sequence_no INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    id_no TEXT,
    contact_no TEXT,
    email TEXT,
    address_line_1 TEXT,
    address_line_2 TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. SPA Status (Process Flow)
CREATE TABLE IF NOT EXISTS case_spa_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id BIGINT REFERENCES cases(id) NOT NULL,
    firm_id UUID REFERENCES firms(id) NOT NULL,
    spa_date DATE,
    spa_stamping_date DATE,
    completion_date DATE,
    extended_completion_date DATE,
    actual_vp_date DATE,
    defect_liability_months INTEGER,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Payment Voucher Refactor
-- Creating Items table for multi-case support
CREATE TABLE IF NOT EXISTS payment_voucher_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pv_id UUID REFERENCES payment_vouchers(id) NOT NULL,
    firm_id UUID REFERENCES firms(id) NOT NULL,
    case_id BIGINT REFERENCES cases(id), -- Optional, PV can be general
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Case Assignments (RLS)
CREATE TABLE IF NOT EXISTS case_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id BIGINT REFERENCES cases(id) NOT NULL,
    firm_id UUID REFERENCES firms(id) NOT NULL,
    staff_id UUID REFERENCES auth.users(id) NOT NULL,
    role_type TEXT CHECK (role_type IN ('LAWYER', 'CLERK', 'PARTNER')),
    assigned_at TIMESTAMPTZ DEFAULT now(),
    assigned_by UUID REFERENCES auth.users(id)
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_case_purchasers_case_id ON case_purchasers(case_id);
CREATE INDEX IF NOT EXISTS idx_case_properties_case_id ON case_properties(case_id);
CREATE INDEX IF NOT EXISTS idx_case_loans_case_id ON case_loans(case_id);
CREATE INDEX IF NOT EXISTS idx_pv_items_pv_id ON payment_voucher_items(pv_id);
CREATE INDEX IF NOT EXISTS idx_case_assignments_staff_id ON case_assignments(staff_id);
CREATE INDEX IF NOT EXISTS idx_projects_firm_id ON projects(firm_id);
