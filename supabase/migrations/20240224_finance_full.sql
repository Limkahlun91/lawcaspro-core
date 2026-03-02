
-- 1. Chart of Accounts (CoA)
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    code TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- Asset, Liability, Equity, Revenue, Expense
    is_system BOOLEAN DEFAULT FALSE,
    firm_id UUID REFERENCES firms(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed System Accounts (Shared or Per Firm?)
-- For SaaS, we can have a template and copy to firm, or shared system accounts.
-- Let's assume shared for simplicity for now, but firm_id allows custom.
-- But we need base data.

-- 2. GL Entries (Header)
CREATE TABLE IF NOT EXISTS gl_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    description TEXT,
    reference_type TEXT, -- 'PV', 'Invoice', 'Manual'
    reference_id UUID, -- Link to PV or Invoice ID
    firm_id UUID REFERENCES firms(id) NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. GL Lines (Details)
CREATE TABLE IF NOT EXISTS gl_lines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gl_entry_id UUID REFERENCES gl_entries(id) ON DELETE CASCADE,
    account_code TEXT REFERENCES chart_of_accounts(code),
    debit NUMERIC DEFAULT 0,
    credit NUMERIC DEFAULT 0,
    description TEXT,
    firm_id UUID REFERENCES firms(id) NOT NULL
);

-- 4. Category Mapping
CREATE TABLE IF NOT EXISTS category_gl_mapping (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_name TEXT NOT NULL,
    debit_account_code TEXT REFERENCES chart_of_accounts(code),
    credit_account_code TEXT REFERENCES chart_of_accounts(code),
    firm_id UUID REFERENCES firms(id)
);

-- 5. Audit Logs (Centralized)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    record_id UUID,
    action TEXT NOT NULL, -- INSERT, UPDATE, DELETE, APPROVE, PAY
    old_data JSONB,
    new_data JSONB,
    user_id UUID REFERENCES auth.users(id),
    firm_id UUID REFERENCES firms(id),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_gl_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for Firm Scope)
CREATE POLICY "View CoA" ON chart_of_accounts FOR SELECT USING (firm_id = public.get_user_firm_id() OR firm_id IS NULL); -- Allow system accounts (NULL firm_id)
CREATE POLICY "View GL" ON gl_entries FOR ALL USING (firm_id = public.get_user_firm_id());
CREATE POLICY "View GL Lines" ON gl_lines FOR ALL USING (firm_id = public.get_user_firm_id());
CREATE POLICY "View Mappings" ON category_gl_mapping FOR ALL USING (firm_id = public.get_user_firm_id() OR firm_id IS NULL);
CREATE POLICY "View Audit" ON audit_logs FOR SELECT USING (firm_id = public.get_user_firm_id());
CREATE POLICY "Insert Audit" ON audit_logs FOR INSERT WITH CHECK (firm_id = public.get_user_firm_id());

-- 6. Auto-GL Logic Function
CREATE OR REPLACE FUNCTION public.auto_post_gl_pv()
RETURNS TRIGGER AS $$
DECLARE
    mapping_record RECORD;
    entry_id UUID;
    v_firm_id UUID;
BEGIN
    -- Only trigger on Status Change to 'Paid' (Financial Impact)
    -- Or 'Approved' (Liability Recognition)?
    -- User prompt: "When voucher is Approved: Auto generate GL Entry" (Accrual Basis - Liability)
    -- "When voucher is Mark Paid: Auto generate ledger_entries" (Cash Basis / Settlement)
    
    IF NEW.status = 'Approved' AND OLD.status != 'Approved' THEN
        v_firm_id := NEW.firm_id;
        
        -- Find Mapping
        SELECT * INTO mapping_record FROM category_gl_mapping 
        WHERE category_name = NEW.category AND (firm_id = v_firm_id OR firm_id IS NULL) LIMIT 1;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'No GL Mapping found for category: %', NEW.category;
        END IF;

        -- Create GL Header (Accrual: Expense vs Payable)
        INSERT INTO gl_entries (date, description, reference_type, reference_id, firm_id, created_by)
        VALUES (CURRENT_DATE, 'PV Accrual: ' || NEW.pv_no || ' - ' || NEW.payee_name, 'PV', NEW.id, v_firm_id, auth.uid())
        RETURNING id INTO entry_id;

        -- Debit Expense
        INSERT INTO gl_lines (gl_entry_id, account_code, debit, credit, description, firm_id)
        VALUES (entry_id, mapping_record.debit_account_code, NEW.amount, 0, NEW.purpose, v_firm_id);

        -- Credit Payable (Liability)
        INSERT INTO gl_lines (gl_entry_id, account_code, debit, credit, description, firm_id)
        VALUES (entry_id, '2000', 0, NEW.amount, 'Accounts Payable - ' || NEW.payee_name, v_firm_id);
    
    ELSIF NEW.status = 'Paid' AND OLD.status != 'Paid' THEN
        v_firm_id := NEW.firm_id;
        
        -- Create GL Header (Payment: Payable vs Bank)
        INSERT INTO gl_entries (date, description, reference_type, reference_id, firm_id, created_by)
        VALUES (CURRENT_DATE, 'PV Payment: ' || NEW.pv_no, 'PV', NEW.id, v_firm_id, auth.uid())
        RETURNING id INTO entry_id;

        -- Debit Payable
        INSERT INTO gl_lines (gl_entry_id, account_code, debit, credit, description, firm_id)
        VALUES (entry_id, '2000', NEW.amount, 0, 'Clear AP', v_firm_id);

        -- Credit Bank (Hardcoded '1000' or dynamic?)
        -- Assuming 1000 is Bank. Real app needs Bank Selection.
        INSERT INTO gl_lines (gl_entry_id, account_code, debit, credit, description, firm_id)
        VALUES (entry_id, '1000', 0, NEW.amount, 'Bank Payment', v_firm_id);
        
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_gl_pv ON payment_vouchers;
CREATE TRIGGER trigger_auto_gl_pv
    AFTER UPDATE ON payment_vouchers
    FOR EACH ROW EXECUTE FUNCTION public.auto_post_gl_pv();

-- 7. Audit Log Trigger
CREATE OR REPLACE FUNCTION public.log_audit_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, user_id, firm_id)
    VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        row_to_json(OLD),
        row_to_json(NEW),
        auth.uid(),
        COALESCE(NEW.firm_id, OLD.firm_id)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS audit_pv ON payment_vouchers;
CREATE TRIGGER audit_pv
    AFTER INSERT OR UPDATE OR DELETE ON payment_vouchers
    FOR EACH ROW EXECUTE FUNCTION public.log_audit_change();

-- Seed Basic Data
INSERT INTO chart_of_accounts (code, name, type, is_system) VALUES
('1000', 'Bank - Office Account', 'Asset', TRUE),
('2000', 'Accounts Payable', 'Liability', TRUE),
('5000', 'General Expenses', 'Expense', TRUE),
('5001', 'Client Disbursements', 'Expense', TRUE),
('5002', 'Utilities', 'Expense', TRUE)
ON CONFLICT DO NOTHING;

INSERT INTO category_gl_mapping (category_name, debit_account_code, credit_account_code) VALUES
('Office', '5000', '2000'),
('Client', '5001', '2000'),
('Utility', '5002', '2000'),
('Other', '5000', '2000')
ON CONFLICT DO NOTHING;
