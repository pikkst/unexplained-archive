-- ========================================
-- Simple Deposit Check
-- ========================================
-- Check if the €10 deposit was recorded

-- 1. Check ALL recent transactions (last 24 hours) - see everything
SELECT 
  *
FROM transactions
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- 2. Check all wallets and their current balances
SELECT 
  w.id as wallet_id,
  w.user_id,
  p.username,
  w.balance,
  w.created_at,
  w.updated_at
FROM wallets w
LEFT JOIN profiles p ON w.user_id = p.id
ORDER BY w.updated_at DESC
LIMIT 20;

-- 3. Check ALL transactions from last 7 days
SELECT 
  *
FROM transactions
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 20;

-- 4. Check webhook events
SELECT 
  *
FROM webhook_events
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 20;

-- 5. Count total transactions today
SELECT 
  COUNT(*) as count,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount
FROM transactions
WHERE created_at > CURRENT_DATE;

-- ========================================
-- WHAT TO LOOK FOR:
-- ========================================
-- Query 1: Should show a transaction with amount = 10
-- Query 2: Should show a wallet with balance = 10 (or balance increased by 10)
-- Query 4: Should show webhook events from Stripe
-- If Query 1 and 4 are EMPTY = webhook not working (401 error)
-- If Query 1 has data but Query 2 balance not updated = database function error
