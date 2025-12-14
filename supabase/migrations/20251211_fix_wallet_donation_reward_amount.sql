-- Fix wallet donation to update cases.reward_amount field
-- This ensures donations from wallet show up in the case reward pool UI
-- Compatible with clean_schema (no case_escrow table needed)

-- Fix increment_case_escrow to update reward_amount instead of current_escrow
CREATE OR REPLACE FUNCTION increment_case_escrow(case_id UUID, amount DECIMAL)
RETURNS VOID AS $$
BEGIN
  UPDATE cases 
  SET reward_amount = COALESCE(reward_amount, 0) + amount,
      updated_at = NOW()
  WHERE id = case_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix donate_from_wallet to also update cases.reward_amount
CREATE OR REPLACE FUNCTION donate_from_wallet(
  p_user_id UUID,
  p_case_id UUID,
  p_amount DECIMAL
)
RETURNS JSONB AS $$
DECLARE
  v_wallet RECORD;
  v_platform_fee DECIMAL;
  v_net_donation DECIMAL;
BEGIN
  -- 1. Get user wallet and check balance
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id;
  
  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  IF v_wallet.balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- 2. NO PLATFORM FEE for wallet donations (internal transfer, no Stripe cost)
  -- 100% of the donation goes to the case
  v_platform_fee := 0;
  v_net_donation := p_amount;

  -- 3. Start transaction
  --    a. Decrement user's wallet
  UPDATE wallets
  SET balance = balance - p_amount
  WHERE id = v_wallet.id;

  --    b. Update case reward_amount (visible to users) - full amount
  UPDATE cases
  SET reward_amount = COALESCE(reward_amount, 0) + v_net_donation,
      updated_at = NOW()
  WHERE id = p_case_id;

  --    c. Log the donation transaction
  INSERT INTO transactions (
    user_id, from_wallet_id, case_id, amount, transaction_type, status, 
    metadata, completed_at
  )
  VALUES (
    p_user_id, v_wallet.id, p_case_id, p_amount, 'donation', 'completed', 
    jsonb_build_object(
      'description', 'Donation from wallet to case (no fee - internal transfer)',
      'platform_fee', 0,
      'net_amount', p_amount
    ),
    NOW()
  );

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    -- Log detailed error for debugging
    RAISE WARNING 'Error in donate_from_wallet: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Donation failed: ' || SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION donate_from_wallet(UUID, UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION donate_from_wallet(UUID, UUID, DECIMAL) TO service_role;
GRANT EXECUTE ON FUNCTION increment_case_escrow(UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_case_escrow(UUID, DECIMAL) TO service_role;
