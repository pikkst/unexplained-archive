-- Debug: Check what happened after resolution
-- Replace with your actual case_id

-- Check case status
SELECT 
  id,
  title,
  status,
  user_id as submitter_id,
  investigator_id,
  assigned_investigator_id,
  reward_amount,
  user_rating,
  updated_at
FROM cases
WHERE id = '3b2413c5-9fa5-4609-aaf8-0f8444ee9734'; -- Replace with actual case ID

-- Check recent transactions (check actual columns first with check-transactions-columns.sql)
-- Common column names might be: transaction_type, type, amount, status, description
SELECT *
FROM transactions
WHERE case_id = '3b2413c5-9fa5-4609-aaf8-0f8444ee9734' -- Replace with actual case ID
ORDER BY created_at DESC
LIMIT 10;

-- Check wallet balances (check actual columns with check-wallets-columns.sql)
SELECT 
  w.user_id,
  p.username,
  w.*
FROM wallets w
JOIN profiles p ON p.id = w.user_id
WHERE w.user_id IN (
  SELECT user_id FROM cases WHERE id = '3b2413c5-9fa5-4609-aaf8-0f8444ee9734'
  UNION
  SELECT COALESCE(assigned_investigator_id, investigator_id) FROM cases WHERE id = '3b2413c5-9fa5-4609-aaf8-0f8444ee9734'
);

-- Check notifications
SELECT 
  n.id,
  n.user_id,
  p.username,
  n.type,
  n.title,
  n.message,
  n.created_at
FROM notifications n
JOIN profiles p ON p.id = n.user_id
WHERE n.case_id = '3b2413c5-9fa5-4609-aaf8-0f8444ee9734'
ORDER BY n.created_at DESC
LIMIT 5;
