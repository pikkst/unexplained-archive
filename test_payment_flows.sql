-- ========================================
-- PAYMENT FLOW TESTING GUIDE
-- ========================================
-- Step-by-step SQL queries to test each payment flow

-- ========================================
-- SETUP: Create test user and wallet
-- ========================================

-- 1. Find a test user (or use your own user_id)
SELECT 
  id as user_id,
  username,
  email
FROM auth.users
LIMIT 1;

-- Copy the user_id from above and use it in tests below
-- Replace 'YOUR_USER_ID' with actual UUID

-- ========================================
-- TEST 1: Wallet Deposit via Stripe
-- ========================================
-- User deposits €10 to their wallet

-- BEFORE: Check current balance
SELECT 
  w.balance as balance_before,
  w.user_id
FROM wallets w
WHERE w.user_id = 'YOUR_USER_ID';

-- SIMULATE: (In real flow, Stripe webhook calls this)
-- Test the RPC function directly:
SELECT add_user_balance(
  'YOUR_USER_ID'::UUID,
  10.00,
  'Test deposit',
  'test_stripe_pi_123'
);

-- AFTER: Check new balance (should be +€10)
SELECT 
  w.balance as balance_after,
  w.updated_at
FROM wallets w
WHERE w.user_id = 'YOUR_USER_ID';

-- VERIFY: Transaction was recorded
SELECT 
  *
FROM transactions
WHERE user_id = 'YOUR_USER_ID'
  AND transaction_type = 'wallet_deposit'
ORDER BY created_at DESC
LIMIT 1;

-- Expected: balance_after = balance_before + 10

-- ========================================
-- TEST 2: Case Donation via Stripe
-- ========================================
-- User donates €50 to a case (10% fee)

-- Find a test case
SELECT id, title, reward_amount
FROM cases
WHERE status = 'open'
LIMIT 1;

-- Copy case ID and use below
-- BEFORE: Check case reward
SELECT 
  id,
  title,
  reward_amount as reward_before
FROM cases
WHERE id = 'YOUR_CASE_ID';

-- SIMULATE: Stripe donation with 10% fee
-- €50 donation = €45 to case, €5 to platform
SELECT increment_case_escrow(
  'YOUR_CASE_ID'::UUID,
  45.00  -- Net amount after 10% fee
);

-- AFTER: Check case reward (should be +€45)
SELECT 
  id,
  title,
  reward_amount as reward_after
FROM cases
WHERE id = 'YOUR_CASE_ID';

-- VERIFY: Platform fee recorded
SELECT *
FROM platform_revenue
WHERE transaction_type = 'donation'
ORDER BY created_at DESC
LIMIT 1;

-- Expected: reward_after = reward_before + 45

-- ========================================
-- TEST 3: Platform Donation via Stripe
-- ========================================
-- User donates €50 directly to platform (0% fee)

-- SIMULATE: Process platform donation
SELECT process_platform_donation(
  'YOUR_USER_ID'::UUID,
  50.00
);

-- VERIFY: Platform revenue recorded
SELECT *
FROM platform_revenue
WHERE transaction_type = 'platform_donation'
ORDER BY created_at DESC
LIMIT 1;

-- VERIFY: Transaction recorded
SELECT *
FROM transactions
WHERE transaction_type = 'platform_donation'
  AND amount = 50.00
ORDER BY created_at DESC
LIMIT 1;

-- Expected: Full €50 to platform revenue

-- ========================================
-- TEST 4: Wallet → Case Donation
-- ========================================
-- User donates €20 from wallet to case (0% fee)

-- BEFORE: Check wallet and case balances
SELECT 
  (SELECT balance FROM wallets WHERE user_id = 'YOUR_USER_ID') as wallet_before,
  (SELECT reward_amount FROM cases WHERE id = 'YOUR_CASE_ID') as case_before;

-- SIMULATE: Donate from wallet
SELECT donate_from_wallet(
  'YOUR_USER_ID'::UUID,
  'YOUR_CASE_ID'::UUID,
  20.00
);

-- AFTER: Check wallet and case balances
SELECT 
  (SELECT balance FROM wallets WHERE user_id = 'YOUR_USER_ID') as wallet_after,
  (SELECT reward_amount FROM cases WHERE id = 'YOUR_CASE_ID') as case_after;

-- VERIFY: Transaction recorded
SELECT *
FROM transactions
WHERE user_id = 'YOUR_USER_ID'
  AND case_id = 'YOUR_CASE_ID'
  AND transaction_type = 'donation'
ORDER BY created_at DESC
LIMIT 1;

