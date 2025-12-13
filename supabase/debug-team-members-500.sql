-- Simple SELECT to test if table works at all
SELECT * FROM case_team_members LIMIT 1;

-- Check if there's data for this specific case
SELECT 
    id,
    case_id,
    investigator_id,
    role,
    status,
    contribution_percentage
FROM case_team_members
WHERE case_id = '3b2413c5-9fa5-4609-aaf8-0f8444ee9734';

-- Try the exact same query that frontend is making
SELECT role
FROM case_team_members
WHERE case_id = '3b2413c5-9fa5-4609-aaf8-0f8444ee9734'
AND investigator_id = '1d5fd006-9953-4d8a-9885-df448e4bd66f'
AND role = 'leader'
AND status = 'active';

-- Check all constraints on the table
SELECT
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'case_team_members'
ORDER BY tc.constraint_type, tc.constraint_name;
