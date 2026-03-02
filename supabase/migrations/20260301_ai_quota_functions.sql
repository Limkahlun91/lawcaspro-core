-- Secure function to increment AI usage
CREATE OR REPLACE FUNCTION increment_ai_usage(p_firm_id UUID, p_tokens INT)
RETURNS void AS $$
BEGIN
  UPDATE firms
  SET ai_tokens_used = COALESCE(ai_tokens_used, 0) + p_tokens
  WHERE id = p_firm_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if quota is exceeded
CREATE OR REPLACE FUNCTION check_ai_quota(p_firm_id UUID, p_estimated_tokens INT)
RETURNS BOOLEAN AS $$
DECLARE
  v_quota BIGINT;
  v_used BIGINT;
  v_enabled BOOLEAN;
  v_status TEXT;
BEGIN
  SELECT ai_monthly_quota, ai_tokens_used, ai_enabled, ai_status
  INTO v_quota, v_used, v_enabled, v_status
  FROM firms
  WHERE id = p_firm_id;

  IF v_enabled = false OR v_status != 'active' THEN
    RETURN false;
  END IF;

  IF (v_used + p_estimated_tokens) > v_quota THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
