-- Test Case Visibility for Investigators
-- Purpose: Verify that investigators can see cases submitted by users

-- 1. Check all cases and their current status
SELECT 
    id,
    title,
    status,
    user_id,
    created_at,
    reward_amount,
    investigator_id
FROM cases
ORDER BY created_at DESC
LIMIT 10;

-- 2. Check if we have any 'pending' status cases (old format)
SELECT 
    COUNT(*) as pending_count,
    array_agg(title) as pending_titles
FROM cases
WHERE status = 'pending';

-- 3. Check users who submitted cases
SELECT 
    p.username,
    p.role,
    COUNT(c.id) as cases_submitted
FROM profiles p
LEFT JOIN cases c ON c.user_id = p.id
GROUP BY p.id, p.username, p.role
HAVING COUNT(c.id) > 0;

-- 4. Check if RLS policies exist for cases table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual as using_expression
FROM pg_policies
WHERE tablename = 'cases'
ORDER BY policyname;
