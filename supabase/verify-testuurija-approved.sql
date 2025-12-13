-- Verify TestUurija approval status
SELECT 
    id,
    username,
    role,
    investigator_status,
    investigator_approved_at,
    CASE 
        WHEN investigator_status = 'approved' THEN '✅ APPROVED - Can accept cases'
        WHEN investigator_status = 'pending' THEN '⏳ PENDING - Needs admin approval'
        WHEN investigator_status IS NULL THEN '❌ NULL - Column might not exist'
        ELSE '❓ Other: ' || investigator_status
    END as status_check
FROM profiles
WHERE username = 'TestUurija';

-- If status is not 'approved', run this to fix it:
/*
UPDATE profiles 
SET investigator_status = 'approved',
    investigator_approved_at = NOW()
WHERE username = 'TestUurija';
*/
