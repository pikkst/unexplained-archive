-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';

-- Verify functions are visible
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN ('check_investigator_application', 'submit_investigator_application');
