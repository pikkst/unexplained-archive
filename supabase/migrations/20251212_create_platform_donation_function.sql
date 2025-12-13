-- Create function to handle platform donations from user wallet
CREATE OR REPLACE FUNCTION process_platform_donation(
  p_user_id UUID,
  p_amount DECIMAL
)
RETURNS JSONB AS $$
DECLARE
  v_wallet_id UUID;
  v_platform_wallet_id UUID;
  v_transaction_id UUID;
  v_current_balance DECIMAL;
BEGIN
  -- Get user's wallet
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM wallets
  WHERE user_id = p_user_id;
  
  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  -- Check sufficient balance
  IF v_current_balance < p_amount THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Insufficient balance. Have: €' || v_current_balance || ', Need: €' || p_amount
    );
  END IF;
  
  -- Get or create platform wallet (user_id is NULL for platform)
  SELECT id INTO v_platform_wallet_id
  FROM wallets
  WHERE user_id IS NULL
  LIMIT 1;
  
  IF v_platform_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance, currency)
    VALUES (NULL, 0.00, 'EUR')
    RETURNING id INTO v_platform_wallet_id;
  END IF;
  
  -- Deduct from user's wallet
  UPDATE wallets
  SET 
    balance = balance - p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id;
  
  -- Add to platform wallet
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
    metadata,
    completed_at
  ) VALUES (
    v_wallet_id,
    v_platform_wallet_id,
    p_amount,
    'EUR',
    'donation',
    'completed',
    jsonb_build_object(
      'target', 'platform',
      'donation_type', 'general_support'
    ),
    NOW()
  ) RETURNING id INTO v_transaction_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION process_platform_donation(UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION process_platform_donation(UUID, DECIMAL) TO service_role;
