-- =============================================
-- STRIPE PAYMENT SYSTEM - DATABASE FUNCTIONS
-- Run this in Supabase SQL Editor
-- =============================================

-- Function: Increment case escrow after donation
CREATE OR REPLACE FUNCTION increment_case_escrow(case_id UUID, amount DECIMAL)
RETURNS VOID AS $$
BEGIN
  UPDATE cases 
  SET reward_amount = COALESCE(reward_amount, 0) + amount,
      updated_at = NOW()
  WHERE id = case_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Add balance to wallet
-- Note: We drop it first to avoid parameter name conflict errors if the signature changes
DROP FUNCTION IF EXISTS add_wallet_balance(uuid, numeric);
DROP FUNCTION IF EXISTS add_wallet_balance(uuid, decimal);

CREATE OR REPLACE FUNCTION add_wallet_balance(wallet_id UUID, amount DECIMAL)
RETURNS VOID AS $$
BEGIN
  UPDATE wallets 
  SET balance = balance + amount,
      updated_at = NOW()
  WHERE id = wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Subtract from wallet balance
DROP FUNCTION IF EXISTS subtract_wallet_balance(uuid, numeric);
DROP FUNCTION IF EXISTS subtract_wallet_balance(uuid, decimal);

CREATE OR REPLACE FUNCTION subtract_wallet_balance(wallet_id UUID, amount DECIMAL)
RETURNS BOOLEAN AS $$
DECLARE
  current_balance DECIMAL;
BEGIN
  -- Get current balance
  SELECT balance INTO current_balance
  FROM wallets
  WHERE id = wallet_id;
  
  -- Check if sufficient funds
  IF current_balance < amount THEN
    RETURN FALSE;
  END IF;
  
  -- Subtract balance
  UPDATE wallets 
  SET balance = balance - amount,
      updated_at = NOW()
  WHERE id = wallet_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update wallet balance on transaction completion
-- This trigger ensures that wallet balances are updated atomically when a transaction is completed
CREATE OR REPLACE FUNCTION update_wallet_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if status changed to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Case 1: Deduct from sender (Withdrawal, Donation, Payment)
    IF NEW.from_wallet_id IS NOT NULL THEN
      UPDATE wallets
      SET balance = balance - NEW.amount,
          updated_at = NOW()
      WHERE id = NEW.from_wallet_id;
    END IF;
    
    -- Case 2: Add to receiver (Deposit, Refund, Payout)
    IF NEW.to_wallet_id IS NOT NULL THEN
      UPDATE wallets
      SET balance = balance + NEW.amount,
          updated_at = NOW()
      WHERE id = NEW.to_wallet_id;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Trigger for transaction updates
DROP TRIGGER IF EXISTS on_transaction_completed ON transactions;
CREATE TRIGGER on_transaction_completed
  AFTER UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_wallet_on_transaction();

-- Create Trigger for transaction inserts (if inserted directly as completed)
DROP TRIGGER IF EXISTS on_transaction_inserted ON transactions;
CREATE TRIGGER on_transaction_inserted
  AFTER INSERT ON transactions
  FOR EACH ROW 
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION update_wallet_on_transaction();


-- Table: Withdrawal Requests
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  wallet_id UUID NOT NULL REFERENCES wallets(id),
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 50),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  bank_details JSONB,
  processed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);

-- RLS Policies
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own withdrawal requests" ON withdrawal_requests;
CREATE POLICY "Users can view own withdrawal requests"
  ON withdrawal_requests FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create withdrawal requests" ON withdrawal_requests;
CREATE POLICY "Users can create withdrawal requests"
  ON withdrawal_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Grant permissions
GRANT ALL ON withdrawal_requests TO authenticated;

-- Explicitly grant execute permissions on functions
GRANT EXECUTE ON FUNCTION increment_case_escrow(UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_case_escrow(UUID, DECIMAL) TO service_role;

GRANT EXECUTE ON FUNCTION add_wallet_balance(UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION add_wallet_balance(UUID, DECIMAL) TO service_role;

GRANT EXECUTE ON FUNCTION subtract_wallet_balance(UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION subtract_wallet_balance(UUID, DECIMAL) TO service_role;

-- Add stripe_customer_id to profiles if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN stripe_customer_id TEXT UNIQUE;
  END IF;
END $$;

-- Verification
SELECT 
  'increment_case_escrow' as function_name,
  proname,
  pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname = 'increment_case_escrow'
UNION ALL
SELECT 
  'add_wallet_balance' as function_name,
  proname,
  pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname = 'add_wallet_balance'
UNION ALL
SELECT 
  'subtract_wallet_balance' as function_name,
  proname,
  pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname = 'subtract_wallet_balance';

-- Check withdrawal_requests table
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'withdrawal_requests'
ORDER BY ordinal_position;