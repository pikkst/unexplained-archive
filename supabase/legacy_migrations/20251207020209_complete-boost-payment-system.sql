-- COMPLETE BOOST PURCHASE SYSTEM WITH WALLET & STRIPE
-- This replaces the incomplete purchase_case_boost function with full functionality
-- Uses SIMPLIFIED ARCHITECTURE: NO platform user in DB, just track revenue

-- =============================================
-- STEP 1: ENSURE PLATFORM REVENUE TABLE EXISTS
-- =============================================

-- Platform revenue tracking (no wallet needed, money goes to Stripe Revenue Account)
CREATE TABLE IF NOT EXISTS platform_revenue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  revenue_type TEXT NOT NULL CHECK (revenue_type IN ('platform_fee', 'subscription', 'featured_case', 'ad_revenue', 'api_access', 'boost_purchase')),
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'EUR' NOT NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =============================================
-- STEP 2: IMPROVED PURCHASE FUNCTION WITH FULL TRANSACTION HANDLING
-- =============================================

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
  v_user_wallet_id UUID;
  v_platform_wallet_id UUID;
  v_transaction_id UUID;
  v_featured_until TIMESTAMPTZ;
  v_normalized_boost_type TEXT;
BEGIN
  -- Normalize boost type (handle both naming conventions)
  v_normalized_boost_type := CASE 
    WHEN p_boost_type IN ('basic_24h', '24h') THEN '24h'
    WHEN p_boost_type IN ('premium_72h', '7d') THEN '7d'
    WHEN p_boost_type IN ('ultra_168h', '30d') THEN '30d'
    ELSE p_boost_type
  END;

  -- Get boost pricing
  SELECT price, duration_hours INTO v_price, v_duration_hours
  FROM boost_pricing
  WHERE boost_type = v_normalized_boost_type
    AND is_active = true;
  
  IF v_price IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid boost type: ' || p_boost_type
    );
  END IF;
  
  -- Verify case exists and ownership
  SELECT user_id INTO v_case_owner
  FROM cases
  WHERE id = p_case_id;
  
  IF v_case_owner IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Case not found'
    );
  END IF;
  
  IF v_case_owner != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You can only boost your own cases'
    );
  END IF;
  
  -- Calculate featured_until time
  v_featured_until := NOW() + (v_duration_hours || ' hours')::INTERVAL;
  
  -- WALLET PAYMENT PATH
  IF p_stripe_payment_id IS NULL THEN
    -- Get user wallet
    SELECT id, balance INTO v_user_wallet_id, v_wallet_balance
    FROM wallets
    WHERE user_id = p_user_id;
    
    IF v_user_wallet_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Wallet not found. Please contact support.'
      );
    END IF;
    
    IF v_wallet_balance < v_price THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Insufficient wallet balance. You have €' || v_wallet_balance || ' but need €' || v_price
      );
    END IF;
    
    -- Deduct from user wallet (virtual balance in DB)
    -- Real money stays in Stripe Operations Account
    UPDATE wallets
    SET 
      balance = balance - v_price,
      updated_at = NOW()
    WHERE id = v_user_wallet_id;
    
    -- Create transaction record (internal transfer, no actual Stripe API call)
    INSERT INTO transactions (
      from_wallet_id,
      to_wallet_id,
      amount,
      transaction_type,
      status,
      description,
      metadata
    ) VALUES (
      v_user_wallet_id,
      NULL, -- No "to" wallet - this goes to platform revenue
      v_price,
      'boost_purchase',
      'completed',
      'Case boost purchase: ' || v_normalized_boost_type,
      jsonb_build_object(
        'case_id', p_case_id,
        'boost_type', v_normalized_boost_type,
        'duration_hours', v_duration_hours,
        'payment_method', 'wallet'
      )
    ) RETURNING id INTO v_transaction_id;
    
  END IF;
  
  -- STRIPE PAYMENT PATH (already paid via Stripe, money in Operations Account)
  IF p_stripe_payment_id IS NOT NULL THEN
    -- Get user wallet for transaction record
    SELECT id INTO v_user_wallet_id FROM wallets WHERE user_id = p_user_id;
    
    -- Record Stripe transaction (money already in Stripe Operations Account)
    INSERT INTO transactions (
      from_wallet_id,
      to_wallet_id,
      amount,
      transaction_type,
      status,
      description,
      stripe_payment_intent_id,
      metadata
    ) VALUES (
      v_user_wallet_id,
      NULL, -- No "to" wallet - money goes to Stripe Revenue Account
      v_price,
      'boost_purchase',
      'completed',
      'Case boost purchase via Stripe: ' || v_normalized_boost_type,
      p_stripe_payment_id,
      jsonb_build_object(
        'case_id', p_case_id,
        'boost_type', v_normalized_boost_type,
        'duration_hours', v_duration_hours,
        'payment_method', 'stripe'
      )
    ) RETURNING id INTO v_transaction_id;
  END IF;
  
  -- Create or extend boost (case_id is PRIMARY KEY so we use ON CONFLICT ON CONSTRAINT)
  INSERT INTO featured_cases (
    case_id,
    featured_until,
    price_paid,
    boost_type,
    paid_by,
    stripe_payment_id,
    status,
    impressions,
    clicks,
    created_at,
    updated_at
  ) VALUES (
    p_case_id,
    v_featured_until,
    v_price,
    v_normalized_boost_type,
    p_user_id,
    p_stripe_payment_id,
    'active',
    0,
    0,
    NOW(),
    NOW()
  )
  ON CONFLICT ON CONSTRAINT featured_cases_pkey
  DO UPDATE SET
    -- If existing boost is still active, extend it; otherwise start fresh
    featured_until = CASE 
      WHEN featured_cases.featured_until > NOW() 
      THEN featured_cases.featured_until + (v_duration_hours || ' hours')::INTERVAL
      ELSE NOW() + (v_duration_hours || ' hours')::INTERVAL
    END,
    price_paid = featured_cases.price_paid + v_price,
    boost_type = EXCLUDED.boost_type,
    stripe_payment_id = COALESCE(EXCLUDED.stripe_payment_id, featured_cases.stripe_payment_id),
    status = 'active',
    updated_at = NOW();
  
  -- Record platform revenue (tracking only, real money in Stripe Revenue Account)
  INSERT INTO platform_revenue (
    revenue_type,
    amount,
    currency,
    transaction_id,
    metadata
  ) VALUES (
    'boost_purchase',
    v_price,
    'EUR',
    v_transaction_id,
    jsonb_build_object(
      'case_id', p_case_id,
      'user_id', p_user_id,
      'boost_type', v_normalized_boost_type,
      'duration_hours', v_duration_hours,
      'payment_method', CASE WHEN p_stripe_payment_id IS NULL THEN 'wallet' ELSE 'stripe' END
    )
  );
  
  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'boost_type', v_normalized_boost_type,
    'duration_hours', v_duration_hours,
    'price', v_price,
    'featured_until', v_featured_until,
    'transaction_id', v_transaction_id,
    'payment_method', CASE WHEN p_stripe_payment_id IS NULL THEN 'wallet' ELSE 'stripe' END
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Rollback is automatic, just return error
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Transaction failed: ' || SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- STEP 3: CREATE ANALYTICS FUNCTIONS
-- =============================================

