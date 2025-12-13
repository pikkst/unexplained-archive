-- =============================================
-- FINAL FIX - SIMPLE QUERY WITHOUT AGGREGATION
-- =============================================

-- Drop ALL versions
DROP FUNCTION IF EXISTS get_pending_investigator_applications() CASCADE;

-- Create with simple ARRAY aggregation instead of JSONB
CREATE OR REPLACE FUNCTION get_pending_investigator_applications()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_applications JSONB DEFAULT '[]'::jsonb;
BEGIN
  -- Check if caller is admin
  SELECT (role = 'admin')
  INTO v_is_admin
  FROM public.profiles
  WHERE id = auth.uid();
  
  IF NOT COALESCE(v_is_admin, false) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized - admin access required'
    );
  END IF;
  
  -- Build result using simple subquery
  SELECT COALESCE(
    jsonb_agg(row_to_json(apps.*)),
    '[]'::jsonb
  )
  INTO v_applications
  FROM (
    SELECT 
      a.id,
      a.user_id,
      a.motivation,
      a.expertise,
      a.experience,
      a.certifications,
      a.status,
      a.created_at,
      jsonb_build_object(
        'id', p.id,
        'username', p.username,
        'email', au.email,
        'avatar_url', p.avatar_url
      ) as applicant
    FROM public.investigator_applications a
    INNER JOIN public.profiles p ON a.user_id = p.id
    INNER JOIN auth.users au ON p.id = au.id
    WHERE a.status = 'pending'
    ORDER BY a.created_at DESC
  ) apps;
  
  RETURN jsonb_build_object(
    'success', true,
    'applications', v_applications
  );
END;
$$;

-- Grant permission
GRANT EXECUTE ON FUNCTION get_pending_investigator_applications() TO authenticated;

-- Force reload
NOTIFY pgrst, 'reload schema';

-- Test the function as admin
SELECT get_pending_investigator_applications();
