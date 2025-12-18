-- ========================================
-- Payment System Improvements
-- ========================================
-- 1. Webhook failures tracking
-- 2. User notifications for payment failures
-- 3. Admin monitoring capabilities

-- ========================================
-- TABLE: webhook_failures
-- ========================================
-- Track all webhook failures for debugging and retry

CREATE TABLE IF NOT EXISTS webhook_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  failure_reason TEXT NOT NULL,
  event_payload JSONB NOT NULL,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_failures_event_id ON webhook_failures(stripe_event_id);
CREATE INDEX idx_webhook_failures_unresolved ON webhook_failures(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX idx_webhook_failures_created_at ON webhook_failures(created_at DESC);

-- ========================================
-- TABLE: user_notifications
-- ========================================
-- User-facing notifications for payment issues

CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'payment_failed', 'deposit_failed', 'withdrawal_failed', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'info', -- 'info', 'warning', 'error', 'success'
  read_at TIMESTAMPTZ,
  action_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX idx_user_notifications_unread ON user_notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_user_notifications_created_at ON user_notifications(created_at DESC);

-- ========================================
-- TABLE: payment_rate_limits
-- ========================================
-- Track rate limiting per user/IP

CREATE TABLE IF NOT EXISTS payment_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- user_id or IP address
  identifier_type TEXT NOT NULL, -- 'user' or 'ip'
  endpoint TEXT NOT NULL, -- 'deposit', 'donation', etc.
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  blocked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_rate_limits_identifier ON payment_rate_limits(identifier, endpoint);
CREATE INDEX idx_payment_rate_limits_window ON payment_rate_limits(window_start);

-- ========================================
-- TABLE: fraud_detection_flags
-- ========================================
-- Track suspicious payment activity

CREATE TABLE IF NOT EXISTS fraud_detection_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  flag_type TEXT NOT NULL, -- 'multiple_cards', 'high_velocity', 'suspicious_amount', etc.
  severity TEXT NOT NULL, -- 'low', 'medium', 'high', 'critical'
  description TEXT NOT NULL,
  metadata JSONB,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  resolution TEXT, -- 'false_positive', 'confirmed_fraud', 'blocked'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fraud_flags_user_id ON fraud_detection_flags(user_id);
CREATE INDEX idx_fraud_flags_unreviewed ON fraud_detection_flags(reviewed_at) WHERE reviewed_at IS NULL;
CREATE INDEX idx_fraud_flags_severity ON fraud_detection_flags(severity, created_at DESC);

-- ========================================
-- FUNCTION: log_webhook_failure
-- ========================================
-- Called by edge function when webhook processing fails

CREATE OR REPLACE FUNCTION log_webhook_failure(
  p_stripe_event_id TEXT,
  p_event_type TEXT,
  p_failure_reason TEXT,
  p_event_payload JSONB
)
RETURNS UUID AS $$
DECLARE
  v_failure_id UUID;
BEGIN
  -- Insert failure record
  INSERT INTO webhook_failures (
    stripe_event_id,
    event_type,
    failure_reason,
    event_payload
  ) VALUES (
    p_stripe_event_id,
    p_event_type,
    p_failure_reason,
    p_event_payload
  ) RETURNING id INTO v_failure_id;
  
  -- Create notification for affected user if identifiable
  IF p_event_payload->>'metadata'->>'userId' IS NOT NULL THEN
    INSERT INTO user_notifications (
      user_id,
      type,
      title,
      message,
      severity,
      metadata
    ) VALUES (
      (p_event_payload->>'metadata'->>'userId')::UUID,
      'payment_processing_error',
      'Payment Processing Issue',
      'We encountered an issue processing your payment. Our team has been notified and will resolve it shortly. Your payment is safe.',
      'error',
      jsonb_build_object(
        'stripe_event_id', p_stripe_event_id,
        'failure_id', v_failure_id
      )
    );
  END IF;
  
  RETURN v_failure_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION log_webhook_failure(TEXT, TEXT, TEXT, JSONB) TO service_role;

-- ========================================
-- FUNCTION: notify_payment_failure
-- ========================================
-- Create user notification for payment failures

CREATE OR REPLACE FUNCTION notify_payment_failure(
  p_user_id UUID,
  p_failure_type TEXT,
  p_amount DECIMAL,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_title TEXT;
  v_message TEXT;
BEGIN
  -- Customize message based on failure type
  CASE p_failure_type
    WHEN 'deposit_failed' THEN
      v_title := 'Deposit Failed';
      v_message := format('Your deposit of €%s could not be processed. %s', 
                         p_amount, 
                         COALESCE('Reason: ' || p_reason, 'Please try again or contact support.'));
    
    WHEN 'withdrawal_failed' THEN
      v_title := 'Withdrawal Failed';
      v_message := format('Your withdrawal of €%s could not be completed. The funds have been returned to your wallet. %s',
                         p_amount,
                         COALESCE('Reason: ' || p_reason, 'Please check your payment details.'));
    
    WHEN 'donation_failed' THEN
      v_title := 'Donation Failed';
      v_message := format('Your donation of €%s could not be processed. %s',
                         p_amount,
                         COALESCE('Reason: ' || p_reason, 'Please try again.'));
    
    ELSE
      v_title := 'Payment Issue';
      v_message := format('There was an issue processing your payment of €%s. %s',
                         p_amount,
                         COALESCE('Reason: ' || p_reason, 'Please contact support.'));
  END CASE;
  
  -- Create notification
  INSERT INTO user_notifications (
    user_id,
    type,
    title,
    message,
    severity,
    metadata
  ) VALUES (
    p_user_id,
    p_failure_type,
    v_title,
    v_message,
    'error',
    jsonb_build_object(
      'amount', p_amount,
      'reason', p_reason
    )
  ) RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION notify_payment_failure(UUID, TEXT, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION notify_payment_failure(UUID, TEXT, DECIMAL, TEXT) TO service_role;

-- ========================================
-- FUNCTION: check_rate_limit
-- ========================================
-- Check if user/IP has exceeded rate limit

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_identifier_type TEXT,
  p_endpoint TEXT,
  p_max_requests INTEGER DEFAULT 10,
  p_window_minutes INTEGER DEFAULT 60
)
RETURNS JSONB AS $$
DECLARE
  v_existing RECORD;
  v_window_start TIMESTAMPTZ;
BEGIN
  v_window_start := NOW() - (p_window_minutes || ' minutes')::INTERVAL;
  
  -- Check if blocked
  SELECT * INTO v_existing
  FROM payment_rate_limits
  WHERE identifier = p_identifier
    AND identifier_type = p_identifier_type
    AND endpoint = p_endpoint
    AND blocked_until > NOW();
  
  IF FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'Rate limit exceeded',
      'retry_after', v_existing.blocked_until
    );
  END IF;
  
  -- Get or create rate limit record
  SELECT * INTO v_existing
  FROM payment_rate_limits
  WHERE identifier = p_identifier
    AND identifier_type = p_identifier_type
    AND endpoint = p_endpoint
    AND window_start > v_window_start;
  
  IF FOUND THEN
    -- Update existing
    IF v_existing.request_count >= p_max_requests THEN
      -- Block for 1 hour
      UPDATE payment_rate_limits
      SET blocked_until = NOW() + INTERVAL '1 hour',
          updated_at = NOW()
      WHERE id = v_existing.id;
      
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'Rate limit exceeded',
        'retry_after', NOW() + INTERVAL '1 hour'
      );
    ELSE
      -- Increment counter
      UPDATE payment_rate_limits
      SET request_count = request_count + 1,
          updated_at = NOW()
      WHERE id = v_existing.id;
      
      RETURN jsonb_build_object('allowed', true);
    END IF;
  ELSE
    -- Create new record
    INSERT INTO payment_rate_limits (
      identifier,
      identifier_type,
      endpoint,
      request_count,
      window_start
    ) VALUES (
      p_identifier,
      p_identifier_type,
      p_endpoint,
      1,
      NOW()
    );
    
    RETURN jsonb_build_object('allowed', true);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_rate_limit(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO service_role;

-- ========================================
-- FUNCTION: detect_fraud_pattern
-- ========================================
-- Check for suspicious payment patterns

CREATE OR REPLACE FUNCTION detect_fraud_pattern(
  p_user_id UUID,
  p_amount DECIMAL,
  p_payment_method TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_recent_payments INTEGER;
  v_total_today DECIMAL;
  v_flags JSONB := '[]'::JSONB;
BEGIN
  -- Check 1: High velocity (>5 payments in 10 minutes)
  SELECT COUNT(*) INTO v_recent_payments
  FROM transactions
  WHERE user_id = p_user_id
    AND created_at > NOW() - INTERVAL '10 minutes'
    AND status = 'completed';
  
  IF v_recent_payments > 5 THEN
    v_flags := v_flags || jsonb_build_object(
      'type', 'high_velocity',
      'severity', 'high',
      'description', format('%s payments in 10 minutes', v_recent_payments)
    );
  END IF;
  
  -- Check 2: Unusually high amount (>€1000)
  IF p_amount > 1000 THEN
    v_flags := v_flags || jsonb_build_object(
      'type', 'high_amount',
      'severity', 'medium',
      'description', format('Large transaction: €%s', p_amount)
    );
  END IF;
  
  -- Check 3: Multiple deposits today (>€5000)
  SELECT COALESCE(SUM(amount), 0) INTO v_total_today
  FROM transactions
  WHERE user_id = p_user_id
    AND transaction_type = 'deposit'
    AND created_at > CURRENT_DATE
    AND status = 'completed';
  
  IF v_total_today > 5000 THEN
    v_flags := v_flags || jsonb_build_object(
      'type', 'high_daily_volume',
      'severity', 'high',
      'description', format('Total deposits today: €%s', v_total_today)
    );
  END IF;
  
  -- Log flags if any detected
  IF jsonb_array_length(v_flags) > 0 THEN
    INSERT INTO fraud_detection_flags (
      user_id,
      flag_type,
      severity,
      description,
      metadata
    )
    SELECT
      p_user_id,
      flag->>'type',
      flag->>'severity',
      flag->>'description',
      jsonb_build_object('amount', p_amount, 'payment_method', p_payment_method)
    FROM jsonb_array_elements(v_flags) AS flag;
    
    RETURN jsonb_build_object(
      'suspicious', true,
      'flags', v_flags
    );
  END IF;
  
  RETURN jsonb_build_object('suspicious', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION detect_fraud_pattern(UUID, DECIMAL, TEXT) TO service_role;

-- ========================================
-- FUNCTION: get_unread_notifications
-- ========================================
-- Get user's unread notifications

CREATE OR REPLACE FUNCTION get_unread_notifications(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  type TEXT,
  title TEXT,
  message TEXT,
  severity TEXT,
  action_url TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    n.id,
    n.type,
    n.title,
    n.message,
    n.severity,
    n.action_url,
    n.created_at
  FROM user_notifications n
  WHERE n.user_id = p_user_id
    AND n.read_at IS NULL
  ORDER BY n.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_unread_notifications(UUID) TO authenticated;

-- ========================================
-- FUNCTION: mark_notification_read
-- ========================================

CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE user_notifications
  SET read_at = NOW()
  WHERE id = p_notification_id
    AND read_at IS NULL;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION mark_notification_read(UUID) TO authenticated;

-- ========================================
-- RLS POLICIES
-- ========================================

ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE fraud_detection_flags ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
  ON user_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON user_notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Only admins can view fraud flags
CREATE POLICY "Admins can view all fraud flags"
  ON fraud_detection_flags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- ========================================
-- GRANT PERMISSIONS
-- ========================================

GRANT SELECT ON webhook_failures TO service_role;
GRANT INSERT, UPDATE ON webhook_failures TO service_role;

GRANT SELECT ON user_notifications TO authenticated;
GRANT INSERT ON user_notifications TO service_role;
GRANT UPDATE(read_at) ON user_notifications TO authenticated;

GRANT ALL ON payment_rate_limits TO service_role;
GRANT ALL ON fraud_detection_flags TO service_role;

-- ========================================
-- COMMENTS
-- ========================================

COMMENT ON TABLE webhook_failures IS 'Tracks failed webhook processing for debugging and retry';
COMMENT ON TABLE user_notifications IS 'User-facing notifications for payment issues and updates';
COMMENT ON TABLE payment_rate_limits IS 'Rate limiting tracking per user/IP to prevent abuse';
COMMENT ON TABLE fraud_detection_flags IS 'Suspicious payment activity detection and tracking';
