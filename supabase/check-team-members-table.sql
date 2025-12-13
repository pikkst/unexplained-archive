-- Check if case_team_members table exists and its structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'case_team_members'
ORDER BY ordinal_position;

-- Check if trigger exists
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'auto_add_investigator_trigger';

-- Check if there are any rows in case_team_members
SELECT COUNT(*) as total_rows FROM case_team_members;

-- Try to see if there's actual data
SELECT * FROM case_team_members LIMIT 5;

-- Check RLS policies on case_team_members
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'case_team_members'
ORDER BY policyname;
