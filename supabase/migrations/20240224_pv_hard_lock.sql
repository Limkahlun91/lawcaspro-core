
-- 1. Add Locking Fields
ALTER TABLE payment_vouchers ADD COLUMN IF NOT EXISTS is_amount_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE payment_vouchers ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;

-- 2. Enhance RLS for "Hard Lock"
-- Staff can only update if status is 'Draft'
-- Account can only update category if status is 'Submitted'
-- Partner can only update (Approve) if status is 'Categorized'

-- Drop previous update policy to redefine strict rules
DROP POLICY IF EXISTS "Update Payment Vouchers" ON payment_vouchers;

CREATE POLICY "Update Payment Vouchers Strict" ON payment_vouchers
FOR UPDATE USING (
    firm_id = public.get_user_firm_id()
) WITH CHECK (
    firm_id = public.get_user_firm_id()
    AND (
        -- Staff: Only Drafts
        (created_by = auth.uid() AND status = 'Draft')
        OR
        -- Account: Assign Category (Submitted -> Categorized) OR Mark Paid (Approved -> Paid)
        (
            EXISTS (SELECT 1 FROM firm_users WHERE user_id = auth.uid() AND role = 'Account')
            AND (
                (status = 'Submitted') -- To Categorize
                OR
                (status = 'Approved') -- To Pay
            )
        )
        OR
        -- Partner/Founder: Approve (Categorized -> Approved)
        (
             EXISTS (SELECT 1 FROM firm_users WHERE user_id = auth.uid() AND role IN ('Partner', 'Founder'))
             AND status = 'Categorized'
        )
    )
);

-- 3. Database Trigger to Enforce "Hard Lock" Logic
-- Prevent Amount/Payee/Purpose changes if is_amount_locked is TRUE
CREATE OR REPLACE FUNCTION public.check_pv_lock()
RETURNS TRIGGER AS $$
BEGIN
    -- If Locked, prevent critical field changes
    IF OLD.is_amount_locked = TRUE THEN
        IF NEW.amount != OLD.amount OR NEW.payee_name != OLD.payee_name OR NEW.purpose != OLD.purpose THEN
            RAISE EXCEPTION 'Payment Voucher is Locked. Amount, Payee, and Purpose cannot be changed.';
        END IF;
    END IF;

    -- Auto-Lock on Approval
    IF NEW.status = 'Approved' AND OLD.status != 'Approved' THEN
        NEW.is_amount_locked := TRUE;
    END IF;
    
    -- Auto-Mark Paid
    IF NEW.status = 'Paid' AND OLD.status != 'Paid' THEN
        NEW.is_paid := TRUE;
        NEW.paid_at := NOW();
        NEW.paid_by := auth.uid();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_pv_lock ON payment_vouchers;
CREATE TRIGGER enforce_pv_lock
    BEFORE UPDATE ON payment_vouchers
    FOR EACH ROW EXECUTE FUNCTION public.check_pv_lock();
