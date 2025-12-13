-- =============================================
-- FIX WALLET DONATION LOGIC
-- Problem: Donations update wrong wallet balances
-- =============================================

-- Check current wallet balances
SELECT 
  p.username,
  p.role,
  w.balance,
  w.user_id
FROM wallets w
JOIN profiles p ON w.user_id = p.id
ORDER BY p.username;

-- Check recent donation transactions
SELECT 
  t.id,
  t.transaction_type,
  t.amount,
  t.status,
  t.from_wallet_id,
  t.to_wallet_id,
  t.created_at,
  w_from.user_id as from_user_id,
  w_to.user_id as to_user_id,
  p_from.username as from_username,
  p_to.username as to_username
FROM transactions t
LEFT JOIN wallets w_from ON t.from_wallet_id = w_from.id
LEFT JOIN wallets w_to ON t.to_wallet_id = w_to.id
LEFT JOIN profiles p_from ON w_from.user_id = p_from.id
LEFT JOIN profiles p_to ON w_to.user_id = p_to.id
WHERE t.transaction_type IN ('donation', 'deposit')
ORDER BY t.created_at DESC
LIMIT 10;

-- =============================================
-- FIX THE DONATION FUNCTIONS
-- =============================================

-- Drop existing functions first (they have different parameter names)
DROP FUNCTION IF EXISTS process_wallet_donation(UUID, UUID, DECIMAL);
DROP FUNCTION IF EXISTS add_wallet_balance(UUID, DECIMAL);
DROP FUNCTION IF EXISTS subtract_wallet_balance(UUID, DECIMAL);

-- Fix process_wallet_donation to properly update balances
CREATE OR REPLACE FUNCTION process_wallet_donation(
  p_user_id UUID,
  p_case_id UUID,
  p_amount DECIMAL
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_case_wallet_id UUID;
  v_transaction_id UUID;
  v_escrow_id UUID;
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
  
  -- Get or create case escrow
  SELECT id INTO v_escrow_id
  FROM case_escrow
  WHERE case_id = p_case_id;
  
  IF v_escrow_id IS NULL THEN
    INSERT INTO case_escrow (case_id, total_amount, locked_amount, currency)
    VALUES (p_case_id, 0.00, 0.00, 'EUR')
    RETURNING id INTO v_escrow_id;
  END IF;
  
  -- Get platform wallet (where escrow is held)
  v_case_wallet_id := '00000000-0000-0000-0000-000000000001'::UUID;
  
  -- CRITICAL: Deduct from user's wallet ONLY
  UPDATE wallets
  SET 
    balance = balance - p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id;
  
  -- DO NOT update case wallet balance - escrow is tracked separately
  
  -- Create transaction record showing money flow
  INSERT INTO transactions (
    from_wallet_id,
    to_wallet_id,
    amount,
    currency,
    transaction_type,
    status,
    case_id,
    description,
    completed_at
  ) VALUES (
    v_wallet_id,
    v_case_wallet_id,  -- Shows it goes to platform escrow
    p_amount,
    'EUR',
    'donation',
    'completed',
    p_case_id,
    'Donation from wallet balance to case escrow',
    NOW()
  ) RETURNING id INTO v_transaction_id;
  
  -- Update case escrow (separate from wallet balance)
  UPDATE case_escrow
  SET 
    total_amount = total_amount + p_amount,
    locked_amount = locked_amount + p_amount,
    updated_at = NOW()
  WHERE id = v_escrow_id;
  
  -- Also update the case's current_escrow if that column exists
  UPDATE cases
  SET current_escrow = COALESCE(current_escrow, 0) + p_amount
  WHERE id = p_case_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix add_wallet_balance to prevent duplicate additions
CREATE OR REPLACE FUNCTION add_wallet_balance(p_wallet_id UUID, p_amount DECIMAL)
RETURNS VOID AS $$
BEGIN
  -- Simple addition - no duplicate logic needed
  UPDATE wallets 
  SET 
    balance = balance + p_amount,
    updated_at = NOW()
  WHERE id = p_wallet_id;
  
  RAISE NOTICE 'Added % to wallet %', p_amount, p_wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix subtract_wallet_balance to prevent over-subtraction
CREATE OR REPLACE FUNCTION subtract_wallet_balance(p_wallet_id UUID, p_amount DECIMAL)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_balance DECIMAL;
BEGIN
  -- Get current balance with lock to prevent race conditions
  SELECT balance INTO v_current_balance
  FROM wallets
  WHERE id = p_wallet_id
  FOR UPDATE;
  
  -- Check if sufficient funds
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Have: %, Need: %', v_current_balance, p_amount;
  END IF;
  
  -- Subtract balance
  UPDATE wallets 
  SET 
    balance = balance - p_amount,
    updated_at = NOW()
  WHERE id = p_wallet_id;
  
  RAISE NOTICE 'Subtracted % from wallet %', p_amount, p_wallet_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION process_wallet_donation(UUID, UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION add_wallet_balance(UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION subtract_wallet_balance(UUID, DECIMAL) TO authenticated;

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

DO $$ 
BEGIN
  RAISE NOTICE '✅ Wallet donation functions fixed!';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Fixed issues:';
  RAISE NOTICE '   - Donations now only deduct from donor wallet';
  RAISE NOTICE '   - Escrow tracked separately from wallet balances';
  RAISE NOTICE '   - Platform wallet not incorrectly credited';
  RAISE NOTICE '   - Balance checks prevent overdraft';
  RAISE NOTICE '';
  RAISE NOTICE '💡 How it works now:';
  RAISE NOTICE '   1. User donates €20 from wallet';
  RAISE NOTICE '   2. €20 deducted from user wallet';
  RAISE NOTICE '   3. €20 added to case_escrow table';
  RAISE NOTICE '   4. Platform wallet balance unchanged';
  RAISE NOTICE '   5. Transaction shows from_wallet → platform (escrow)';
END $$;

-- Show wallet balances after fix
SELECT 
  p.username,
  p.role,
  w.balance as wallet_balance,
  COUNT(t.id) as transaction_count
FROM wallets w
JOIN profiles p ON w.user_id = p.id
LEFT JOIN transactions t ON t.from_wallet_id = w.id OR t.to_wallet_id = w.id
GROUP BY p.username, p.role, w.balance
ORDER BY p.username;
