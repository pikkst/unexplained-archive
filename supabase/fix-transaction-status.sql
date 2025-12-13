-- Fix subscription_transactions status from pending to completed
UPDATE subscription_transactions
SET status = 'completed'
WHERE user_id = '1d5fd006-9953-4d8a-9885-df448e4bd66f'
  AND amount = 239.66
  AND status = 'pending';
