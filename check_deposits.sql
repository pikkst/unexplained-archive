-- ========================================
-- Stripe Webhook Deposit Troubleshooting
-- ========================================
-- Run this in Supabase SQL Editor to check if deposits are being processed

-- 1. Check recent transactions (last 24 hours)
SELECT 
  t.id,
  t.created_at,
  t.transaction_type,
  t.amount,
  t.status,
  t.user_id,
  p.username,
  t.stripe_payment_intent_id,
  t.metadata
FROM transactions t
LEFT JOIN profiles p ON t.user_id = p.id
WHERE t.created_at > NOW() - INTERVAL '24 hours'
ORDER BY t.created_at DESC;

-- 2. Check wallet balances (recently updated)
SELECT 
  w.user_id,
  p.username,
  w.balance,
  w.created_at,
  w.updated_at
FROM wallets w
LEFT JOIN profiles p ON w.user_id = p.id
WHERE w.updated_at > NOW() - INTERVAL '24 hours'
ORDER BY w.updated_at DESC;

-- 3. Check for any deposit transactions specifically
SELECT 
  t.id,
  t.created_at,
  t.transaction_type,
  t.amount,
  t.status,
  p.username,
  t.stripe_payment_intent_id,
  t.metadata->>'description' as description
FROM transactions t
LEFT JOIN profiles p ON t.user_id = p.id
WHERE t.transaction_type IN ('deposit', 'wallet_deposit')
  AND t.created_at > NOW() - INTERVAL '7 days'
ORDER BY t.created_at DESC
LIMIT 20;

-- 4. Check if there are any failed transactions
SELECT 
  t.id,
  t.created_at,
  t.transaction_type,
  t.amount,
  t.status,
  p.username,
  t.stripe_payment_intent_id,
  t.metadata
FROM transactions t
LEFT JOIN profiles p ON t.user_id = p.id
WHERE t.status = 'failed'
  AND t.created_at > NOW() - INTERVAL '7 days'
ORDER BY t.created_at DESC;

-- 5. Check webhook events (if you have this table)
-- This shows if webhooks are being received and processed
SELECT 
  id,
  created_at,
  stripe_event_id,
  event_type,
  processed_at
FROM webhook_events
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 50;

-- 6. Get total wallet balance for all users (sanity check)
SELECT 
  COUNT(*) as total_wallets,
  SUM(balance) as total_balance,
  AVG(balance) as avg_balance,
  MAX(balance) as max_balance
FROM wallets
WHERE balance > 0;

-- 7. Check for specific user (replace with actual user_id or username)
-- Uncomment and update the WHERE clause:
/*
SELECT 
  p.id,
  p.username,
  w.balance,
  w.updated_at,
  COUNT(t.id) as transaction_count
FROM profiles p
LEFT JOIN wallets w ON w.user_id = p.id
LEFT JOIN transactions t ON t.user_id = p.id
WHERE p.username = 'your_username'  -- Replace with actual username
GROUP BY p.id, p.username, w.balance, w.updated_at;
*/

-- 8. Check platform revenue from deposits (to see if fees are being tracked)
SELECT 
  pr.id,
  pr.created_at,
  pr.transaction_type,
  pr.amount,
  pr.reference_id,
  pr.metadata
FROM platform_revenue pr
WHERE pr.transaction_type = 'deposit'
  AND pr.created_at > NOW() - INTERVAL '7 days'
ORDER BY pr.created_at DESC;

-- ========================================
-- EXPECTED RESULTS FOR SUCCESSFUL DEPOSIT:
-- ========================================
-- Query 1-3: Should show deposit transaction with status 'completed'
-- Query 2: Should show wallet balance increased
-- Query 5: Should show webhook event with 'processed_at' timestamp
-- If these are empty, the webhook is not working!