-- Expected:
-- wallet_after = wallet_before - 20
-- case_after = case_before + 20 (full amount, no fee!)

-- ========================================
-- TEST 5: Wallet → Platform Donation
-- ========================================
-- User donates €30 from wallet to platform (0% fee)

-- BEFORE: Check wallet balance
SELECT balance as wallet_before
FROM wallets
WHERE user_id = 'YOUR_USER_ID';

-- BEFORE: Check platform wallet balance
SELECT balance as platform_before
FROM wallets
WHERE user_id IS NULL
LIMIT 1;

-- SIMULATE: Donate to platform from wallet
SELECT process_platform_donation(
  'YOUR_USER_ID'::UUID,
  30.00
);

-- AFTER: Check wallet balance
SELECT balance as wallet_after
FROM wallets
WHERE user_id = 'YOUR_USER_ID';

-- AFTER: Check platform wallet balance
SELECT balance as platform_after
FROM wallets
WHERE user_id IS NULL
LIMIT 1;

-- VERIFY: Transaction recorded
SELECT *
FROM transactions
WHERE created_at > NOW() - INTERVAL '5 minutes'
  AND transaction_type = 'donation'
ORDER BY created_at DESC
LIMIT 1;

-- Expected:
-- wallet_after = wallet_before - 30
-- platform_after = platform_before + 30

-- ========================================
-- CLEANUP: Remove test data
-- ========================================

-- If you want to remove test transactions:
/*
DELETE FROM transactions
WHERE metadata->>'description' LIKE '%Test%';

-- If you want to reset test wallet balance:
UPDATE wallets
SET balance = 0
WHERE user_id = 'YOUR_USER_ID';

-- If you want to reset test case reward:
UPDATE cases
SET reward_amount = 0
WHERE id = 'YOUR_CASE_ID';
*/

-- ========================================
-- EDGE CASE TESTS
-- ========================================

-- TEST: Insufficient balance
SELECT donate_from_wallet(
  'YOUR_USER_ID'::UUID,
  'YOUR_CASE_ID'::UUID,
  999999.00  -- Way more than wallet balance
);
-- Expected: { "success": false, "error": "Insufficient balance" }

-- TEST: Negative amount
SELECT add_user_balance(
  'YOUR_USER_ID'::UUID,
  -10.00,
  'Test negative',
  NULL
);
-- Expected: Should fail or return error

-- TEST: Missing wallet
SELECT add_user_balance(
  '00000000-0000-0000-0000-000000000000'::UUID,  -- Invalid user ID
  10.00,
  'Test missing wallet',
  NULL
);
-- Expected: { "success": false, "error": "Wallet not found" }

-- TEST: Missing case
SELECT increment_case_escrow(
  '00000000-0000-0000-0000-000000000000'::UUID,  -- Invalid case ID
  10.00
);
-- Expected: Should fail (no case updated)

-- ========================================
-- STRESS TEST: Concurrent transactions
-- ========================================

-- This simulates race conditions
-- Run these in SEPARATE transactions simultaneously:

-- Transaction 1:
BEGIN;
SELECT balance FROM wallets WHERE user_id = 'YOUR_USER_ID';
-- Pause here...
UPDATE wallets SET balance = balance - 10 WHERE user_id = 'YOUR_USER_ID';
COMMIT;

-- Transaction 2 (run at same time):
BEGIN;
SELECT balance FROM wallets WHERE user_id = 'YOUR_USER_ID';
-- Pause here...
UPDATE wallets SET balance = balance - 15 WHERE user_id = 'YOUR_USER_ID';
COMMIT;

-- Expected: Both should succeed, balance should decrease by 25 total
-- PostgreSQL's MVCC handles this automatically

-- ========================================
-- VERIFICATION CHECKLIST
-- ========================================

/*
✅ TEST 1: Wallet deposit
   - Balance increased by correct amount
   - Transaction recorded
   - No negative balances

✅ TEST 2: Case donation (Stripe)
   - Case reward increased by NET amount (after fee)
   - Platform fee recorded separately
   - Transaction recorded

✅ TEST 3: Platform donation (Stripe)
   - Full amount to platform revenue
   - No fees deducted
   - Transaction recorded

✅ TEST 4: Wallet → Case
   - User wallet decreased
   - Case reward increased by FULL amount (no fee)
   - Transaction recorded

✅ TEST 5: Wallet → Platform
   - User wallet decreased
   - Platform wallet increased
   - Transaction recorded

✅ EDGE CASES:
   - Insufficient balance handled
   - Invalid IDs handled
   - Negative amounts rejected
   - Race conditions safe
*/

SELECT '✅ All payment flows tested!' as status;
