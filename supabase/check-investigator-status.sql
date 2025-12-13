SELECT 
    username,
    role,
    investigator_status,
    CASE 
        WHEN investigator_status = 'approved' THEN '✅ Approved - Can accept cases'
        WHEN investigator_status = 'pending' THEN '⏳ Pending - Must wait for approval'
        WHEN investigator_status = 'rejected' THEN '❌ Rejected'
        ELSE '❓ Unknown status'
    END as status_meaning
FROM profiles 
WHERE username LIKE '%test%'
ORDER BY created_at DESC;
