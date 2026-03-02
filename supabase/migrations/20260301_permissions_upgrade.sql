-- Phase 2: Permission System Upgrade

-- Hub Permissions (Already created, but ensuring structure matches)
-- create table hub_permissions ( ... ); -- Exists

-- Module Permissions (Granular Control)
CREATE TABLE IF NOT EXISTS module_permissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    firm_id UUID NOT NULL REFERENCES firms(id),
    role TEXT NOT NULL, -- 'Partner', 'Senior Lawyer', etc. (User used role_id, but our system uses role names string currently. sticking to existing pattern for now, or user meant role_id as foreign key if we had roles table. We use string roles in profiles.role)
    module_name TEXT NOT NULL, -- 'case_details', 'finance_invoices', etc.
    can_view BOOLEAN DEFAULT false,
    can_create BOOLEAN DEFAULT false,
    can_edit BOOLEAN DEFAULT false,
    can_delete BOOLEAN DEFAULT false,
    can_approve BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(firm_id, role, module_name)
);

ALTER TABLE module_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view module permissions for their firm" ON module_permissions
    FOR SELECT USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- Commercial Model Preparation
ALTER TABLE firms ADD COLUMN IF NOT EXISTS billing_plan VARCHAR DEFAULT 'basic'; -- 'basic', 'pro', 'enterprise'
ALTER TABLE firms ADD COLUMN IF NOT EXISTS ai_addon_enabled BOOLEAN DEFAULT false;

-- Gov Gateway Logs (As requested in Phase 7/Gov Module section)
-- I created gov_access_logs before, ensuring it matches requirements
-- create table gov_access_logs ... (Exists)
-- portal_name, case_id added?
ALTER TABLE gov_access_logs ADD COLUMN IF NOT EXISTS portal_name TEXT; -- I used gov_site before, keeping consistent
ALTER TABLE gov_access_logs ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES cases(id);
