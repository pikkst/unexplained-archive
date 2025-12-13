-- Fix notification action URLs to redirect properly
-- This updates existing notifications to have correct URLs or NULL

-- Update welcome notifications to not redirect (stay in inbox)
UPDATE notifications
SET action_url = NULL
WHERE type = 'case_follow_confirm' 
AND title = 'Welcome to Unexplained Archive!';

-- Update case-related notifications to point to the case
UPDATE notifications
SET action_url = '/case/' || case_id::text
WHERE case_id IS NOT NULL 
AND action_url IS NULL 
AND type IN ('case_update', 'case_assigned', 'case_comment', 'case_status_change');

-- Update message notifications to point to inbox
UPDATE notifications
SET action_url = '/messages'
WHERE type IN ('message_received', 'direct_message')
AND action_url IS NULL;

-- Verify the changes
SELECT 
    type,
    COUNT(*) as count,
    COUNT(CASE WHEN action_url IS NULL THEN 1 END) as null_urls,
    COUNT(CASE WHEN action_url LIKE '/case/%' THEN 1 END) as case_urls,
    COUNT(CASE WHEN action_url = '/messages' THEN 1 END) as message_urls
FROM notifications
GROUP BY type
ORDER BY type;
