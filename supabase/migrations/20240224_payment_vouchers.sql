
-- Create payment_vouchers table
CREATE TABLE IF NOT EXISTS payment_vouchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pv_no TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    payee_name TEXT NOT NULL,
    type TEXT, -- 'Cash', 'Cheque', 'Online Transfer'
    amount NUMERIC NOT NULL DEFAULT 0,
    category TEXT, -- 'Office', 'Client', 'Utility', 'Other' (Nullable for Draft)
    status TEXT DEFAULT 'Draft', -- Draft, Submitted, Categorized, Approved, Paid, File Returned
    purpose TEXT,
    created_by UUID REFERENCES auth.users(id),
    firm_id UUID REFERENCES firms(id),
    
    -- Workflow Timestamps & Actors
    submitted_at TIMESTAMP WITH TIME ZONE,
    categorized_by UUID REFERENCES auth.users(id),
    categorized_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    paid_by UUID REFERENCES auth.users(id),
    paid_at TIMESTAMP WITH TIME ZONE,
    file_returned_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE payment_vouchers ENABLE ROW LEVEL SECURITY;

-- Trigger to set firm_id
DROP TRIGGER IF EXISTS set_firm_id_pv ON payment_vouchers;
CREATE TRIGGER set_firm_id_pv
    BEFORE INSERT ON payment_vouchers
    FOR EACH ROW EXECUTE FUNCTION public.set_firm_id_trigger();

-- RLS Policies

-- 1. View Policy
-- Staff: View own
-- Account/Partner/Founder: View All in Firm
CREATE POLICY "View Payment Vouchers" ON payment_vouchers
FOR SELECT USING (
    firm_id = public.get_user_firm_id() 
    AND (
        created_by = auth.uid() -- Staff sees own
        OR 
        EXISTS ( -- Admin roles see all
            SELECT 1 FROM firm_users 
            WHERE user_id = auth.uid() 
            AND firm_id = payment_vouchers.firm_id
            AND role IN ('Account', 'Partner', 'Founder', 'Senior Lawyer')
        )
    )
);

-- 2. Insert Policy (All Staff can create)
CREATE POLICY "Create Payment Vouchers" ON payment_vouchers
FOR INSERT WITH CHECK (
    firm_id = public.get_user_firm_id()
);

-- 3. Update Policy
-- This is complex, so we'll allow updates if user belongs to firm, but frontend + backend logic triggers will handle specific field protection if needed.
-- For RLS, we can be slightly broader and rely on UI + Business Logic, or be strict.
-- Strict RLS for Updates:

CREATE POLICY "Update Payment Vouchers" ON payment_vouchers
FOR UPDATE USING (
    firm_id = public.get_user_firm_id()
) WITH CHECK (
    firm_id = public.get_user_firm_id()
    AND (
        -- Staff can edit own Drafts
        (created_by = auth.uid() AND status = 'Draft')
        OR
        -- Account can edit if status is Submitted (to Categorize) or Approved (to Pay)
        (
            EXISTS (SELECT 1 FROM firm_users WHERE user_id = auth.uid() AND role = 'Account')
            AND status IN ('Submitted', 'Approved', 'Categorized') 
        )
        OR
        -- Partner/Founder can edit if status is Categorized (to Approve) or generally manage
        (
             EXISTS (SELECT 1 FROM firm_users WHERE user_id = auth.uid() AND role IN ('Partner', 'Founder'))
        )
    )
);

-- Delete Policy (Only Drafts by Owner or Admin)
CREATE POLICY "Delete Payment Vouchers" ON payment_vouchers
FOR DELETE USING (
    firm_id = public.get_user_firm_id()
    AND (
        (created_by = auth.uid() AND status = 'Draft')
        OR
        EXISTS (SELECT 1 FROM firm_users WHERE user_id = auth.uid() AND role IN ('Partner', 'Founder'))
    )
);
