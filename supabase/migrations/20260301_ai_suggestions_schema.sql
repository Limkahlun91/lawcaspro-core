-- AI Suggestions Table (The buffer between AI and Main Data)
CREATE TABLE IF NOT EXISTS ai_suggestions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    firm_id UUID NOT NULL REFERENCES firms(id),
    module TEXT NOT NULL, -- 'case', 'finance', 'document'
    entity_id UUID NOT NULL, -- case_id, document_id, etc.
    suggestion_type TEXT NOT NULL, -- 'risk_assessment', 'summary', 'fee_proposal', 'tax_code'
    suggestion_data JSONB NOT NULL, -- The actual AI output
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
    created_at TIMESTAMPTZ DEFAULT now(),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ
);

ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view suggestions for their firm" ON ai_suggestions
    FOR SELECT USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update suggestions for their firm" ON ai_suggestions
    FOR UPDATE USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- AI Action Logs (Liability Tracking)
CREATE TABLE IF NOT EXISTS ai_action_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    firm_id UUID NOT NULL REFERENCES firms(id),
    user_id UUID REFERENCES auth.users(id),
    suggestion_id UUID REFERENCES ai_suggestions(id),
    action_taken TEXT NOT NULL, -- 'accepted', 'rejected'
    timestamp TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view action logs for their firm" ON ai_action_logs
    FOR SELECT USING (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "System can insert action logs" ON ai_action_logs
    FOR INSERT WITH CHECK (firm_id = (SELECT firm_id FROM profiles WHERE id = auth.uid()));

-- Add indices for performance
CREATE INDEX idx_ai_suggestions_entity ON ai_suggestions(entity_id);
CREATE INDEX idx_ai_suggestions_status ON ai_suggestions(status);
