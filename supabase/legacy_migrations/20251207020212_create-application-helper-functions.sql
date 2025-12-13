-- =============================================
-- HELPER FUNCTIONS FOR INVESTIGATOR APPLICATIONS
-- These bypass direct table access and use RPC instead
-- =============================================

-- Function to check if user has an application
CREATE OR REPLACE FUNCTION check_investigator_application(p_user_id UUID)
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

-- Function to submit an investigator application
CREATE OR REPLACE FUNCTION submit_investigator_application(application_data JSONB)
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_investigator_application(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION submit_investigator_application(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION check_investigator_application(UUID) TO anon;
GRANT EXECUTE ON FUNCTION submit_investigator_application(JSONB) TO anon;

-- Function to get all pending applications (admin only)
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

-- Grant execute to authenticated users (function checks admin internally)
GRANT EXECUTE ON FUNCTION get_pending_investigator_applications() TO authenticated;

-- Verify functions exist
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_name IN ('check_investigator_application', 'submit_investigator_application')
AND routine_schema = 'public';
