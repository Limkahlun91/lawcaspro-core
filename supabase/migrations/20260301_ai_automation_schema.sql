-- Enable RLS on all new tables automatically
-- Add AI fields to cases
ALTER TABLE cases ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS ai_risk_level TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS ai_next_step TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS ai_tags TEXT[];

-- Add AI fields to documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ai_category TEXT;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS ai_extracted_data JSONB;

-- Add AI fields to payment_vouchers (Finance)
ALTER TABLE payment_vouchers ADD COLUMN IF NOT EXISTS ai_audit_status TEXT DEFAULT 'Pending';
ALTER TABLE payment_vouchers ADD COLUMN IF NOT EXISTS ai_flagged_issues TEXT;

-- Create gov_access_logs table
CREATE TABLE IF NOT EXISTS gov_access_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    firm_id UUID NOT NULL REFERENCES firms(id),
    user_id UUID REFERENCES auth.users(id),
    gov_site TEXT NOT NULL, -- 'EFS', 'MyTax', etc.
    action TEXT NOT NULL, -- 'Login', 'Upload', 'CheckStatus'
    status TEXT NOT NULL, -- 'Success', 'Failed'
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE gov_access_logs ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists to avoid error on re-run
DROP POLICY IF EXISTS "Users can view logs for their firm" ON gov_access_logs;
DROP POLICY IF EXISTS "Users can insert logs for their firm" ON gov_access_logs;

CREATE POLICY "Users can view logs for their firm" ON gov_access_logs
    FOR SELECT USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert logs for their firm" ON gov_access_logs
    FOR INSERT WITH CHECK (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- Create automation_logs table
CREATE TABLE IF NOT EXISTS automation_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    firm_id UUID NOT NULL REFERENCES firms(id),
    trigger_event TEXT NOT NULL, -- 'case_created', 'doc_uploaded'
    ai_model TEXT, -- 'gpt-4', 'claude-3'
    input_data JSONB,
    output_data JSONB,
    status TEXT NOT NULL, -- 'Success', 'Failed', 'Pending'
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can view automation logs for their firm" ON automation_logs;
DROP POLICY IF EXISTS "System can insert automation logs" ON automation_logs;

CREATE POLICY "Users can view automation logs for their firm" ON automation_logs
    FOR SELECT USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "System can insert automation logs" ON automation_logs
    FOR INSERT WITH CHECK (true); -- Usually triggered by backend, but for now allow client insert if needed or via firm check

-- Create hub_permissions table
CREATE TABLE IF NOT EXISTS hub_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    firm_id UUID NOT NULL REFERENCES firms(id),
    role TEXT NOT NULL, -- 'admin', 'lawyer', 'clerk'
    hub TEXT NOT NULL, -- 'case_hub', 'finance_hub', 'ai_hub', 'admin_hub'
    access_level TEXT NOT NULL, -- 'read', 'write', 'none'
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(firm_id, role, hub)
);

ALTER TABLE hub_permissions ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can view permissions for their firm" ON hub_permissions;

CREATE POLICY "Users can view permissions for their firm" ON hub_permissions
    FOR SELECT USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));
