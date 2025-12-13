-- Query 2: Test function
SELECT process_case_resolution(
  '3b2413c5-9fa5-4609-aaf8-0f8444ee9734'::uuid,  -- case_id
  '69aeaeed-0598-4595-a7c3-8d95c06d94bd'::uuid,  -- investigator_id (TestUurija)
  'd2e685c5-0922-4385-8403-279278660ae8'::uuid,  -- submitter_id (TestUser1)
  5,  -- rating (1-5)
  true  -- accepted
) as result;
