-- Check if case "põltsamaa" has assigned_investigator_id set
SELECT 
    id,
    title,
    status,
    investigator_id,
    assigned_investigator_id,
    CASE 
        WHEN assigned_investigator_id IS NOT NULL THEN 'Assigned to investigator'
        WHEN investigator_id IS NOT NULL THEN 'Has investigator_id (old field)'
        ELSE 'No investigator assigned'
    END as assignment_status,
    created_at,
    updated_at
FROM cases
WHERE title = 'põltsamaa';

-- Also check what TestUurija's user ID is
SELECT 
    id,
    username,
    role,
    investigator_status
FROM profiles
WHERE username ILIKE '%test%urij%';
