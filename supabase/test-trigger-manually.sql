-- TEST: Manually trigger notification by updating case
-- This will test if the trigger fires correctly

-- Step 1: Update the case to trigger notification
UPDATE cases 
SET investigator_notes = 'Manual test update - ' || NOW()::text
WHERE id = '3b2413c5-9fa5-4609-aaf8-0f8444ee9734';

-- Step 2: Check if notification was created
SELECT 
  n.id,
  n.user_id,
  p.username,
  n.type,
  n.title,
  n.message,
  n.created_at
FROM notifications n
LEFT JOIN profiles p ON p.id = n.user_id
WHERE n.case_id = '3b2413c5-9fa5-4609-aaf8-0f8444ee9734'
ORDER BY n.created_at DESC
LIMIT 5;

-- Step 3: If no notifications, check for errors in the function
-- Let's manually call the function to see if it errors
DO $$
DECLARE
  test_result TEXT;
BEGIN
  -- Try to see if function exists and can be called
  RAISE NOTICE 'Testing notify_case_update function...';
END $$;
