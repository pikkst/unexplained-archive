-- Check which investigator column is actually used
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
WHERE id = '3b2413c5-9fa5-4609-aaf8-0f8444ee9734';

-- Check if there's a submitter_id column or if it's user_id
SELECT 
  column_name
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'cases'
AND column_name IN ('submitter_id', 'user_id', 'submitted_by');
