-- Enable RLS on cases if not already enabled
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

-- 2. User Sessions Table (for security monitoring)
CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  login_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  is_valid BOOLEAN DEFAULT TRUE
);

-- Enable RLS on user_sessions
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Policy for CASES: Only access cases belonging to user's firm
DROP POLICY IF EXISTS "Firm Isolation Policy for Cases 20260301" ON cases;

CREATE POLICY "Firm Isolation Policy for Cases 20260301"
ON cases
FOR ALL
TO authenticated
USING (
  firm_id IN (
    SELECT firm_id FROM profiles WHERE id = auth.uid()
  )
)
WITH CHECK (
  firm_id IN (
    SELECT firm_id FROM profiles WHERE id = auth.uid()
  )
);

-- Policy for AUDIT_LOGS: Users can only see logs for their firm
-- Note: existing table uses user_id instead of changed_by
DROP POLICY IF EXISTS "Firm Isolation Policy for Audit Logs 20260301" ON audit_logs;

CREATE POLICY "Firm Isolation Policy for Audit Logs 20260301"
ON audit_logs
FOR SELECT
TO authenticated
USING (
  firm_id IN (
    SELECT firm_id FROM profiles WHERE id = auth.uid()
  )
);

-- Allow authenticated users to insert into audit_logs
DROP POLICY IF EXISTS "Insert Policy for Audit Logs 20260301" ON audit_logs;
CREATE POLICY "Insert Policy for Audit Logs 20260301"
ON audit_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 4. Audit Trigger Function
CREATE OR REPLACE FUNCTION log_audit_event()
RETURNS TRIGGER AS $$
DECLARE
  current_firm_id UUID;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  -- Attempt to get firm_id from the record itself or from the user's profile
  IF (TG_OP = 'DELETE') THEN
    current_firm_id := OLD.firm_id;
  ELSE
    current_firm_id := NEW.firm_id;
  END IF;

  -- Fallback: if firm_id is null in record, get from profile
  IF current_firm_id IS NULL THEN
    SELECT firm_id INTO current_firm_id FROM profiles WHERE id = current_user_id;
  END IF;

  INSERT INTO audit_logs (
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    user_id,
    firm_id
  )
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)::jsonb ELSE NULL END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE row_to_json(NEW)::jsonb END,
    current_user_id,
    current_firm_id
  );
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply Trigger to CASES table
DROP TRIGGER IF EXISTS audit_cases_trigger ON cases;
CREATE TRIGGER audit_cases_trigger
AFTER INSERT OR UPDATE OR DELETE ON cases
FOR EACH ROW EXECUTE FUNCTION log_audit_event();

-- Grant permissions
GRANT SELECT, INSERT ON audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_sessions TO authenticated;
