-- Add rate limiting for withdrawal requests
-- Prevents spam and abuse

CREATE TABLE IF NOT EXISTS withdrawal_rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_count INTEGER DEFAULT 0,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_withdrawal_rate_limits_user ON withdrawal_rate_limits(user_id);

-- Function to check rate limit (max 3 withdrawals per day)
CREATE OR REPLACE FUNCTION public.check_withdrawal_rate_limit(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_current_count INTEGER;
  v_window_start TIMESTAMPTZ;
  v_max_per_day INTEGER := 3; -- Maximum 3 withdrawals per day
BEGIN
  -- Get current rate limit data
  SELECT request_count, window_start 
  INTO v_current_count, v_window_start
  FROM withdrawal_rate_limits
  WHERE user_id = p_user_id;
  
  -- If no record exists, create one
  IF v_current_count IS NULL THEN
    INSERT INTO withdrawal_rate_limits (user_id, request_count, window_start)
    VALUES (p_user_id, 1, NOW());
    RETURN jsonb_build_object('allowed', true, 'remaining', v_max_per_day - 1);
  END IF;
  
  -- Check if window has expired (24 hours)
  IF v_window_start < NOW() - INTERVAL '24 hours' THEN
    -- Reset counter
    UPDATE withdrawal_rate_limits
    SET request_count = 1, window_start = NOW()
    WHERE user_id = p_user_id;
    RETURN jsonb_build_object('allowed', true, 'remaining', v_max_per_day - 1);
  END IF;
  
  -- Check if limit exceeded
  IF v_current_count >= v_max_per_day THEN
    RETURN jsonb_build_object(
      'allowed', false, 
      'remaining', 0,
      'error', 'Rate limit exceeded. Maximum ' || v_max_per_day || ' withdrawals per day.',
      'reset_at', v_window_start + INTERVAL '24 hours'
    );
  END IF;
  
  -- Increment counter
  UPDATE withdrawal_rate_limits
  SET request_count = request_count + 1
  WHERE user_id = p_user_id;
  
  RETURN jsonb_build_object('allowed', true, 'remaining', v_max_per_day - v_current_count - 1);
END;
$$;

-- Enable RLS
ALTER TABLE withdrawal_rate_limits ENABLE ROW LEVEL SECURITY;

-- Users can only view their own rate limits
CREATE POLICY "Users view own rate limits" ON withdrawal_rate_limits
  FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE withdrawal_rate_limits IS 'Rate limiting for withdrawal requests to prevent abuse';
