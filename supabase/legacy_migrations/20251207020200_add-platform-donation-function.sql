-- =============================================
-- ADD PLATFORM DONATION FUNCTION
-- Allow users to donate directly to platform (not to a specific case)
-- =============================================

-- Function to donate directly to platform (general support)
CREATE OR REPLACE FUNCTION process_platform_donation(
  p_user_id UUID,
  p_amount DECIMAL
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_platform_wallet_id UUID := '00000000-0000-0000-0000-000000000001';
  v_transaction_id UUID;
  v_current_balance DECIMAL;
BEGIN
  -- Get user's wallet and balance
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM wallets
  WHERE user_id = p_user_id;
  
  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
  END IF;
  
  -- Check sufficient balance
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance. Have: %, Need: %', v_current_balance, p_amount;
  END IF;
  
  -- Deduct from user's wallet
  UPDATE wallets
  SET 
    balance = balance - p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id;
  
  -- Add to platform wallet (actual revenue)
  UPDATE wallets
  SET 
    balance = balance + p_amount,
    updated_at = NOW()
  WHERE id = v_platform_wallet_id;
  
  -- Create transaction record
  INSERT INTO transactions (
    from_wallet_id,
    to_wallet_id,
    amount,
    currency,
    transaction_type,
    status,
    description,
    metadata,
    completed_at
  ) VALUES (
    v_wallet_id,
    v_platform_wallet_id,
    p_amount,
    'EUR',
    'donation',
    'completed',
    'General platform support donation',
    jsonb_build_object(
      'target', 'platform',
      'donation_type', 'general_support'
    ),
    NOW()
  ) RETURNING id INTO v_transaction_id;
  
  -- Record in platform_revenue if that table exists
  INSERT INTO platform_revenue (revenue_type, amount, currency, transaction_id, created_at)
  VALUES ('platform_fee', p_amount, 'EUR', v_transaction_id, NOW())
  ON CONFLICT DO NOTHING;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION process_platform_donation(UUID, DECIMAL) TO authenticated;

-- Update the existing process_donation wrapper to handle both cases
CREATE OR REPLACE FUNCTION process_donation(
  p_user_id UUID,
  p_case_id UUID,
  p_amount DECIMAL
)
RETURNS UUID AS $$
BEGIN
  -- If case_id is NULL or 'platform', donate to platform
  IF p_case_id IS NULL OR p_case_id::TEXT = 'platform' THEN
    RETURN process_platform_donation(p_user_id, p_amount);
  ELSE
    -- Otherwise donate to specific case
    RETURN process_wallet_donation(p_user_id, p_case_id, p_amount);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION process_donation(UUID, UUID, DECIMAL) TO authenticated;

-- =============================================
-- VERIFICATION
-- =============================================

DO $$ 
BEGIN
  RAISE NOTICE '✅ Platform donation function created!';
  RAISE NOTICE '';
  RAISE NOTICE '💰 Users can now donate to:';
  RAISE NOTICE '   1. Specific cases (escrow) - process_wallet_donation()';
  RAISE NOTICE '   2. Platform general support - process_platform_donation()';
  RAISE NOTICE '   3. Auto-route via process_donation() wrapper';
  RAISE NOTICE '';
  RAISE NOTICE '🔄 Usage:';
  RAISE NOTICE '   - Case donation: SELECT process_donation(user_id, case_id, amount)';
  RAISE NOTICE '   - Platform donation: SELECT process_donation(user_id, NULL, amount)';
  RAISE NOTICE '   - Or use process_platform_donation(user_id, amount) directly';
END $$;

-- Test the function exists
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('process_platform_donation', 'process_donation', 'process_wallet_donation')
ORDER BY routine_name;
