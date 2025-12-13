-- =============================================
-- WRAPPER FUNCTIONS FOR APPROVE/REJECT
-- Use JSONB parameter to avoid alphabetical sorting issues
-- =============================================

-- Wrapper for approve_investigator_application
CREATE OR REPLACE FUNCTION approve_investigator_application_wrapper(action_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_application_id UUID;
  v_admin_id UUID;
  v_result JSONB;
BEGIN
  -- Extract parameters
  v_application_id := (action_data->>'application_id')::UUID;
  v_admin_id := (action_data->>'admin_id')::UUID;
  
  -- Call original function with correct parameter order
  SELECT approve_investigator_application(v_application_id, v_admin_id)
  INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Wrapper for reject_investigator_application  
CREATE OR REPLACE FUNCTION reject_investigator_application_wrapper(action_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_application_id UUID;
  v_admin_id UUID;
  v_reason TEXT;
  v_result JSONB;
BEGIN
  -- Extract parameters
  v_application_id := (action_data->>'application_id')::UUID;
  v_admin_id := (action_data->>'admin_id')::UUID;
  v_reason := action_data->>'reason';
  
  -- Call original function with correct parameter order
  SELECT reject_investigator_application(v_application_id, v_admin_id, v_reason)
  INTO v_result;
  
  RETURN v_result;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION approve_investigator_application_wrapper(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_investigator_application_wrapper(JSONB) TO authenticated;

-- Force schema reload
NOTIFY pgrst, 'reload schema';

-- Verify
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname LIKE '%investigator%wrapper%'
ORDER BY p.proname;
