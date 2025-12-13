-- =============================================
-- NUCLEAR OPTION - FULL CLEANUP AND REBUILD
-- =============================================

-- Drop the old submit function (positional parameters)
DROP FUNCTION IF EXISTS submit_investigator_application(uuid, text, text[], text, jsonb) CASCADE;

-- Drop the new submit function (JSONB parameter)  
DROP FUNCTION IF EXISTS submit_investigator_application(jsonb) CASCADE;

-- Drop the problematic get function with GROUP BY
DROP FUNCTION IF EXISTS get_pending_investigator_applications() CASCADE;

-- Drop check function
DROP FUNCTION IF EXISTS check_investigator_application(uuid) CASCADE;

-- Wait a moment for PostgreSQL to clear cache
DO $$ 
BEGIN
  PERFORM pg_sleep(1);
END $$;

-- =============================================
-- RECREATE: check_investigator_application
-- =============================================
CREATE FUNCTION check_investigator_application(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_application RECORD;
BEGIN
  SELECT id, status, created_at
  INTO v_application
  FROM public.investigator_applications
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_application.id IS NULL THEN
    RETURN jsonb_build_object(
      'exists', false,
      'status', NULL
    );
  ELSE
    RETURN jsonb_build_object(
      'exists', true,
      'status', v_application.status,
      'created_at', v_application.created_at
    );
  END IF;
END;
$$;

-- =============================================
-- RECREATE: submit_investigator_application (JSONB only)
-- =============================================
CREATE FUNCTION submit_investigator_application(application_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_application_id UUID;
  v_user_id UUID;
  v_motivation TEXT;
  v_expertise TEXT[];
  v_experience TEXT;
  v_certifications JSONB;
BEGIN
  -- Extract parameters from JSONB
  v_user_id := (application_data->>'user_id')::UUID;
  v_motivation := application_data->>'motivation';
  v_expertise := ARRAY(SELECT jsonb_array_elements_text(application_data->'expertise'));
  v_experience := application_data->>'experience';
  v_certifications := COALESCE(application_data->'certifications', '[]'::jsonb);
  
  -- Check if user already has a pending application
  IF EXISTS (
    SELECT 1 FROM public.investigator_applications
    WHERE user_id = v_user_id
    AND status = 'pending'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You already have a pending application'
    );
  END IF;
  
  -- Insert new application
  INSERT INTO public.investigator_applications (
    user_id,
    motivation,
    expertise,
    experience,
    certifications,
    status,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    v_motivation,
    v_expertise,
    v_experience,
    v_certifications,
    'pending',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_application_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'application_id', v_application_id
  );
END;
$$;

-- =============================================
-- RECREATE: get_pending_investigator_applications
-- NO GROUP BY - uses subquery with row_to_json
-- =============================================
CREATE FUNCTION get_pending_investigator_applications()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_applications JSONB;
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
  
  -- Build applications array using subquery
  SELECT COALESCE(
    jsonb_agg(row_data),
    '[]'::jsonb
  )
  INTO v_applications
  FROM (
    SELECT jsonb_build_object(
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
    ) as row_data
    FROM public.investigator_applications a
    INNER JOIN public.profiles p ON a.user_id = p.id
    INNER JOIN auth.users au ON p.id = au.id
    WHERE a.status = 'pending'
    ORDER BY a.created_at DESC
  ) subq;
  
  RETURN jsonb_build_object(
    'success', true,
    'applications', v_applications
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_investigator_application(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_investigator_application(UUID) TO anon;
GRANT EXECUTE ON FUNCTION submit_investigator_application(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_investigator_application(JSONB) TO anon;
GRANT EXECUTE ON FUNCTION get_pending_investigator_applications() TO authenticated;

-- Force schema reload
NOTIFY pgrst, 'reload schema';

-- Verify - should show NO GROUP BY for all
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  CASE 
    WHEN pg_get_functiondef(p.oid) LIKE '%GROUP BY%' THEN '❌ STILL HAS GROUP BY'
    ELSE '✅ NO GROUP BY'
  END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN ('check_investigator_application', 'submit_investigator_application', 'get_pending_investigator_applications')
ORDER BY p.proname;
