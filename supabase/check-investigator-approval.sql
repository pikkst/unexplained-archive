-- Check investigator approval status
-- Purpose: Verify if test investigator has been approved

-- 1. Check all test users and their investigator status
SELECT 
    id,
    username,
    role,
    investigator_status,
    CASE 
        WHEN investigator_status = 'approved' THEN '✅ Approved - Can accept cases'
        WHEN investigator_status = 'pending' THEN '⏳ Pending - Must be approved by admin'
        WHEN investigator_status = 'rejected' THEN '❌ Rejected'
        ELSE '❓ Unknown status'
    END as status_meaning,
    created_at
FROM profiles 
WHERE username LIKE '%test%' OR role = 'investigator'
ORDER BY created_at DESC;

-- 2. Check if there are any pending investigator applications
SELECT 
    ia.id,
    ia.user_id,
    p.username,
    ia.status as application_status,
    LEFT(ia.motivation, 100) as motivation_preview,
    ia.created_at
FROM investigator_applications ia
JOIN profiles p ON ia.user_id = p.id
WHERE ia.status = 'pending'
ORDER BY ia.created_at DESC;

-- 3. Quick fix: Approve all pending test investigators (RUN THIS IF NEEDED)
/*
UPDATE profiles 
SET investigator_status = 'approved',
    investigator_approved_at = NOW()
WHERE username LIKE '%test%' 
  AND role = 'investigator'
  AND investigator_status = 'pending';

-- Also approve their applications
UPDATE investigator_applications 
SET status = 'approved',
    reviewed_at = NOW()
WHERE user_id IN (
    SELECT id FROM profiles 
    WHERE username LIKE '%test%' AND role = 'investigator'
)
AND status = 'pending';
*/
