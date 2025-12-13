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

  -- 2. Calculate fees (10% platform fee)
  v_platform_fee := p_amount * 0.10;
  v_net_donation := p_amount - v_platform_fee;

  -- 3. Start transaction
  --    a. Decrement user's wallet
  UPDATE wallets
  SET balance = balance - p_amount
  WHERE id = v_wallet.id;

  --    b. Increment case escrow amount
  INSERT INTO case_escrow (case_id, total_amount)
  VALUES (p_case_id, v_net_donation)
  ON CONFLICT (case_id) DO UPDATE
  SET total_amount = case_escrow.total_amount + v_net_donation;

  --    c. Update case reward_amount (visible to users)
  UPDATE cases
  SET reward_amount = COALESCE(reward_amount, 0) + v_net_donation,
      updated_at = NOW()
  WHERE id = p_case_id;

  --    d. Record platform fee revenue
  INSERT INTO platform_revenue (revenue_type, amount)
  VALUES ('platform_fee', v_platform_fee);

  --    e. Log the transactions for auditing
  --      i. Main donation transaction
  INSERT INTO transactions (from_wallet_id, case_id, amount, transaction_type, status, description, completed_at)
  VALUES (v_wallet.id, p_case_id, v_net_donation, 'donation', 'completed', 'Donation from wallet to case ' || p_case_id, NOW());

  --      ii. Fee transaction
  INSERT INTO transactions (from_wallet_id, amount, transaction_type, status, description, metadata, completed_at)
  VALUES (v_wallet.id, v_platform_fee, 'platform_fee', 'completed', 'Platform fee for donation to case ' || p_case_id, jsonb_build_object('case_id', p_case_id), NOW());

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in donate_from_wallet: %', SQLERRM;
    RETURN jsonb_build_object('success', false, 'error', 'An unexpected error occurred during the donation process.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
