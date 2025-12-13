-- =============================================
-- AUTO-WALLET CREATION ENHANCEMENT
-- Enhanced wallet auto-creation with better error handling
-- =============================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS create_wallet_for_user(UUID);

-- Enhanced wallet creation function
CREATE OR REPLACE FUNCTION create_wallet_for_user(user_uuid UUID)
RETURNS UUID AS $$
DECLARE
  wallet_id UUID;
BEGIN
  -- Check if wallet already exists
  SELECT id INTO wallet_id
  FROM wallets
  WHERE user_id = user_uuid;
  
  -- If wallet exists, return its ID
  IF wallet_id IS NOT NULL THEN
    RETURN wallet_id;
  END IF;
  
  -- Create new wallet
  INSERT INTO wallets (user_id, balance, currency)
  VALUES (user_uuid, 0.00, 'EUR')
  RETURNING id INTO wallet_id;
  
  RETURN wallet_id;
EXCEPTION
  WHEN unique_violation THEN
    -- Handle race condition - wallet was just created
    SELECT id INTO wallet_id FROM wallets WHERE user_id = user_uuid;
    RETURN wallet_id;
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Failed to create wallet for user %: %', user_uuid, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to auto-create wallet on profile creation
CREATE OR REPLACE FUNCTION auto_create_wallet_on_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Create wallet for new user
  PERFORM create_wallet_for_user(NEW.id);
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail profile creation
    RAISE WARNING 'Failed to auto-create wallet for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_auto_create_wallet ON profiles;

-- Create trigger
CREATE TRIGGER trigger_auto_create_wallet
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_wallet_on_profile();

-- Function to ensure wallet exists (can be called from application)
CREATE OR REPLACE FUNCTION ensure_wallet_exists(user_uuid UUID)
RETURNS TABLE(wallet_id UUID, balance DECIMAL, currency TEXT) AS $$
BEGIN
  -- Try to get existing wallet
  RETURN QUERY
  SELECT id, wallets.balance, wallets.currency
  FROM wallets
  WHERE user_id = user_uuid;
  
  -- If no wallet found, create one and return it
  IF NOT FOUND THEN
    RETURN QUERY
    INSERT INTO wallets (user_id, balance, currency)
    VALUES (user_uuid, 0.00, 'EUR')
    RETURNING id, balance, currency;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create wallets for existing users who don't have one
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT p.id 
    FROM profiles p
    LEFT JOIN wallets w ON w.user_id = p.id
    WHERE w.id IS NULL
  LOOP
    BEGIN
      PERFORM create_wallet_for_user(user_record.id);
      RAISE NOTICE 'Created wallet for user %', user_record.id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to create wallet for user %: %', user_record.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- =============================================
-- WALLET WITHDRAWAL SYSTEM
-- =============================================

-- Withdrawal requests table
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'EUR' NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'cancelled')),
  bank_account_details JSONB, -- Encrypted bank details
  stripe_payout_id TEXT,
  admin_notes TEXT,
  rejection_reason TEXT,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT positive_amount CHECK (amount >= 10.00), -- Minimum €10
  CONSTRAINT valid_currency CHECK (currency IN ('EUR', 'USD', 'GBP'))
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_created_at ON withdrawal_requests(created_at DESC);

-- RLS for withdrawal requests
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own withdrawal requests"
  ON withdrawal_requests FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Users can create their own withdrawal requests"
  ON withdrawal_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update withdrawal requests"
  ON withdrawal_requests FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- Trigger for updated_at
CREATE TRIGGER update_withdrawal_requests_updated_at
  BEFORE UPDATE ON withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to process withdrawal (called by admin or automated system)
CREATE OR REPLACE FUNCTION process_withdrawal(
  withdrawal_id UUID,
  success BOOLEAN,
  notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  withdrawal_record RECORD;
  transaction_id UUID;
BEGIN
  -- Get withdrawal request
  SELECT * INTO withdrawal_record
  FROM withdrawal_requests
  WHERE id = withdrawal_id
  AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request not found or already processed';
  END IF;
  
  IF success THEN
    -- Deduct amount from wallet
    UPDATE wallets
    SET balance = balance - withdrawal_record.amount
    WHERE id = withdrawal_record.wallet_id
    AND balance >= withdrawal_record.amount;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient balance';
    END IF;
    
    -- Create transaction record
    INSERT INTO transactions (
      from_wallet_id,
      amount,
      currency,
      transaction_type,
      status,
      description,
      completed_at
    ) VALUES (
      withdrawal_record.wallet_id,
      withdrawal_record.amount,
      withdrawal_record.currency,
      'withdrawal',
      'completed',
      'Withdrawal to bank account',
      NOW()
    ) RETURNING id INTO transaction_id;
    
    -- Update withdrawal request
    UPDATE withdrawal_requests
    SET 
      status = 'completed',
      processed_at = NOW(),
      completed_at = NOW(),
      admin_notes = notes
    WHERE id = withdrawal_id;
    
  ELSE
    -- Reject withdrawal
    UPDATE withdrawal_requests
    SET 
      status = 'rejected',
      processed_at = NOW(),
      rejection_reason = notes
    WHERE id = withdrawal_id;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT ALL ON withdrawal_requests TO authenticated;

-- =============================================
-- COMPLETION MESSAGE
-- =============================================

DO $$ 
BEGIN
  RAISE NOTICE 'Auto-wallet and withdrawal system setup complete!';
  RAISE NOTICE '✓ Enhanced auto-wallet creation';
  RAISE NOTICE '✓ Wallets created for existing users';
  RAISE NOTICE '✓ Withdrawal requests table';
  RAISE NOTICE '✓ Withdrawal processing function';
  RAISE NOTICE '✓ RLS policies configured';
END $$;
