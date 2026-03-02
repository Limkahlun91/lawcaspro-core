-- MIGRATION v4: LEGAL WORKFLOW INTELLIGENCE & RISK COMPLIANCE
-- Focus: Document Triggers, Project/Bank Mappings, and Compliance Tracking

-- 🏛 第二层：Legal Workflow Intelligence (Trigger Engine)
-- Automates document suggestions based on Case Status and Events.

CREATE TABLE IF NOT EXISTS document_triggers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL, -- e.g. "SPA Signed -> Loan Letter"
    
    -- Trigger Conditions
    case_status VARCHAR(100), -- e.g. 'SPA Signed'
    event_type VARCHAR(100), -- 'status_change', 'field_update'
    field_name VARCHAR(100), -- If field update, which field? e.g. 'loan_approved'
    field_value VARCHAR(255), -- e.g. 'true'
    
    -- Action
    template_id UUID NOT NULL REFERENCES document_templates(id),
    is_required BOOLEAN DEFAULT false, -- Is this a mandatory document?
    deadline_days INT, -- Due within X days of trigger
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE document_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm_isolation_triggers" ON document_triggers
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- Index for fast lookup during case updates
CREATE INDEX idx_triggers_status ON document_triggers(firm_id, case_status);


-- 🧠 第三层：Risk & Compliance Intelligence (Missing Docs & Project Mapping)

-- 1️⃣ Project / Bank Template Mapping (Context-Aware Templates)
-- Maps specific templates to specific Projects (Developers) or Banks.
-- This allows "Maybank Templates" or "EcoWorld Templates" to auto-load.

CREATE TABLE IF NOT EXISTS template_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES document_templates(id),
    
    -- Context
    mapping_type VARCHAR(50) CHECK (mapping_type IN ('project', 'bank', 'case_type')),
    reference_id VARCHAR(255), -- Project ID, Bank Name/ID, or Case Type (e.g. 'conveyancing')
    
    is_default BOOLEAN DEFAULT false, -- Is this the default template for this context?
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(firm_id, template_id, mapping_type, reference_id)
);

ALTER TABLE template_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm_isolation_mappings" ON template_mappings
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- 2️⃣ Document Compliance Checklist (Per Case)
-- Tracks which required documents are generated/missing for a case.
-- Populated by triggers or standard workflows.

CREATE TABLE IF NOT EXISTS case_document_checklist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    case_id BIGINT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    
    document_name VARCHAR(255) NOT NULL, -- e.g. "SPA Cover Letter"
    template_id UUID REFERENCES document_templates(id), -- Recommended template
    
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'generated', 'skipped'
    generated_document_id UUID REFERENCES generated_documents(id), -- Link if generated
    
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE case_document_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm_isolation_checklist" ON case_document_checklist
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX idx_checklist_case ON case_document_checklist(case_id);


-- 3️⃣ Document Timeline / History Log (Enhanced Audit)
-- Centralized view of document lifecycle: Generated -> Printed -> Sent -> Signed

CREATE TABLE IF NOT EXISTS document_lifecycle_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES generated_documents(id) ON DELETE CASCADE,
    
    event_type VARCHAR(50) NOT NULL, -- 'generated', 'printed', 'sent_email', 'sent_physical', 'signed', 'filed'
    description TEXT,
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    performed_by UUID REFERENCES auth.users(id),
    
    metadata JSONB -- e.g. Email recipient, tracking number
);

ALTER TABLE document_lifecycle_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm_isolation_lifecycle" ON document_lifecycle_events
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX idx_lifecycle_doc ON document_lifecycle_events(document_id);

-- Helper Function: Check Missing Documents (Risk Analysis)
-- Returns count of missing required documents for a case
CREATE OR REPLACE FUNCTION check_case_compliance(p_case_id BIGINT, p_firm_id UUID)
RETURNS TABLE (
    missing_count BIGINT,
    overdue_count BIGINT,
    risk_score INT
) AS $$
DECLARE
    v_missing BIGINT;
    v_overdue BIGINT;
    v_risk INT;
BEGIN
    -- Count pending required docs
    SELECT COUNT(*) INTO v_missing
    FROM case_document_checklist
    WHERE case_id = p_case_id 
    AND firm_id = p_firm_id
    AND status = 'pending';
    
    -- Count overdue
    SELECT COUNT(*) INTO v_overdue
    FROM case_document_checklist
    WHERE case_id = p_case_id 
    AND firm_id = p_firm_id
    AND status = 'pending'
    AND due_date < NOW();
    
    -- Simple Risk Calculation (Example logic)
    v_risk := (v_missing * 10) + (v_overdue * 20);
    IF v_risk > 100 THEN v_risk := 100; END IF;
    
    RETURN QUERY SELECT v_missing, v_overdue, v_risk;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
