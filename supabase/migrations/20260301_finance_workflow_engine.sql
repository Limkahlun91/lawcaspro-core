-- MIGRATION v5: FINANCE WORKFLOW ENGINE & SLA
-- Focus: Stage History, Custom Workflows, SLA, Escalation

-- 1️⃣ Payment Voucher Core Update (Stage Tracking)
ALTER TABLE payment_vouchers ADD COLUMN IF NOT EXISTS current_stage TEXT DEFAULT 'Draft';
ALTER TABLE payment_vouchers ADD COLUMN IF NOT EXISTS current_stage_started_at TIMESTAMPTZ DEFAULT now();

-- 2️⃣ Stage History Table (The Audit Trail of Workflow)
CREATE TABLE IF NOT EXISTS pv_stage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id),
    pv_id UUID NOT NULL REFERENCES payment_vouchers(id) ON DELETE CASCADE,
    
    stage_name TEXT NOT NULL,
    entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    entered_by UUID REFERENCES auth.users(id),
    
    exited_at TIMESTAMPTZ,
    duration_hours NUMERIC(10,2), -- Calculated on exit
    
    remarks TEXT,
    
    -- SLA Fields
    sla_hours INTEGER DEFAULT 24,
    sla_breached BOOLEAN DEFAULT false,
    sla_breached_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pv_stage_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firm_isolation_pv_stage" ON pv_stage_history 
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- Index for SLA worker performance
CREATE INDEX idx_pv_stage_active ON pv_stage_history(exited_at) WHERE exited_at IS NULL;

-- 3️⃣ Workflow Templates (Custom Builder)
CREATE TABLE IF NOT EXISTS workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID REFERENCES firms(id),
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firm_isolation_workflow_templates" ON workflow_templates 
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- 4️⃣ Workflow Stages (The Steps)
CREATE TABLE IF NOT EXISTS workflow_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES workflow_templates(id) ON DELETE CASCADE,
    stage_order INTEGER NOT NULL,
    stage_name TEXT NOT NULL,
    sla_hours INTEGER DEFAULT 24,
    required_permission TEXT, -- e.g. 'pv.approve_partner'
    auto_notify BOOLEAN DEFAULT false
);

ALTER TABLE workflow_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firm_isolation_workflow_stages" ON workflow_stages 
    FOR ALL USING (
        template_id IN (
            SELECT id FROM workflow_templates WHERE firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid())
        )
    );

-- 5️⃣ Finance Escalation Rules
CREATE TABLE IF NOT EXISTS workflow_escalations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES workflow_templates(id) ON DELETE CASCADE,
    stage_name TEXT NOT NULL,
    escalate_after_hours INTEGER NOT NULL,
    escalate_to_role TEXT NOT NULL, -- e.g. 'Partner', 'Manager'
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE workflow_escalations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firm_isolation_escalations" ON workflow_escalations 
    FOR ALL USING (
        template_id IN (
            SELECT id FROM workflow_templates WHERE firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid())
        )
    );

-- 6️⃣ Seed Default Workflow (System Default)
-- This ensures existing data works before firms customize
-- We'll insert a template for 'System Default' (firm_id null or special handling, but for RLS simplicity, 
-- we might need to seed per firm or handle global templates. For now, we assume this is a template script 
-- that runs per firm setup, or we create a global one.)
-- BETTER APPROACH: The code handles "Default" logic if no custom template found.

-- 7️⃣ Additional Permissions for new stages
INSERT INTO permissions (code) VALUES 
('pv.prepare'),
('pv.approve_lawyer'),
('pv.approve_partner'),
('pv.submit_account'),
('pv.mark_paid'),
('pv.return_file'),
('pv.lock'),
('workflow.manage') -- To edit templates
ON CONFLICT (code) DO NOTHING;
