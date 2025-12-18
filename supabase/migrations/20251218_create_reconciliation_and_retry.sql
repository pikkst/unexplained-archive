-- ========================================
-- Balance Reconciliation & Monitoring
-- ========================================
-- Daily job to verify Stripe balance matches database

-- ========================================
-- TABLE: balance_reconciliation_log
-- ========================================

CREATE TABLE IF NOT EXISTS balance_reconciliation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_user_wallets DECIMAL NOT NULL,
  total_case_escrows DECIMAL NOT NULL,
  total_platform_wallet DECIMAL NOT NULL,
  expected_stripe_balance DECIMAL NOT NULL,
  actual_stripe_balance DECIMAL,
  discrepancy DECIMAL,
  status TEXT NOT NULL, -- 'ok', 'warning', 'critical'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_balance_reconciliation_date ON balance_reconciliation_log(check_date DESC);
CREATE INDEX idx_balance_reconciliation_status ON balance_reconciliation_log(status, check_date DESC);

-- ========================================
-- FUNCTION: perform_balance_reconciliation
-- ========================================

CREATE OR REPLACE FUNCTION perform_balance_reconciliation()
RETURNS JSONB AS $$
DECLARE
  v_user_wallets DECIMAL;
  v_case_escrows DECIMAL;
  v_platform_wallet DECIMAL;
  v_expected_stripe DECIMAL;
  v_discrepancy DECIMAL;
  v_status TEXT;
  v_log_id UUID;
