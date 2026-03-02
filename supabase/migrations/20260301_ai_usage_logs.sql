-- Create ai_usage_logs table for token cost tracking
CREATE TABLE IF NOT EXISTS ai_usage_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    firm_id UUID NOT NULL REFERENCES firms(id),
    user_id UUID REFERENCES auth.users(id), -- or profiles(id) if strictly enforcing
    module TEXT NOT NULL, -- 'case', 'finance', 'document'
    model TEXT NOT NULL, -- 'gpt-4o', 'claude-3-opus'
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    cost_estimate NUMERIC(10, 6) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists
DROP POLICY IF EXISTS "Users can view usage logs for their firm" ON ai_usage_logs;

CREATE POLICY "Users can view usage logs for their firm" ON ai_usage_logs
    FOR SELECT USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- System/Backend insertion policy (or user triggered if client-side AI)
CREATE POLICY "Users can insert usage logs for their firm" ON ai_usage_logs
    FOR INSERT WITH CHECK (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));
