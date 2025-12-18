-- ========================================
-- Payment System Health Check
-- ========================================
-- Run this to verify all payment functions exist and work correctly

-- ========================================
-- 1. CHECK RPC FUNCTIONS EXIST
-- ========================================

SELECT 
  routine_name as function_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'add_user_balance',
    'process_platform_donation',
    'donate_from_wallet',
    'increment_case_escrow',
    'process_webhook_event',
    'refund_failed_withdrawal',
    'purchase_case_boost',
    'request_background_check'
  )
ORDER BY routine_name;

-- Expected: 8 functions should exist
-- If any are missing, the corresponding payment flow WILL FAIL

-- ========================================
-- 2. CHECK CRITICAL TABLES EXIST
-- ========================================

SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'wallets',
    'transactions',
    'cases',
    'platform_revenue',
    'subscriptions',
    'withdrawal_requests',
    'profiles'
  )
ORDER BY table_name;

-- Expected: 7 tables should exist

-- ========================================
-- 3. CHECK WALLET BALANCE INTEGRITY
-- ========================================

-- Count wallets with negative balance (should be 0!)
SELECT 
  COUNT(*) as wallets_with_negative_balance,
  MIN(balance) as worst_balance,
  AVG(balance) as avg_balance
FROM wallets
WHERE balance < 0;

-- Should return count = 0

-- ========================================
-- 4. CHECK TRANSACTION CONSISTENCY
-- ========================================

-- Check for transactions without required fields
SELECT 
  COUNT(*) as invalid_transactions,
  'Missing transaction_type' as issue
FROM transactions
WHERE transaction_type IS NULL

UNION ALL

SELECT 
  COUNT(*),
  'Missing status'
FROM transactions
WHERE status IS NULL

UNION ALL

SELECT 
  COUNT(*),
  'Missing amount'
FROM transactions
WHERE amount IS NULL OR amount <= 0;

-- All counts should be 0

-- ========================================
-- 5. CHECK PLATFORM WALLET EXISTS
-- ========================================

-- Platform wallet should have user_id = NULL
SELECT 
  id as platform_wallet_id,
  balance as platform_balance,
  created_at
FROM wallets
WHERE user_id IS NULL;

-- Should return 1 row (platform wallet)
-- If 0 rows: platform donations will fail
-- If >1 rows: duplicate platform wallets (problem!)

-- ========================================
-- 6. RECONCILIATION CHECK
-- ========================================

-- Calculate what should be in Stripe account
SELECT 
  'Stripe Reconciliation' as check_name,
  (SELECT COALESCE(SUM(balance), 0) FROM wallets WHERE user_id IS NOT NULL) as total_user_wallets,
  (SELECT COALESCE(SUM(reward_amount), 0) FROM cases) as total_locked_in_cases,
  (SELECT COALESCE(SUM(balance), 0) FROM wallets WHERE user_id IS NULL) as platform_wallet_balance,
  (
    (SELECT COALESCE(SUM(balance), 0) FROM wallets WHERE user_id IS NOT NULL) +
    (SELECT COALESCE(SUM(reward_amount), 0) FROM cases)
  ) as expected_stripe_balance;

-- Expected Stripe Balance = User Wallets + Locked in Cases
-- Platform wallet is separate (internal accounting)

-- ========================================
-- 7. CHECK RECENT FAILED TRANSACTIONS
-- ========================================

-- Find any failed transactions in last 7 days
SELECT 
  id,
  created_at,
  transaction_type,
  amount,
  status,
  user_id,
  case_id,
  metadata->>'description' as description
FROM transactions
WHERE status IN ('failed', 'pending')
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 10;

-- If any exist, investigate why they failed

-- ========================================
-- 8. CHECK ORPHANED DEPOSITS (WEBHOOK FAILURES)
-- ========================================

-- Check if there are deposits in Stripe but not in database
-- This requires manual Stripe API check, but we can find suspicious patterns:

-- Look for gaps in deposit timing (if deposits usually happen daily but there's a gap)
SELECT 
  DATE(created_at) as deposit_date,
  COUNT(*) as deposit_count,
  SUM(amount) as total_deposited
FROM transactions
WHERE transaction_type = 'deposit'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY deposit_date DESC;

-- Manual check: Compare with Stripe dashboard

-- ========================================
-- 9. CHECK TRANSACTION LIMITS TABLE
-- ========================================

-- See if transaction_limits table exists and has entries
SELECT 
  COUNT(*) as users_with_limits,
  AVG(daily_limit) as avg_daily_limit,
  AVG(monthly_limit) as avg_monthly_limit
FROM transaction_limits;

-- Note: This table is optional. If count = 0, limits are not enforced (OK after our fix)

-- ========================================
-- 10. VERIFY EDGE FUNCTION SECRETS
-- ========================================

-- This query can't check Supabase secrets, but document what should exist:

/*
Required Supabase Edge Function Secrets:
1. STRIPE_SECRET_KEY - Stripe API key
2. STRIPE_WEBHOOK_SECRET - Webhook signing secret
3. STRIPE_OPERATIONS_ACCOUNT_ID - Connected account ID (optional)
4. SUPABASE_URL - Supabase project URL
5. SUPABASE_SERVICE_ROLE_KEY - Admin key

To check: Go to Supabase Dashboard -> Edge Functions -> Manage secrets
*/

-- ========================================
-- 11. CHECK WEBHOOK EVENTS TABLE
-- ========================================

-- If webhook_events table exists, check for recent events
SELECT 
  COUNT(*) as total_webhook_events,
  COUNT(CASE WHEN processed_at IS NOT NULL THEN 1 END) as processed_events,
  COUNT(CASE WHEN processed_at IS NULL THEN 1 END) as pending_events
FROM webhook_events
WHERE created_at > NOW() - INTERVAL '7 days';

-- Pending events might indicate webhook processing issues

-- ========================================
-- SUMMARY
-- ========================================

SELECT '✅ Health check complete!' as status,
       'Review all results above for issues' as next_step;

-- ========================================
-- EXPECTED RESULTS:
-- ========================================
-- Check 1: 8 functions exist
-- Check 2: 7 tables exist
-- Check 3: 0 wallets with negative balance
-- Check 4: 0 invalid transactions
-- Check 5: 1 platform wallet
-- Check 6: Numbers should match Stripe dashboard
-- Check 7: No recent failed transactions (or investigate if any)
-- Check 8: Consistent deposit patterns
-- Check 9: 0 or more users with limits (OK either way)
-- Check 10: Manual verification in Supabase dashboard
-- Check 11: All webhook events should be processed