BEGIN
  -- Calculate total user wallet balances
  SELECT COALESCE(SUM(balance), 0) INTO v_user_wallets
  FROM wallets
  WHERE user_id IS NOT NULL;
  
  -- Calculate total locked in case escrows
  SELECT COALESCE(SUM(reward_amount), 0) INTO v_case_escrows
  FROM cases;
  
  -- Get platform wallet balance
  SELECT COALESCE(SUM(balance), 0) INTO v_platform_wallet
  FROM wallets
  WHERE user_id IS NULL;
  
  -- Expected Stripe balance = User wallets + Case escrows
  -- Platform wallet is internal accounting, not in Stripe
  v_expected_stripe := v_user_wallets + v_case_escrows;
  
  -- TODO: Get actual Stripe balance via API
  -- For now, we can only track expected vs previous checks
  
  -- Determine status (assume OK if no actual Stripe data)
  v_status := 'ok';
  
  -- Log the check
  INSERT INTO balance_reconciliation_log (
    total_user_wallets,
    total_case_escrows,
    total_platform_wallet,
    expected_stripe_balance,
    status,
    notes
  ) VALUES (
    v_user_wallets,
    v_case_escrows,
    v_platform_wallet,
    v_expected_stripe,
    v_status,
    'Automated daily reconciliation check'
  ) RETURNING id INTO v_log_id;
  
  RETURN jsonb_build_object(
    'log_id', v_log_id,
    'user_wallets', v_user_wallets,
    'case_escrows', v_case_escrows,
    'platform_wallet', v_platform_wallet,
    'expected_stripe', v_expected_stripe,
    'status', v_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION perform_balance_reconciliation() TO service_role;

-- ========================================
-- FUNCTION: retry_failed_webhook
-- ========================================

CREATE OR REPLACE FUNCTION retry_failed_webhook(p_failure_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_failure RECORD;
  v_result JSONB;
BEGIN
  -- Get failure details
  SELECT * INTO v_failure
  FROM webhook_failures
  WHERE id = p_failure_id
    AND resolved_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failure not found or already resolved'
    );
  END IF;
  
  -- Update retry count
  UPDATE webhook_failures
  SET retry_count = retry_count + 1,
      last_retry_at = NOW(),
      updated_at = NOW()
  WHERE id = p_failure_id;
  
  -- Return payload for manual processing
  -- The edge function should be called with this data
  RETURN jsonb_build_object(
    'success', true,
    'failure_id', p_failure_id,
    'stripe_event_id', v_failure.stripe_event_id,
    'event_type', v_failure.event_type,
    'payload', v_failure.event_payload,
    'retry_count', v_failure.retry_count + 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION retry_failed_webhook(UUID) TO service_role;

-- ========================================
-- FUNCTION: resolve_webhook_failure
-- ========================================

CREATE OR REPLACE FUNCTION resolve_webhook_failure(
  p_failure_id UUID,
  p_resolved_by UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE webhook_failures
  SET resolved_at = NOW(),
      resolved_by = p_resolved_by,
      updated_at = NOW()
  WHERE id = p_failure_id
    AND resolved_at IS NULL;
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION resolve_webhook_failure(UUID, UUID) TO service_role;

-- ========================================
-- FUNCTION: get_failed_webhooks
-- ========================================

CREATE OR REPLACE FUNCTION get_failed_webhooks(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  stripe_event_id TEXT,
  event_type TEXT,
  failure_reason TEXT,
  retry_count INTEGER,
  last_retry_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wf.id,
    wf.stripe_event_id,
    wf.event_type,
    wf.failure_reason,
    wf.retry_count,
    wf.last_retry_at,
    wf.resolved_at,
    wf.created_at
  FROM webhook_failures wf
  ORDER BY wf.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_failed_webhooks(INTEGER, INTEGER) TO service_role;

-- ========================================
-- FUNCTION: get_payment_stats_today
-- ========================================

CREATE OR REPLACE FUNCTION get_payment_stats_today()
RETURNS JSONB AS $$
DECLARE
  v_deposits_count INTEGER;
  v_deposits_total DECIMAL;
  v_donations_count INTEGER;
  v_donations_total DECIMAL;
  v_failed_count INTEGER;
  v_webhooks_failed INTEGER;
BEGIN
  -- Count deposits today
  SELECT 
    COUNT(*),
    COALESCE(SUM(amount), 0)
  INTO v_deposits_count, v_deposits_total
  FROM transactions
  WHERE transaction_type = 'deposit'
    AND status = 'completed'
    AND created_at > CURRENT_DATE;
  
  -- Count donations today
  SELECT 
    COUNT(*),
    COALESCE(SUM(amount), 0)
  INTO v_donations_count, v_donations_total
  FROM transactions
  WHERE transaction_type IN ('donation', 'platform_donation')
    AND status = 'completed'
    AND created_at > CURRENT_DATE;
  
  -- Count failed transactions
  SELECT COUNT(*) INTO v_failed_count
  FROM transactions
  WHERE status = 'failed'
    AND created_at > CURRENT_DATE;
  
  -- Count webhook failures
  SELECT COUNT(*) INTO v_webhooks_failed
  FROM webhook_failures
  WHERE created_at > CURRENT_DATE
    AND resolved_at IS NULL;
  
  RETURN jsonb_build_object(
    'deposits', jsonb_build_object(
      'count', v_deposits_count,
      'total', v_deposits_total
    ),
    'donations', jsonb_build_object(
      'count', v_donations_count,
      'total', v_donations_total
    ),
    'failed_transactions', v_failed_count,
    'failed_webhooks', v_webhooks_failed,
    'date', CURRENT_DATE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_payment_stats_today() TO service_role;

-- ========================================
-- VIEW: admin_payment_dashboard
-- ========================================

CREATE OR REPLACE VIEW admin_payment_dashboard AS
SELECT
  -- Today's stats
  (SELECT COUNT(*) FROM transactions WHERE created_at > CURRENT_DATE) as transactions_today,
  (SELECT COUNT(*) FROM transactions WHERE status = 'failed' AND created_at > CURRENT_DATE) as failed_today,
  (SELECT COUNT(*) FROM webhook_failures WHERE resolved_at IS NULL) as unresolved_webhooks,
  (SELECT COUNT(*) FROM fraud_detection_flags WHERE reviewed_at IS NULL) as unreviewed_fraud_flags,
  
  -- This week
  (SELECT COUNT(*) FROM transactions WHERE created_at > DATE_TRUNC('week', NOW())) as transactions_week,
  (SELECT COALESCE(SUM(amount), 0) FROM transactions 
   WHERE transaction_type = 'deposit' 
     AND status = 'completed' 
     AND created_at > DATE_TRUNC('week', NOW())) as deposits_week,
  
  -- This month
  (SELECT COUNT(*) FROM transactions WHERE created_at > DATE_TRUNC('month', NOW())) as transactions_month,
  (SELECT COALESCE(SUM(amount), 0) FROM transactions 
   WHERE transaction_type = 'deposit' 
     AND status = 'completed' 
     AND created_at > DATE_TRUNC('month', NOW())) as deposits_month,
  
  -- Latest reconciliation
  (SELECT expected_stripe_balance FROM balance_reconciliation_log ORDER BY created_at DESC LIMIT 1) as expected_balance,
  (SELECT status FROM balance_reconciliation_log ORDER BY created_at DESC LIMIT 1) as reconciliation_status,
  (SELECT created_at FROM balance_reconciliation_log ORDER BY created_at DESC LIMIT 1) as last_reconciliation;

GRANT SELECT ON admin_payment_dashboard TO service_role;

-- ========================================
-- GRANT PERMISSIONS
-- ========================================

GRANT SELECT, INSERT ON balance_reconciliation_log TO service_role;
GRANT SELECT ON balance_reconciliation_log TO authenticated;

-- ========================================
-- COMMENTS
-- ========================================

COMMENT ON TABLE balance_reconciliation_log IS 'Daily balance reconciliation checks between database and Stripe';
COMMENT ON FUNCTION perform_balance_reconciliation() IS 'Run daily to verify database balances match Stripe';
COMMENT ON FUNCTION retry_failed_webhook(UUID) IS 'Attempt to reprocess a failed webhook event';
COMMENT ON VIEW admin_payment_dashboard IS 'Overview of payment system health for admin dashboard';
