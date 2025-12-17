-- Test if credits system exists
SELECT 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name LIKE '%credit%';

SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND table_name = 'credit_transactions'
) AS credit_transactions_exists;

SELECT EXISTS (
  SELECT FROM pg_proc 
  WHERE proname = 'add_user_credits'
) AS add_user_credits_function_exists;

SELECT EXISTS (
  SELECT FROM pg_proc 
  WHERE proname = 'spend_user_credits'
) AS spend_user_credits_function_exists;
