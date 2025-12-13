-- Add investigator_experience column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS investigator_experience TEXT;

-- Update approve function to copy experience field
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
  v_experience TEXT;
BEGIN
  -- Get application details INCLUDING experience
  SELECT user_id, expertise, certifications, motivation, experience
  INTO v_user_id, v_expertise, v_certifications, v_motivation, v_experience
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
  
  -- Update profile to investigator with approved status AND experience
  UPDATE profiles
  SET role = 'investigator',
      investigator_status = 'approved',
      investigator_bio = v_motivation,
      investigator_expertise = v_expertise,
      investigator_certifications = v_certifications,
      investigator_experience = v_experience,
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

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name LIKE 'investigator%'
ORDER BY column_name;
