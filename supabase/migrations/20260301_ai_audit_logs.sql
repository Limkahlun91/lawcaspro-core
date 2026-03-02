-- 20260301_ai_audit_logs.sql

-- AI Audit Logs Table
CREATE TABLE IF NOT EXISTS ai_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id uuid NOT NULL,
  user_id uuid, -- Can be null if system action, but usually triggered by user
  action text NOT NULL, -- 'EXTRACT_STRUCTURED', 'ANALYZE_DOCUMENT'
  model text NOT NULL, -- 'gemini-1.5-pro', 'gemini-1.5-flash'
  tokens_input int DEFAULT 0,
  tokens_output int DEFAULT 0,
  cost_estimate numeric DEFAULT 0.00,
  status text DEFAULT 'success', -- 'success', 'error'
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE ai_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only allow insert from backend (service role) or specific roles
-- For now, allow authenticated users to view their firm's logs
CREATE POLICY "Enable read access for authenticated users based on firm_id" ON ai_logs
FOR SELECT USING (auth.uid() IN (SELECT id FROM profiles WHERE firm_id = ai_logs.firm_id));

-- Note: In a real architecture, the Node.js backend uses the Service Role to insert logs, bypassing RLS.
