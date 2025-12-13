-- UNIFIED BOOST PRICING SYSTEM
-- This replaces all duplicate boost pricing with a single, logical system
-- Run this AFTER fix-featured-cases-schema.sql

-- =============================================
-- CLEAN UP OLD PRICING
-- =============================================

-- Delete all existing pricing to start fresh
TRUNCATE TABLE boost_pricing;

-- Add is_active column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'boost_pricing' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE boost_pricing ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- =============================================
-- INSERT UNIFIED PRICING TIERS
-- =============================================

INSERT INTO boost_pricing (boost_type, display_name, duration_hours, price, features, sort_order, is_active)
VALUES 
  -- Tier 1: Basic 24h boost
  (
    '24h',
    '24 Hour Boost',
    24,
    5.00,
    jsonb_build_array(
      'Featured for 24 hours',
      'Pin to top of listings',
      'Homepage highlight',
      'Basic analytics'
    ),
    1,
    true
  ),
  
  -- Tier 2: Premium 7 day boost
  (
    '7d',
    '7 Day Boost',
    168, -- 7 * 24 hours
    15.00,
    jsonb_build_array(
      'Featured for 7 days',
      'Pin to top of listings',
      'Homepage highlight',
      'Newsletter feature',
      'Enhanced analytics',
      'Priority support'
    ),
    2,
    true
  ),
  
  -- Tier 3: Ultra 30 day boost
  (
    '30d',
    '30 Day Premium Boost',
    720, -- 30 * 24 hours
    50.00,
    jsonb_build_array(
      'Featured for 30 days',
      'Pin to top of listings',
      'Homepage banner placement',
      'Newsletter feature',
      'Social media promotion',
      'Detailed analytics dashboard',
      'Priority support',
      'Featured badge'
    ),
    3,
    true
  )
ON CONFLICT (boost_type) 
DO UPDATE SET
  display_name = EXCLUDED.display_name,
  duration_hours = EXCLUDED.duration_hours,
  price = EXCLUDED.price,
  features = EXCLUDED.features,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

-- =============================================
-- UPDATE PURCHASE FUNCTION TO HANDLE BOTH NAMING CONVENTIONS
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
  v_normalized_boost_type TEXT;
BEGIN
  -- Normalize boost type (handle both old and new naming)
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
  
  -- Verify case ownership
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
  
  -- Check if paying with wallet
  IF p_stripe_payment_id IS NULL THEN
    SELECT balance INTO v_wallet_balance
    FROM wallets
    WHERE user_id = p_user_id;
    
    IF v_wallet_balance IS NULL OR v_wallet_balance < v_price THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Insufficient wallet balance'
      );
    END IF;
    
    -- Deduct from wallet
    UPDATE wallets
    SET balance = balance - v_price,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Record transaction
    INSERT INTO transactions (
      from_wallet_id,
      to_wallet_id,
      amount,
      transaction_type,
      status,
      description
    )
    SELECT 
      w.id,
      NULL, -- Platform revenue
      v_price,
      'boost_purchase',
      'completed',
      'Case boost purchase: ' || v_normalized_boost_type
    FROM wallets w
    WHERE w.user_id = p_user_id;
  END IF;
  
  -- Create or extend boost
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
    NOW() + (v_duration_hours || ' hours')::INTERVAL,
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
  ON CONFLICT (case_id) 
  DO UPDATE SET
    featured_until = GREATEST(featured_cases.featured_until, NOW()) + (v_duration_hours || ' hours')::INTERVAL,
    price_paid = featured_cases.price_paid + v_price,
    boost_type = EXCLUDED.boost_type,
    stripe_payment_id = COALESCE(EXCLUDED.stripe_payment_id, featured_cases.stripe_payment_id),
    status = 'active',
    updated_at = NOW();
  
  RETURN jsonb_build_object(
    'success', true,
    'boost_type', v_normalized_boost_type,
    'duration_hours', v_duration_hours,
    'price', v_price
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- VERIFY SETUP
-- =============================================

-- Show current pricing
SELECT 
  boost_type,
  display_name,
  duration_hours || ' hours (' || (duration_hours / 24) || ' days)' as duration,
  '€' || price as price,
  sort_order,
  jsonb_array_length(features) as feature_count
FROM boost_pricing
WHERE is_active = true
ORDER BY sort_order;

COMMENT ON TABLE boost_pricing IS 'Unified boost pricing tiers - 24h (€5), 7d (€15), 30d (€50)';
