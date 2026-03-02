-- Phase 2: Permission System Upgrade

-- Module Permissions (Granular Control)
CREATE TABLE IF NOT EXISTS module_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    firm_id UUID NOT NULL REFERENCES firms(id),
    role TEXT NOT NULL, 
    module_name TEXT NOT NULL, 
    can_view BOOLEAN DEFAULT false,
    can_create BOOLEAN DEFAULT false,
    can_edit BOOLEAN DEFAULT false,
    can_delete BOOLEAN DEFAULT false,
    can_approve BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(firm_id, role, module_name)
);

ALTER TABLE module_permissions ENABLE ROW LEVEL SECURITY;

-- Policy (Check if exists first to avoid error on rerun)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can view module permissions for their firm' AND tablename = 'module_permissions'
    ) THEN
        CREATE POLICY "Users can view module permissions for their firm" ON module_permissions
            FOR SELECT USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));
    END IF;
END
$$;

-- Commercial Model Preparation
ALTER TABLE firms ADD COLUMN IF NOT EXISTS billing_plan VARCHAR DEFAULT 'basic'; 
ALTER TABLE firms ADD COLUMN IF NOT EXISTS ai_addon_enabled BOOLEAN DEFAULT false;

-- Gov Gateway Logs - Fix type mismatch (case_id is BIGINT)
ALTER TABLE gov_access_logs ADD COLUMN IF NOT EXISTS portal_name TEXT;
ALTER TABLE gov_access_logs ADD COLUMN IF NOT EXISTS case_id BIGINT REFERENCES cases(id);
