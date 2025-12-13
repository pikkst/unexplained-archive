-- =============================================
-- FIX APPROVE/REJECT FUNCTIONS
-- Update to use existing admin_actions table structure
-- =============================================

-- Fix approve_investigator_application
CREATE OR REPLACE FUNCTION approve_investigator_application(
  p_application_id UUID,
  p_admin_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_expertise TEXT[];
  v_certifications JSONB;
  v_motivation TEXT;
BEGIN
  -- Get application details
  SELECT user_id, expertise, certifications, motivation
  INTO v_user_id, v_expertise, v_certifications, v_motivation
  FROM investigator_applications
  WHERE id = p_application_id;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application not found');
  END IF;
  
  -- Update application status
  UPDATE investigator_applications
  SET status = 'approved',
      reviewed_by = p_admin_id,
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_application_id;
  
  -- Update profile to investigator with approved status
  UPDATE profiles
  SET role = 'investigator',
      investigator_status = 'approved',
      investigator_bio = v_motivation,
      investigator_expertise = v_expertise,
      investigator_certifications = v_certifications,
      investigator_approved_at = NOW(),
      investigator_approved_by = p_admin_id,
      updated_at = NOW()
  WHERE id = v_user_id;
  
  -- Log admin action using correct table structure
  INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, reason, created_at)
  VALUES (p_admin_id, 'APPROVE_INVESTIGATOR', 'user', v_user_id, 'Approved investigator application', NOW());
  
  RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix reject_investigator_application
CREATE OR REPLACE FUNCTION reject_investigator_application(
  p_application_id UUID,
  p_admin_id UUID,
  p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get application user_id
  SELECT user_id INTO v_user_id
  FROM investigator_applications
  WHERE id = p_application_id;
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Application not found');
  END IF;
  
  -- Update application status
  UPDATE investigator_applications
  SET status = 'rejected',
      reviewed_by = p_admin_id,
      reviewed_at = NOW(),
      rejection_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_application_id;
  
  -- Update profile status (keep as user but mark as rejected)
  UPDATE profiles
  SET investigator_status = 'rejected',
      updated_at = NOW()
  WHERE id = v_user_id;
  
  -- Log admin action using correct table structure
  INSERT INTO admin_actions (admin_id, action_type, target_type, target_id, reason, created_at)
  VALUES (p_admin_id, 'REJECT_INVESTIGATOR', 'user', v_user_id, p_reason, NOW());
  
  RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify functions updated
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN ('approve_investigator_application', 'reject_investigator_application')
ORDER BY p.proname;
