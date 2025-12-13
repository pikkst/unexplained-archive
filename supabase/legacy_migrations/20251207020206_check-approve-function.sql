-- Check approve and reject function signatures
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_identity_arguments(p.oid) as identity_args
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN ('approve_investigator_application', 'reject_investigator_application')
ORDER BY p.proname;
