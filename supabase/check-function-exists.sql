-- Check if notify_case_update function exists and see its definition
SELECT 
  proname as function_name,
  prosrc as function_body
FROM pg_proc
WHERE proname = 'notify_case_update';
