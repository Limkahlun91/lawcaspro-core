
-- Migration to add security settings to firms table
-- 1. Add security_level, founder_pin_required, consent_required columns
ALTER TABLE firms ADD COLUMN IF NOT EXISTS security_level TEXT DEFAULT 'standard';
ALTER TABLE firms ADD COLUMN IF NOT EXISTS founder_pin_required BOOLEAN DEFAULT true;
ALTER TABLE firms ADD COLUMN IF NOT EXISTS consent_required BOOLEAN DEFAULT true;

-- 2. Add comment to explain security levels
COMMENT ON COLUMN firms.security_level IS 'Security Level: standard (default), internal_dev (no pin/consent), enterprise (2fa + audit)';

-- 3. Update 'LawCase Pro Legal Firm' to be 'internal_dev' (Bypass Security)
UPDATE firms 
SET security_level = 'internal_dev', 
    founder_pin_required = false, 
    consent_required = false 
WHERE name = 'LawCase Pro Legal Firm';

-- 4. Create RLS policies to allow reading these settings (if not already readable)
-- Assuming 'firms' table already has RLS enabled and policies for users to read their own firm.
-- If not, we should ensure users can read their firm's security settings.

-- (Optional) Create a helper function to get firm security settings easily
CREATE OR REPLACE FUNCTION get_firm_security_settings(firm_id uuid)
RETURNS TABLE (
  security_level text,
  founder_pin_required boolean,
  consent_required boolean
) AS $$
BEGIN
  RETURN QUERY SELECT 
    f.security_level, 
    f.founder_pin_required, 
    f.consent_required
  FROM firms f
  WHERE f.id = firm_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
