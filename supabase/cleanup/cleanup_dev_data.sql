-- Clean up dev/test data from database
-- Based on actual schema
-- IMPORTANT: Delete in correct order to avoid foreign key constraints!

-- Identify test cases: 3 oldest cases
-- Using direct subqueries instead of CTE for DELETE statements

-- Step 1: Delete from tables that reference cases (before deleting cases!)
DELETE FROM notifications 
WHERE case_id IS NOT NULL;

DELETE FROM transactions 
WHERE case_id IN (SELECT id FROM cases ORDER BY created_at ASC LIMIT 3);

DELETE FROM subscription_usage_log 
WHERE case_id IN (SELECT id FROM cases ORDER BY created_at ASC LIMIT 3);

DELETE FROM subscription_transactions 
WHERE created_at IS NOT NULL;

-- Step 2: Delete case-related data
DELETE FROM case_team_messages 
WHERE case_id IN (SELECT id FROM cases ORDER BY created_at ASC LIMIT 3);

DELETE FROM case_team_members 
WHERE case_id IN (SELECT id FROM cases ORDER BY created_at ASC LIMIT 3);

DELETE FROM case_followers 
WHERE case_id IN (SELECT id FROM cases ORDER BY created_at ASC LIMIT 3);

DELETE FROM forum_posts 
WHERE thread_id IN (
  SELECT id FROM forum_threads 
  WHERE case_id IN (SELECT id FROM cases ORDER BY created_at ASC LIMIT 3)
);

DELETE FROM forum_threads 
WHERE case_id IN (SELECT id FROM cases ORDER BY created_at ASC LIMIT 3);

DELETE FROM comments 
WHERE case_id IN (SELECT id FROM cases ORDER BY created_at ASC LIMIT 3);

DELETE FROM featured_cases 
WHERE case_id IN (SELECT id FROM cases ORDER BY created_at ASC LIMIT 3);

DELETE FROM messages 
WHERE case_id IN (SELECT id FROM cases ORDER BY created_at ASC LIMIT 3);

-- Step 3: NOW delete the 3 test cases (after all references are deleted)
DELETE FROM cases 
WHERE id IN (SELECT id FROM cases ORDER BY created_at ASC LIMIT 3);

-- Step 4: Reset all wallet balances to 0
UPDATE wallets 
SET balance = 0, 
    reserved = 0,
    updated_at = now() 
WHERE balance > 0 OR reserved > 0;

-- Step 5: Clear ALL remaining transactions (dev data)
DELETE FROM transactions;

-- Step 6: Clear platform revenue
DELETE FROM platform_revenue 
WHERE created_at IS NOT NULL;

-- Step 7: Clear withdrawal requests
DELETE FROM withdrawal_requests 
WHERE status IN ('PENDING', 'PROCESSING');

-- Step 8: Clear AI usage logs
DELETE FROM ai_usage 
WHERE created_at IS NOT NULL;

-- Step 9: Verify cleanup results
SELECT 
  'Cases remaining' as metric,
  COUNT(*) as count
FROM cases
UNION ALL
SELECT 'Comments remaining', COUNT(*) FROM comments
UNION ALL
SELECT 'Forum threads', COUNT(*) FROM forum_threads
UNION ALL
SELECT 'Forum posts', COUNT(*) FROM forum_posts
UNION ALL
SELECT 'Transactions remaining', COUNT(*) FROM transactions
UNION ALL
SELECT 'Notifications remaining', COUNT(*) FROM notifications
UNION ALL
SELECT 'Messages remaining', COUNT(*) FROM messages
UNION ALL
SELECT 'Subscription transactions', COUNT(*) FROM subscription_transactions
UNION ALL
SELECT 'Wallet balance > 0', COUNT(*) FROM wallets WHERE balance > 0
UNION ALL
SELECT 'Wallets with reserved > 0', COUNT(*) FROM wallets WHERE reserved > 0;

-- Step 10: Show wallet summary after cleanup
SELECT 
  u.id as user_id,
  u.email,
  p.full_name,
  COALESCE(w.balance, 0) as wallet_balance,
  COALESCE(w.reserved, 0) as wallet_reserved
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
LEFT JOIN wallets w ON u.id = w.user_id
ORDER BY w.balance DESC NULLS LAST;

