-- Check what functions exist and their definitions
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  LENGTH(pg_get_functiondef(p.oid)) as definition_length,
  CASE 
    WHEN pg_get_functiondef(p.oid) LIKE '%GROUP BY%' THEN 'YES - HAS GROUP BY'
    ELSE 'NO GROUP BY'
  END as has_group_by
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname LIKE '%investigator%'
ORDER BY p.proname;
