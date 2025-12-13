-- Add 'boost_purchase' and 'case_boost' to transactions table transaction_type constraint
-- This allows boost purchases to be recorded in the transactions table

-- Drop the old constraint
ALTER TABLE transactions 
DROP CONSTRAINT IF EXISTS transactions_transaction_type_check;

-- Add new constraint with boost types included
ALTER TABLE transactions
ADD CONSTRAINT transactions_transaction_type_check 
CHECK (transaction_type IN (
  'deposit', 
  'donation', 
  'reward', 
  'subscription', 
  'withdrawal', 
  'platform_fee', 
  'refund',
  'boost_purchase',
  'case_boost',
  'background_check',
  'escrow_hold',
  'escrow_release'
));

-- Verify the constraint
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'transactions_transaction_type_check';
