-- =============================================
-- DEPLOY ADMIN FUNCTIONS - CLEAN INSTALLATION
-- Drop old versions and recreate to avoid cache issues
-- =============================================

-- Drop existing function to clear any cached versions
DROP FUNCTION IF EXISTS get_pending_investigator_applications();

-- Recreate function with correct implementation (no GROUP BY needed)
CREATE OR REPLACE FUNCTION get_pending_investigator_applications()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_is_admin BOOLEAN;
BEGIN
  -- Check if caller is admin
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized - admin access required'
    );
  END IF;
  
  -- Get all pending applications with user details
  -- Uses jsonb_agg which doesn't require GROUP BY
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'user_id', a.user_id,
      'motivation', a.motivation,
      'expertise', a.expertise,
      'experience', a.experience,
      'certifications', a.certifications,
      'status', a.status,
      'created_at', a.created_at,
      'applicant', jsonb_build_object(
        'id', p.id,
        'username', p.username,
        'email', au.email,
        'avatar_url', p.avatar_url
      )
    )
  )
  INTO v_result
  FROM public.investigator_applications a
  JOIN public.profiles p ON a.user_id = p.id
  JOIN auth.users au ON p.id = au.id
  WHERE a.status = 'pending'
  ORDER BY a.created_at DESC;
  
  RETURN jsonb_build_object(
    'success', true,
    'applications', COALESCE(v_result, '[]'::jsonb)
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_pending_investigator_applications() TO authenticated;

-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';

-- Verify function was created
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type,
  p.prosrc as source_code
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'get_pending_investigator_applications';
