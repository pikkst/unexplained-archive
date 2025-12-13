-- Create stripe_accounts table for tracking Operations vs Revenue accounts
CREATE TABLE IF NOT EXISTS stripe_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_type TEXT UNIQUE NOT NULL CHECK (account_type IN ('operations', 'revenue')),
  stripe_account_id TEXT UNIQUE NOT NULL,
  
  -- Balance tracking
  available_balance DECIMAL(10,2) DEFAULT 0.00,
  pending_balance DECIMAL(10,2) DEFAULT 0.00,
  
  -- Reconciliation
  db_balance DECIMAL(10,2) DEFAULT 0.00, -- Calculated from DB
  last_reconciled_at TIMESTAMPTZ,
  reconciliation_diff DECIMAL(10,2) DEFAULT 0.00, -- Should be 0!
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initial data for stripe_accounts (placeholders, to be updated with real IDs)
INSERT INTO stripe_accounts (account_type, stripe_account_id) VALUES
  ('operations', 'acct_OPERATIONS_PLACEHOLDER'),
  ('revenue', 'acct_REVENUE_PLACEHOLDER')
ON CONFLICT (account_type) DO NOTHING;

-- Create internal_transfers table for tracking transfers between Operations and Revenue
CREATE TABLE IF NOT EXISTS internal_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_date DATE NOT NULL,
  
  -- What was transferred
  fees_collected DECIMAL(10,2) DEFAULT 0.00, -- Platform fees from operations
  donations_collected DECIMAL(10,2) DEFAULT 0.00, -- Direct platform donations
  total_amount DECIMAL(10,2) NOT NULL,
  
  -- Stripe transfer
  stripe_transfer_id TEXT UNIQUE,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_internal_transfers_date ON internal_transfers(transfer_date);

-- Add missing columns to withdrawal_requests if not present (based on doc)
DO $$ 
BEGIN
  -- Check for fee column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'withdrawal_requests' AND column_name = 'fee') THEN
    ALTER TABLE withdrawal_requests ADD COLUMN fee DECIMAL(10,2) DEFAULT 0.00;
  END IF;

  -- Check for net_amount column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'withdrawal_requests' AND column_name = 'net_amount') THEN
    ALTER TABLE withdrawal_requests ADD COLUMN net_amount DECIMAL(10,2) DEFAULT 0.00;
  END IF;

  -- Check for stripe_payout_id column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'withdrawal_requests' AND column_name = 'stripe_payout_id') THEN
    ALTER TABLE withdrawal_requests ADD COLUMN stripe_payout_id TEXT;
  END IF;
  
  -- Check for failure_reason column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'withdrawal_requests' AND column_name = 'failure_reason') THEN
    ALTER TABLE withdrawal_requests ADD COLUMN failure_reason TEXT;
  END IF;

  -- Check for retry_count column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'withdrawal_requests' AND column_name = 'retry_count') THEN
    ALTER TABLE withdrawal_requests ADD COLUMN retry_count INT DEFAULT 0;
  END IF;
  
   -- Check for bank details columns if they were stored in JSONB before but now we want explicit columns (optional, but doc showed explicit)
   -- The previous migration used JSONB `bank_details`, which is fine. We can keep it.
END $$;