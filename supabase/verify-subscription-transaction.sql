-- Verify subscription transaction was recorded properly
-- Run this after purchasing a subscription

-- Check user's wallet balance
SELECT 
  user_id,
  balance,
  updated_at as last_updated
FROM wallets
WHERE user_id = '1d5fd006-9953-4d8a-9885-df448e4bd66f';

-- Check transactions table for subscription purchases
SELECT 
  id,
  user_id,
  transaction_type,
  amount,
  status,
  metadata,
  created_at
FROM transactions
WHERE user_id = '1d5fd006-9953-4d8a-9885-df448e4bd66f'
ORDER BY created_at DESC
LIMIT 5;

-- Check subscription_transactions table
SELECT 
  id,
  subscription_id,
  user_id,
  amount,
  payment_method,
  created_at
FROM subscription_transactions
WHERE user_id = '1d5fd006-9953-4d8a-9885-df448e4bd66f'
ORDER BY created_at DESC
LIMIT 5;

-- Check active subscriptions
SELECT 
  id,
  user_id,
  plan_type,
  status,
  price,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  created_at
FROM subscriptions
WHERE user_id = '1d5fd006-9953-4d8a-9885-df448e4bd66f'
ORDER BY created_at DESC;

-- Check platform revenue (for admin dashboard)
SELECT 
  SUM(amount) as total_platform_revenue
FROM transactions
WHERE transaction_type = 'platform_revenue';
