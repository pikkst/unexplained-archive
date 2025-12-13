-- =============================================
-- FIX WALLET RLS - ALLOW ALL USERS TO HAVE WALLETS
-- Wallets are needed for ALL users, not just investigators
-- =============================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Only investigators and admins can create wallets" ON wallets;
DROP POLICY IF EXISTS "Wallets can only be created for investigators or admins" ON wallets;
DROP POLICY IF EXISTS "Users can only view their own wallet" ON wallets;
DROP POLICY IF EXISTS "Only system can modify wallets" ON wallets;

-- Create new policies that allow ALL users to have wallets
CREATE POLICY "Anyone authenticated can have a wallet"
  ON wallets FOR SELECT
  USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "System can create wallets for any user"
  ON wallets FOR INSERT
  WITH CHECK (true); -- Allow wallet creation for any user

CREATE POLICY "Only wallet owner or admin can update balance"
  ON wallets FOR UPDATE
  USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Remove any CHECK constraints that prevent regular users from having wallets
ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_user_role_check;

-- Create trigger to auto-create wallet for ALL users on signup
CREATE OR REPLACE FUNCTION auto_create_wallet_for_all_users()
RETURNS TRIGGER AS $$
BEGIN
  -- Create wallet for ANY new user (not just investigators/admins)
  INSERT INTO wallets (user_id, balance, currency)
  VALUES (NEW.id, 0.00, 'EUR')
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Failed to create wallet for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS trigger_auto_create_wallet_all_users ON profiles;

-- Create new trigger
CREATE TRIGGER trigger_auto_create_wallet_all_users
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_wallet_for_all_users();

-- Create wallets for existing users who don't have one
DO $$
DECLARE
  user_record RECORD;
  created_count INTEGER := 0;
BEGIN
  FOR user_record IN 
    SELECT p.id, p.role
    FROM profiles p
    LEFT JOIN wallets w ON w.user_id = p.id
    WHERE w.id IS NULL
  LOOP
    BEGIN
      INSERT INTO wallets (user_id, balance, currency)
      VALUES (user_record.id, 0.00, 'EUR')
      ON CONFLICT (user_id) DO NOTHING;
      
      created_count := created_count + 1;
      RAISE NOTICE 'Created wallet for user % (role: %)', user_record.id, user_record.role;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to create wallet for user %: %', user_record.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Created % wallets for existing users', created_count;
END $$;

-- Update transaction RLS to allow donations from any user
DROP POLICY IF EXISTS "Only wallet owners can create transactions" ON transactions;

CREATE POLICY "Users can create transactions from their wallets"
  ON transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM wallets 
      WHERE wallets.id = from_wallet_id 
      AND wallets.user_id = auth.uid()
    )
    OR auth.uid() IS NULL -- Allow system transactions
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- =============================================
-- DONATION SYSTEM ENHANCEMENT
-- =============================================

