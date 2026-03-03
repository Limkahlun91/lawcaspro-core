-- LEVEL 9 PHASE 1: Enterprise Core Migration (Revised)
-- Created at: 2026-03-03
-- Description: Complete refactor for Legal ERP compliance. Fixed BigInt/UUID mismatch and Enum conversion.

-- 1. Create ENUMs
DO $$ BEGIN
    CREATE TYPE purchase_mode_enum AS ENUM ('CASH','LOAN','OTHERS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE unit_category_enum AS ENUM ('RESIDENTIAL','COMMERCIAL','INDUSTRIAL','AGRICULTURAL','LAND');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE project_type_enum AS ENUM ('LANDED','HIGHRISE','TOWNHOUSE','COMMERCIAL','INDUSTRIAL','MIXED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE development_condition_enum AS ENUM (
        'RESIDENTIAL', 
        'COMMERCIAL', 
        'MIXED', 
        'INDUSTRIAL', 
        'LAND', 
        'AGRICULTURAL', 
        'OTHER'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE audit_module_enum AS ENUM (
        'SPA_STATUS', 
        'PRICING', 
        'PROPERTY', 
        'LOAN', 
        'PURCHASER', 
        'TEAM'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Modify projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS project_type project_type_enum NOT NULL DEFAULT 'LANDED',
ADD COLUMN IF NOT EXISTS title_type TEXT,
ADD COLUMN IF NOT EXISTS title_sub_type TEXT,
ADD COLUMN IF NOT EXISTS land_use TEXT,
ADD COLUMN IF NOT EXISTS development_condition_type development_condition_enum,
ADD COLUMN IF NOT EXISTS development_condition_custom TEXT;

-- 3. Modify cases table (Core Fields & Enum Conversion)
-- First, drop existing check constraints if they exist (based on table info)
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_purchase_mode_check;
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_unit_category_check;

-- Convert text columns to ENUMs safely
-- Handle purchase_mode
DO $$ BEGIN
    ALTER TABLE cases 
    ALTER COLUMN purchase_mode TYPE purchase_mode_enum 
    USING (
        CASE 
            WHEN purchase_mode = 'CASH' THEN 'CASH'::purchase_mode_enum
            WHEN purchase_mode = 'LOAN' THEN 'LOAN'::purchase_mode_enum
            ELSE 'OTHERS'::purchase_mode_enum
        END
    );
EXCEPTION
    WHEN undefined_column THEN
        -- Column doesn't exist, add it
        ALTER TABLE cases ADD COLUMN purchase_mode purchase_mode_enum NOT NULL DEFAULT 'LOAN';
END $$;

-- Handle unit_category
DO $$ BEGIN
    ALTER TABLE cases 
    ALTER COLUMN unit_category TYPE unit_category_enum 
    USING (
        CASE 
            WHEN unit_category = 'RESIDENTIAL' THEN 'RESIDENTIAL'::unit_category_enum
            WHEN unit_category = 'COMMERCIAL' THEN 'COMMERCIAL'::unit_category_enum
            WHEN unit_category = 'INDUSTRIAL' THEN 'INDUSTRIAL'::unit_category_enum
            WHEN unit_category = 'AGRICULTURAL' THEN 'AGRICULTURAL'::unit_category_enum
            ELSE 'LAND'::unit_category_enum
        END
    );
EXCEPTION
    WHEN undefined_column THEN
        ALTER TABLE cases ADD COLUMN unit_category unit_category_enum NOT NULL DEFAULT 'RESIDENTIAL';
END $$;

-- Add other new columns
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS spa_price NUMERIC(15,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS apdl_price NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS developer_discount NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS approved_purchase_price NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS is_bumiputra BOOLEAN DEFAULT FALSE;

-- Cleanup legacy fields
ALTER TABLE cases DROP COLUMN IF EXISTS purchaser1_name;
ALTER TABLE cases DROP COLUMN IF EXISTS purchaser1_ic;
ALTER TABLE cases DROP COLUMN IF EXISTS purchaser2_name;
ALTER TABLE cases DROP COLUMN IF EXISTS purchaser2_ic;
ALTER TABLE cases DROP COLUMN IF EXISTS purchaser3_name;
ALTER TABLE cases DROP COLUMN IF EXISTS purchaser3_ic;
ALTER TABLE cases DROP COLUMN IF EXISTS vendor_name;

-- 4. Create case_properties
-- NOTE: case_id must be BIGINT to match cases.id
CREATE TABLE IF NOT EXISTS case_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id BIGINT REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE case_properties ENABLE ROW LEVEL SECURITY;

-- 5. Create case_purchasers
CREATE TABLE IF NOT EXISTS case_purchasers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id BIGINT REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    sequence_no INT NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    id_no TEXT NOT NULL,
    is_company BOOLEAN DEFAULT FALSE,
    tin_no TEXT,
    contact_no TEXT,
    email TEXT,
    address_line_1 TEXT,
    address_line_2 TEXT,
    address_line_3 TEXT,
    address_line_4 TEXT,
    address_line_5 TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE case_purchasers ENABLE ROW LEVEL SECURITY;

-- 6. Create case_loans
CREATE TABLE IF NOT EXISTS case_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id BIGINT REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    party_type TEXT CHECK (party_type IN ('1ST_PARTY','3RD_PARTY')),
    bank_name TEXT,
    bank_branch TEXT,
    property_financing_sum NUMERIC,
    others_amount NUMERIC,
    legal_fees NUMERIC,
    total_loan NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE case_loans ENABLE ROW LEVEL SECURITY;

-- 7. Create case_borrowers
CREATE TABLE IF NOT EXISTS case_borrowers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id BIGINT REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    sequence_no INT NOT NULL DEFAULT 1,
    name TEXT,
    id_no TEXT,
    is_company BOOLEAN DEFAULT FALSE,
    contact_no TEXT,
    email TEXT,
    address_line_1 TEXT,
    address_line_2 TEXT,
    address_line_3 TEXT,
    address_line_4 TEXT,
    address_line_5 TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE case_borrowers ENABLE ROW LEVEL SECURITY;

-- 8. Create case_spa_status
-- NOTE: case_id is PK here, must be BIGINT
CREATE TABLE IF NOT EXISTS case_spa_status (
    case_id BIGINT PRIMARY KEY REFERENCES cases(id) ON DELETE CASCADE,
    spa_date DATE,
    spa_stamping_date DATE,
    completion_date DATE,
    extended_completion_date DATE,
    actual_vp_date DATE,
    defect_liability_months INT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE case_spa_status ENABLE ROW LEVEL SECURITY;

-- 9. Create case_custom_clauses
CREATE TABLE IF NOT EXISTS case_custom_clauses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id BIGINT REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    clause_title TEXT,
    clause_content TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE case_custom_clauses ENABLE ROW LEVEL SECURITY;

-- 10. Create case_audit_logs (Core Audit Trail)
CREATE TABLE IF NOT EXISTS case_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id BIGINT REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
    module audit_module_enum NOT NULL,
    field_name TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_by UUID REFERENCES auth.users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE case_audit_logs ENABLE ROW LEVEL SECURITY;
