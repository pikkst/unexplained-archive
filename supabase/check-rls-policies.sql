-- Check RLS policies on cases table that affect UPDATE operations
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'cases'
AND cmd IN ('UPDATE', 'ALL')
ORDER BY policyname;

-- Check if investigators can update cases
-- Test as if we're TestUurija (1d5fd006-9953-4d8a-9885-df448e4bd66f)
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "1d5fd006-9953-4d8a-9885-df448e4bd66f", "role": "authenticated"}';

-- Try to see what would happen if we try to update
EXPLAIN (VERBOSE, COSTS OFF)
UPDATE cases 
SET assigned_investigator_id = '1d5fd006-9953-4d8a-9885-df448e4bd66f', 
    status = 'INVESTIGATING'
WHERE title = 'põltsamaa';

RESET ROLE;
