-- =============================================
-- FIX VERIFICATION UPGRADE LOGIC
-- Allows investigators to upgrade their verification tier
-- =============================================

CREATE OR REPLACE FUNCTION request_background_check(
  p_investigator_id UUID,
  p_check_type TEXT DEFAULT 'standard',
  p_stripe_payment_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_price DECIMAL(10,2);
  v_wallet_balance DECIMAL(10,2);
  v_wallet_id UUID;
  v_check_id UUID;
  v_active_check RECORD;
BEGIN
  -- Get user's wallet
  SELECT id, balance INTO v_wallet_id, v_wallet_balance
  FROM wallets
  WHERE user_id = p_investigator_id;

  IF v_wallet_id IS NULL THEN
    -- Try to create wallet if missing
    INSERT INTO wallets (user_id, balance) VALUES (p_investigator_id, 0)
    RETURNING id, balance INTO v_wallet_id, v_wallet_balance;
  END IF;

  -- Check for an active verification
  SELECT * INTO v_active_check
  FROM background_checks
  WHERE investigator_id = p_investigator_id
    AND status IN ('pending', 'in_progress', 'completed')
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY created_at DESC
  LIMIT 1;

  -- Prevent purchasing the same or lower tier
  IF v_active_check IS NOT NULL THEN
    IF p_check_type = 'standard' AND v_active_check.check_type IN ('standard', 'premium') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'You already have an active ' || v_active_check.check_type || ' verification.'
      );
    END IF;

    IF p_check_type = 'premium' AND v_active_check.check_type = 'premium' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'You already have an active premium verification.'
      );
    END IF;
  END IF;
  
  -- Set price
  v_price := CASE 
    WHEN p_check_type = 'premium' THEN 50.00
    ELSE 25.00
  END;
  
  -- Check payment
  IF p_stripe_payment_id IS NULL THEN
    IF v_wallet_balance < v_price THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Insufficient wallet balance'
      );
    END IF;
    
    -- Deduct from wallet
    UPDATE wallets
    SET balance = balance - v_price,
        updated_at = NOW()
    WHERE id = v_wallet_id;
  END IF;
  
  -- Create background check request
  INSERT INTO background_checks (
    investigator_id,
    check_type,
    price_paid,
    status,
    stripe_payment_id,
    expires_at
  ) VALUES (
    p_investigator_id,
    p_check_type,
    v_price,
    'pending',
    p_stripe_payment_id,
    NOW() + INTERVAL '1 year'
  )
  RETURNING id INTO v_check_id;
  
  -- Log transaction
  INSERT INTO transactions (
    from_wallet_id,
    transaction_type,
    amount,
    status,
    description,
    stripe_payment_intent_id,
    metadata
  ) VALUES (
    v_wallet_id,
    'background_check',
    v_price,
    'completed',
    'Background check: ' || p_check_type,
    p_stripe_payment_id,
    jsonb_build_object(
      'check_id', v_check_id,
      'check_type', p_check_type
    )
  );
  
  -- Log platform revenue
  INSERT INTO platform_revenue (
    revenue_type,
    amount,
    metadata
  ) VALUES (
    'background_check',
    v_price,
    jsonb_build_object(
      'investigator_id', p_investigator_id,
      'check_type', p_check_type,
      'transaction_id', (SELECT id FROM transactions WHERE metadata->>'check_id' = v_check_id::text LIMIT 1)
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Background check request submitted',
    'check_id', v_check_id,
    'price_paid', v_price,
    'status', 'pending'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;