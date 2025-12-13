-- Fix missing subscription transaction for the upgrade that already happened
-- User upgraded from Pro (€49.99) to Premium yearly (€479.90)
-- Wallet was deducted but transaction was not recorded

-- First, check current state
SELECT 
  id,
  user_id,
  plan_type,
  price,
  billing_cycle,
  created_at
FROM subscriptions
WHERE user_id = '1d5fd006-9953-4d8a-9885-df448e4bd66f'
ORDER BY created_at DESC
LIMIT 1;

-- Check current wallet balance
SELECT balance FROM wallets WHERE user_id = '1d5fd006-9953-4d8a-9885-df448e4bd66f';

-- Get wallet ID
SELECT id FROM wallets WHERE user_id = '1d5fd006-9953-4d8a-9885-df448e4bd66f';

-- Calculate what should have been charged:
-- Premium yearly is €239.90, Pro was €49.99 for 30 days
-- Prorated difference should be around €189.91 - €239.66 (depending on exact time)

-- Create the missing transaction record automatically
WITH wallet_info AS (
  SELECT id as wallet_id
  FROM wallets 
  WHERE user_id = '1d5fd006-9953-4d8a-9885-df448e4bd66f'
),
sub_info AS (
  SELECT id as subscription_id
  FROM subscriptions
  WHERE user_id = '1d5fd006-9953-4d8a-9885-df448e4bd66f'
  ORDER BY created_at DESC
  LIMIT 1
)
INSERT INTO transactions (
  from_wallet_id,
  to_wallet_id,
  user_id,
  amount,
  transaction_type,
  status,
  metadata,
  created_at
)
SELECT 
  wallet_info.wallet_id,
  NULL,
  '1d5fd006-9953-4d8a-9885-df448e4bd66f',
  239.66,
  'subscription_fee',
  'completed',
  jsonb_build_object(
    'subscription_plan', 'Investigator Premium',
    'old_plan', 'pro',
    'new_plan', 'premium',
    'billing_cycle', 'yearly',
    'prorated', true,
    'description', 'Upgrade to Investigator Premium (prorated) - Manually added'
  ),
  NOW()
FROM wallet_info, sub_info;

-- Also create subscription_transactions record
WITH sub_info AS (
  SELECT id as subscription_id, plan_type, billing_cycle
  FROM subscriptions
  WHERE user_id = '1d5fd006-9953-4d8a-9885-df448e4bd66f'
  ORDER BY created_at DESC
  LIMIT 1
)
INSERT INTO subscription_transactions (
  subscription_id,
  user_id,
  plan_code,
  billing_cycle,
  amount,
  payment_method,
  created_at
)
SELECT
  subscription_id,
  '1d5fd006-9953-4d8a-9885-df448e4bd66f',
  plan_type,
  billing_cycle,
  239.66,
  'wallet',
  NOW()
FROM sub_info;
