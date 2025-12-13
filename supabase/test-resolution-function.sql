-- Test process_case_resolution directly with your case
-- Replace IDs with actual values

-- First check the case details
SELECT 
  id,
  title,
  status,
  user_id as submitter,
  COALESCE(assigned_investigator_id, investigator_id) as investigator,
  reward_amount
FROM cases 
WHERE id = '3b2413c5-9fa5-4609-aaf8-0f8444ee9734';

-- Test the function directly
SELECT process_case_resolution(
  '3b2413c5-9fa5-4609-aaf8-0f8444ee9734'::uuid,  -- case_id
  '69aeaeed-0598-4595-a7c3-8d95c06d94bd'::uuid,  -- investigator_id (TestUurija)
  'd2e685c5-0922-4385-8403-279278660ae8'::uuid,  -- submitter_id (TestUser1)
  5,  -- rating (1-5)
  true  -- accepted
) as result;

-- Check case status after
SELECT 
  id,
  title,
  status,
  user_rating,
  updated_at
FROM cases 
WHERE id = '3b2413c5-9fa5-4609-aaf8-0f8444ee9734';

-- Check if transaction was created
SELECT *
FROM transactions
WHERE case_id = '3b2413c5-9fa5-4609-aaf8-0f8444ee9734'
ORDER BY created_at DESC
LIMIT 3;