-- Function to get boost analytics for a user
CREATE OR REPLACE FUNCTION get_user_boost_analytics(p_user_id UUID)
RETURNS TABLE (
  case_id UUID,
  case_title TEXT,
  boost_type TEXT,
  featured_until TIMESTAMPTZ,
  price_paid DECIMAL,
  impressions INT,
  clicks INT,
  ctr DECIMAL,
  status TEXT,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fc.case_id,
    c.title,
    fc.boost_type,
    fc.featured_until,
    fc.price_paid,
    fc.impressions,
    fc.clicks,
    CASE WHEN fc.impressions > 0 
      THEN ROUND((fc.clicks::DECIMAL / fc.impressions::DECIMAL) * 100, 2)
      ELSE 0 
    END as ctr,
    fc.status,
    (fc.status = 'active' AND fc.featured_until > NOW()) as is_active
  FROM featured_cases fc
  JOIN cases c ON c.id = fc.case_id
  WHERE fc.paid_by = p_user_id
  ORDER BY fc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track impression (called when boost is shown)
CREATE OR REPLACE FUNCTION track_boost_impression(p_case_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE featured_cases
  SET impressions = impressions + 1,
      updated_at = NOW()
  WHERE case_id = p_case_id
    AND status = 'active'
    AND featured_until > NOW();
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track click (called when boosted case is clicked)
CREATE OR REPLACE FUNCTION track_boost_click(p_case_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE featured_cases
  SET clicks = clicks + 1,
      updated_at = NOW()
  WHERE case_id = p_case_id
    AND status = 'active'
    AND featured_until > NOW();
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- STEP 4: AUTOMATIC EXPIRATION (run via cron or periodically)
-- =============================================

DROP FUNCTION IF EXISTS expire_old_boosts();

CREATE FUNCTION expire_old_boosts()
RETURNS TABLE (expired_count INT) AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE featured_cases
  SET status = 'expired',
      updated_at = NOW()
  WHERE status = 'active'
    AND featured_until <= NOW();
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON FUNCTION purchase_case_boost IS 'Purchase case boost with wallet or Stripe. Handles all transactions and revenue tracking.';
COMMENT ON FUNCTION get_user_boost_analytics IS 'Get detailed analytics for all boosts purchased by a user';
COMMENT ON FUNCTION track_boost_impression IS 'Increment impression count when boosted case is displayed';
COMMENT ON FUNCTION track_boost_click IS 'Increment click count when boosted case is clicked';
COMMENT ON FUNCTION expire_old_boosts IS 'Mark expired boosts as expired (run periodically)';
