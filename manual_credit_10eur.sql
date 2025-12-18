-- ========================================
-- Manually Add €10 to User Wallet
-- ========================================
-- User ID: d2e685c5-0922-4385-8403-279278660ae8
-- Reason: Stripe payment succeeded but webhook failed (401 error)
-- Payment was made but not recorded due to JWT verification issue

-- Step 1: Check current balance BEFORE
SELECT 
  w.user_id,
  p.username,
  w.balance as current_balance
FROM wallets w
LEFT JOIN profiles p ON w.user_id = p.id
WHERE w.user_id = 'd2e685c5-0922-4385-8403-279278660ae8';

-- Step 2: Get wallet ID
DO $$
DECLARE
  v_wallet_id uuid;
BEGIN
  -- Get or create wallet
  SELECT id INTO v_wallet_id
  FROM wallets
  WHERE user_id = 'd2e685c5-0922-4385-8403-279278660ae8';
  
  IF v_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance)
    VALUES ('d2e685c5-0922-4385-8403-279278660ae8', 0)
    RETURNING id INTO v_wallet_id;
  END IF;
  
  -- Update wallet balance
  UPDATE wallets
  SET balance = balance + 10.00,
      updated_at = NOW()
  WHERE id = v_wallet_id;
  
  -- Insert transaction record
  INSERT INTO transactions (
    to_wallet_id,
    amount,
    currency,
    transaction_type,
    status,
    created_at
  ) VALUES (
    v_wallet_id,
    10.00,
    'EUR',
    'deposit',
    'completed',
    NOW()
  );
  
  RAISE NOTICE 'Successfully added €10 to wallet %', v_wallet_id;
END $$;

-- Step 3: Verify new balance AFTER
SELECT 
  w.user_id,
  p.username,
  w.balance as new_balance,
  w.updated_at
FROM wallets w
LEFT JOIN profiles p ON w.user_id = p.id
WHERE w.user_id = 'd2e685c5-0922-4385-8403-279278660ae8';

-- Step 4: Check transaction was created
SELECT 
  *
FROM transactions
WHERE created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC
LIMIT 5;

-- ========================================
-- EXPECTED RESULT:
-- ========================================
-- Balance should increase by €10
-- New transaction should appear with description explaining manual credit
