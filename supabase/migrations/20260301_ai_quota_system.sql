-- Add AI Quota and Control fields to firms table
ALTER TABLE firms ADD COLUMN IF NOT EXISTS ai_plan TEXT DEFAULT 'basic'; -- 'basic', 'pro', 'enterprise'
ALTER TABLE firms ADD COLUMN IF NOT EXISTS ai_monthly_quota BIGINT DEFAULT 10000; -- Default token quota
ALTER TABLE firms ADD COLUMN IF NOT EXISTS ai_tokens_used BIGINT DEFAULT 0; -- Current billing cycle usage
ALTER TABLE firms ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN DEFAULT true; -- Global switch for the firm
ALTER TABLE firms ADD COLUMN IF NOT EXISTS ai_status TEXT DEFAULT 'active'; -- 'active', 'suspended' (over limit), 'banned'

-- Create a function to reset monthly quotas (to be called via cron or manually)
CREATE OR REPLACE FUNCTION reset_monthly_ai_quotas()
RETURNS void AS $$
BEGIN
  UPDATE firms
  SET ai_tokens_used = 0
  WHERE ai_status != 'banned';
END;
$$ LANGUAGE plpgsql;

-- Add checking logic (optional, but good for data integrity)
ALTER TABLE firms ADD CONSTRAINT check_ai_plan CHECK (ai_plan IN ('basic', 'pro', 'enterprise'));
