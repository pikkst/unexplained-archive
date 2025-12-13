-- =============================================
-- FIX PREMIUM SERVICES TRANSACTIONS
-- Resolves "column user_id does not exist" error
-- =============================================

-- 1. Update Transaction Types Constraint
-- We need to allow all transaction types used in the system
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_transaction_type_check;

ALTER TABLE transactions ADD CONSTRAINT transactions_transaction_type_check 
  CHECK (transaction_type IN (
    'deposit', 
    'donation', 
    'reward', 
    'subscription', 
    'withdrawal', 
    'platform_fee', 
    'refund', 
    'background_check', 
    'case_boost',
    'boost_purchase',
    'escrow_hold',
    'escrow_release'
  ));

-- 2. Fix request_background_check function
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
BEGIN
  -- Get user's wallet
  SELECT id, balance INTO v_wallet_id, v_wallet_balance
  FROM wallets
  WHERE user_id = p_investigator_id;

  IF v_wallet_id IS NULL THEN
    -- Try to create wallet if missing (should exist from triggers, but safety first)
    INSERT INTO wallets (user_id, balance) VALUES (p_investigator_id, 0)
    RETURNING id, balance INTO v_wallet_id, v_wallet_balance;
  END IF;

  -- Check if already has active verification
  IF EXISTS (
    SELECT 1 FROM background_checks
    WHERE investigator_id = p_investigator_id
      AND status IN ('pending', 'in_progress', 'completed')
      AND (expires_at IS NULL OR expires_at > NOW())
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You already have an active verification'
    );
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

-- 3. Fix purchase_case_boost function
CREATE OR REPLACE FUNCTION purchase_case_boost(
  p_case_id UUID,
  p_user_id UUID,
  p_boost_type TEXT,
  p_stripe_payment_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_price DECIMAL(10,2);
  v_duration_hours INT;
  v_case_owner UUID;
  v_wallet_balance DECIMAL(10,2);
  v_wallet_id UUID;
BEGIN
  -- Get user's wallet
  SELECT id, balance INTO v_wallet_id, v_wallet_balance
  FROM wallets
  WHERE user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
     RETURN jsonb_build_object(
      'success', false,
      'error', 'Wallet not found'
    );
  END IF;

  -- Get boost pricing
  SELECT price, duration_hours INTO v_price, v_duration_hours
  FROM boost_pricing
  WHERE boost_type = p_boost_type;
  
  IF v_price IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid boost type'
    );
  END IF;
  
  -- Verify case ownership
  SELECT user_id INTO v_case_owner
  FROM cases
  WHERE id = p_case_id;
  
  IF v_case_owner != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You can only boost your own cases'
    );
  END IF;
  
  -- Check if paying with wallet
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
  
  -- Create or update boost
  INSERT INTO featured_cases (
    case_id,
    featured_until,
    price_paid,
    boost_type,
    paid_by,
    stripe_payment_id,
    status
  ) VALUES (
    p_case_id,
    NOW() + (v_duration_hours || ' hours')::INTERVAL,
    v_price,
    p_boost_type,
    p_user_id,
    p_stripe_payment_id,
    'active'
  )
  ON CONFLICT (case_id) 
  DO UPDATE SET
    featured_until = GREATEST(featured_cases.featured_until, NOW()) + (v_duration_hours || ' hours')::INTERVAL,
    price_paid = featured_cases.price_paid + v_price,
    boost_type = EXCLUDED.boost_type,
    status = 'active';
  
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
    'case_boost',
    v_price,
    'completed',
    'Featured case boost: ' || p_boost_type,
    p_stripe_payment_id,
    jsonb_build_object(
      'case_id', p_case_id,
      'boost_type', p_boost_type,
      'duration_hours', v_duration_hours
    )
  );
  
  -- Log platform revenue
  INSERT INTO platform_revenue (
    revenue_type,
    amount,
    metadata
  ) VALUES (
    'featured_case',
    v_price,
    jsonb_build_object(
      'case_id', p_case_id,
      'boost_type', p_boost_type,
      'paid_by', p_user_id
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Case boost activated',
    'featured_until', (NOW() + (v_duration_hours || ' hours')::INTERVAL)::text,
    'price_paid', v_price
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Fix activate_pro_subscription function
CREATE OR REPLACE FUNCTION activate_pro_subscription(
  p_user_id UUID,
  p_plan_type TEXT,
  p_stripe_subscription_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_wallet_id UUID;
BEGIN
  -- Get user's wallet (for transaction logging)
  SELECT id INTO v_wallet_id
  FROM wallets
  WHERE user_id = p_user_id;

  -- Update subscription record
  UPDATE subscriptions
  SET 
    status = 'active',
    stripe_subscription_id = p_stripe_subscription_id,
    current_period_start = NOW(),
    current_period_end = NOW() + INTERVAL '1 month'
  WHERE user_id = p_user_id;
  
  -- Update profile Pro status
  UPDATE profiles
  SET 
    is_pro_member = TRUE,
    pro_since = NOW()
  WHERE id = p_user_id;
  
  -- Log transaction
  -- Note: We only log it if we have a wallet to attach it to, or we could handle NULL from_wallet_id
  -- But for now, let's assume every user has a wallet.
  IF v_wallet_id IS NOT NULL THEN
    INSERT INTO transactions (
      from_wallet_id,
      transaction_type,
      amount,
      status,
      description,
      metadata
    ) VALUES (
      v_wallet_id,
      'subscription',
      CASE 
        WHEN p_plan_type = 'investigator_pro' THEN 15.00
        WHEN p_plan_type = 'investigator_basic' THEN 10.00
        ELSE 5.00
      END,
      'completed',
      'Subscription activated: ' || p_plan_type,
      jsonb_build_object(
        'plan_type', p_plan_type,
        'stripe_subscription_id', p_stripe_subscription_id
      )
    );
  END IF;
  
  v_result := jsonb_build_object(
    'success', true,
    'message', 'Pro subscription activated',
    'plan_type', p_plan_type
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;