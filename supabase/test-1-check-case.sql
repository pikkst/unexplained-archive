-- Run each query separately to see what's happening

-- Query 1: Check case before
SELECT 
  id,
  title,
  status,
  user_id as submitter,
  COALESCE(assigned_investigator_id, investigator_id) as investigator,
  reward_amount
FROM cases 
WHERE id = '3b2413c5-9fa5-4609-aaf8-0f8444ee9734';
