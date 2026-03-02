-- MIGRATION v12: SAAS OPERATOR LAYER
-- Focus: Super Admin, MRR Views, Hard Kill Switch, Data Export

-- 1️⃣ Hard Kill Switch & Suspension
ALTER TABLE firms ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false;
ALTER TABLE firms ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE firms ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;

-- 2️⃣ MRR Calculation View (Revenue Intelligence)
-- Simplified MRR view assuming monthly billing.
-- Real SaaS needs prorated calc, but this is good v1.
CREATE OR REPLACE VIEW view_saas_mrr AS
SELECT 
    SUM(
        CASE 
            WHEN plan_code = 'basic' THEN 199 
            WHEN plan_code = 'pro' THEN 499 
            WHEN plan_code = 'enterprise' THEN 999 
            ELSE 0 
        END
    ) as mrr_total,
    COUNT(*) as active_subscriptions
FROM subscriptions
WHERE status = 'active';

-- 3️⃣ Churn Analysis View
CREATE OR REPLACE VIEW view_saas_churn AS
SELECT 
    COUNT(*) as churned_count,
    date_trunc('month', updated_at) as churn_month
FROM subscriptions
WHERE status = 'canceled'
GROUP BY date_trunc('month', updated_at);

-- 4️⃣ Firm Usage Summary View (Admin Console)
CREATE OR REPLACE VIEW view_firm_usage_summary AS
SELECT 
    f.id as firm_id,
    f.name as firm_name,
    f.is_suspended,
    s.plan_code,
    s.status as subscription_status,
    s.current_period_end,
    (SELECT COUNT(*) FROM usage_logs u WHERE u.firm_id = f.id AND u.usage_type = 'lhdn_submission') as lhdn_usage_total,
    (SELECT SUM(file_size_bytes) FROM financial_documents fd WHERE fd.firm_id = f.id) as storage_usage_bytes
FROM firms f
LEFT JOIN subscriptions s ON f.id = s.firm_id;

-- 5️⃣ Data Export Request Table
CREATE TABLE IF NOT EXISTS data_export_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id),
    requested_by UUID REFERENCES auth.users(id),
    
    status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
    download_url TEXT,
    expiry_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE data_export_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "firm_isolation_exports" ON data_export_requests 
    FOR ALL USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- 6️⃣ Super Admin Permissions
INSERT INTO permissions (code) VALUES 
('admin.view_dashboard'),
('admin.manage_firms'),
('admin.view_revenue'),
('admin.export_data')
ON CONFLICT (code) DO NOTHING;

-- Seed Super Admin Role (System Level)
INSERT INTO roles (name) VALUES ('Super Admin') ON CONFLICT (name) DO NOTHING;
-- In real app, we assign this role to specific user UUIDs manually or via script
