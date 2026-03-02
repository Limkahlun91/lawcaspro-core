-- MIGRATION v3: INTEGRITY & REGULATORY UPGRADE
-- Focus: Document Integrity Ledger, Regulatory Archiving, and Risk Analysis

-- 1️⃣ Document Integrity Ledger (Blockchain-style Hash Chain)
-- Stores the immutable history of document generation to prove integrity.

CREATE TABLE IF NOT EXISTS document_integrity_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES generated_documents(id),
    previous_hash VARCHAR(255), -- The hash of the previous record in the ledger
    current_hash VARCHAR(255) NOT NULL, -- The enhanced hash of the current document
    sequence_index BIGINT NOT NULL, -- To strictly order the chain
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure strict ordering per firm
    UNIQUE(firm_id, sequence_index)
);

ALTER TABLE document_integrity_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm_isolation_ledger" ON document_integrity_ledger
    FOR SELECT USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- Index for fast lookup of the "tip" of the chain
CREATE INDEX idx_ledger_firm_sequence ON document_integrity_ledger(firm_id, sequence_index DESC);


-- 2️⃣ Regulatory Archive Metadata (Government Integration)
-- Extends generated_documents to support e-Invoice, CKHT, etc.

CREATE TABLE IF NOT EXISTS document_regulatory_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES generated_documents(id) ON DELETE CASCADE,
    firm_id UUID NOT NULL REFERENCES firms(id),
    
    -- Regulatory Fields
    regulatory_type VARCHAR(50) CHECK (regulatory_type IN ('invoice', 'receipt', 'ckht', 'stamp_duty', 'other')),
    regulatory_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'submitted', 'accepted', 'rejected', 'archived'
    regulatory_reference VARCHAR(255), -- e.g., LHDN Reference ID
    regulatory_hash VARCHAR(255), -- Hash returned by or submitted to the regulator
    
    submission_date TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    archive_location VARCHAR(255), -- e.g., 's3://bucket/archive/2026/...'
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE document_regulatory_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm_isolation_regulatory" ON document_regulatory_metadata
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- 3️⃣ Template Variable Usage (Risk Analysis)
-- Tracks which variables are used in which template version for impact analysis.

CREATE TABLE IF NOT EXISTS template_variable_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_version_id UUID NOT NULL REFERENCES template_versions(id) ON DELETE CASCADE,
    variable_key VARCHAR(255) NOT NULL REFERENCES system_variables(variable_key),
    usage_count INT DEFAULT 1,
    
    -- Optional: Risk weight for this variable in this context (e.g., Financial variables have higher risk)
    risk_weight INT DEFAULT 1, 
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(template_version_id, variable_key)
);

ALTER TABLE template_variable_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Viewable by firm users (via template -> firm)
-- Note: template_versions doesn't have firm_id directly, it links to document_templates.
-- We need a join or ensuring RLS on select is implicitly handled if we query via secure views/functions.
-- For simplicity in Supabase direct access:
CREATE POLICY "firm_isolation_variable_usage" ON template_variable_usage
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM template_versions tv
            JOIN document_templates dt ON tv.template_id = dt.id
            WHERE tv.id = template_variable_usage.template_version_id
            AND dt.firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid())
        )
    );

-- 4️⃣ Enhanced Fields for Generated Documents
-- To support the "Enhanced Hash" concept directly on the document record

ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS integrity_hash VARCHAR(255); -- The sha256(file + meta)
ALTER TABLE generated_documents ADD COLUMN IF NOT EXISTS verification_page_added BOOLEAN DEFAULT false;

-- Function to get the next sequence index for the ledger
CREATE OR REPLACE FUNCTION get_next_ledger_sequence(p_firm_id UUID)
RETURNS BIGINT AS $$
DECLARE
    v_last_seq BIGINT;
BEGIN
    SELECT sequence_index INTO v_last_seq
    FROM document_integrity_ledger
    WHERE firm_id = p_firm_id
    ORDER BY sequence_index DESC
    LIMIT 1;
    
    RETURN COALESCE(v_last_seq, 0) + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get the previous hash for the chain
CREATE OR REPLACE FUNCTION get_last_ledger_hash(p_firm_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    v_last_hash VARCHAR;
BEGIN
    SELECT current_hash INTO v_last_hash
    FROM document_integrity_ledger
    WHERE firm_id = p_firm_id
    ORDER BY sequence_index DESC
    LIMIT 1;
    
    RETURN COALESCE(v_last_hash, 'GENESIS_HASH'); -- Genesis block hash
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