-- Drop existing functions if they exist (all possible signatures)
DROP FUNCTION IF EXISTS process_direct_donation(UUID, UUID, DECIMAL, TEXT);
DROP FUNCTION IF EXISTS process_direct_donation(UUID, DECIMAL, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS process_wallet_donation(UUID, UUID, DECIMAL);
DROP FUNCTION IF EXISTS process_refund(UUID, UUID, DECIMAL, TEXT);
DROP FUNCTION IF EXISTS process_donation CASCADE;

-- Function to donate directly from bank (creates wallet transaction after Stripe payment)
CREATE FUNCTION process_direct_donation(
  p_user_id UUID,
  p_case_id UUID,
  p_amount DECIMAL,
  p_stripe_payment_intent_id TEXT
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
  v_escrow_id UUID;
BEGIN
  -- Get or create user's wallet
  SELECT id INTO v_wallet_id
  FROM wallets
  WHERE user_id = p_user_id;
  
  IF v_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance, currency)
    VALUES (p_user_id, 0.00, 'EUR')
    RETURNING id INTO v_wallet_id;
  END IF;
  
  -- Get case escrow
  SELECT id INTO v_escrow_id
  FROM case_escrow
  WHERE case_id = p_case_id;
  
  IF v_escrow_id IS NULL THEN
    INSERT INTO case_escrow (case_id, total_amount, locked_amount, currency)
    VALUES (p_case_id, 0.00, 0.00, 'EUR')
    RETURNING id INTO v_escrow_id;
  END IF;
  
  -- Create transaction record (direct from bank, no wallet deduction)
  INSERT INTO transactions (
    from_wallet_id,
    amount,
    currency,
    transaction_type,
    status,
    case_id,
    stripe_payment_intent_id,
    description,
    completed_at
  ) VALUES (
    v_wallet_id,
    p_amount,
    'EUR',
    'donation',
    'completed',
    p_case_id,
    p_stripe_payment_intent_id,
    'Direct donation from bank to case',
    NOW()
  ) RETURNING id INTO v_transaction_id;
  
  -- Update case escrow
  UPDATE case_escrow
  SET 
    total_amount = total_amount + p_amount,
    locked_amount = locked_amount + p_amount,
    updated_at = NOW()
  WHERE id = v_escrow_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to donate from user's existing wallet balance
CREATE FUNCTION process_wallet_donation(
  p_user_id UUID,
  p_case_id UUID,
  p_amount DECIMAL
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
  v_escrow_id UUID;
BEGIN
  -- Get user's wallet
  SELECT id INTO v_wallet_id
  FROM wallets
  WHERE user_id = p_user_id;
  
  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
  END IF;
  
  -- Check sufficient balance
  IF (SELECT balance FROM wallets WHERE id = v_wallet_id) < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
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
  
  -- Deduct from user's wallet
  UPDATE wallets
  SET balance = balance - p_amount
  WHERE id = v_wallet_id;
  
  -- Create transaction record
  INSERT INTO transactions (
    from_wallet_id,
    amount,
    currency,
    transaction_type,
    status,
    case_id,
    description,
    completed_at
  ) VALUES (
    v_wallet_id,
    p_amount,
    'EUR',
    'donation',
    'completed',
    p_case_id,
    'Donation from wallet balance to case',
    NOW()
  ) RETURNING id INTO v_transaction_id;
  
  -- Update case escrow
  UPDATE case_escrow
  SET 
    total_amount = total_amount + p_amount,
    locked_amount = locked_amount + p_amount,
    updated_at = NOW()
  WHERE id = v_escrow_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to refund user (add to their wallet)
CREATE FUNCTION process_refund(
  p_user_id UUID,
  p_case_id UUID,
  p_amount DECIMAL,
  p_reason TEXT
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
BEGIN
  -- Get or create user's wallet
  SELECT id INTO v_wallet_id
  FROM wallets
  WHERE user_id = p_user_id;
  
  IF v_wallet_id IS NULL THEN
    INSERT INTO wallets (user_id, balance, currency)
    VALUES (p_user_id, 0.00, 'EUR')
    RETURNING id INTO v_wallet_id;
  END IF;
  
  -- Add to user's wallet
  UPDATE wallets
  SET balance = balance + p_amount
  WHERE id = v_wallet_id;
  
  -- Create refund transaction
  INSERT INTO transactions (
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
    p_amount,
    'EUR',
    'refund',
    'completed',
    p_case_id,
    p_reason,
    NOW()
  ) RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION process_direct_donation(UUID, UUID, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION process_wallet_donation(UUID, UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION process_refund(UUID, UUID, DECIMAL, TEXT) TO authenticated;

-- =============================================
-- COMPLETION MESSAGE
-- =============================================

DO $$ 
BEGIN
  RAISE NOTICE '✓ Wallet RLS updated - ALL users can now have wallets';
  RAISE NOTICE '✓ Auto-wallet creation enabled for all users';
  RAISE NOTICE '✓ Wallets created for existing users';
  RAISE NOTICE '✓ Direct donation function created (bank → case)';
  RAISE NOTICE '✓ Wallet donation function created (wallet → case)';
  RAISE NOTICE '✓ Refund function created (case → wallet)';
  RAISE NOTICE '';
  RAISE NOTICE 'Users can now:';
  RAISE NOTICE '  1. Donate directly from bank to cases';
  RAISE NOTICE '  2. Donate from wallet balance to cases';
  RAISE NOTICE '  3. Receive refunds to their wallet';
  RAISE NOTICE '  4. Withdraw from wallet to bank';
END $$;
