-- Fix existing approved investigator's profile data
-- Copy from their application to profile

UPDATE profiles p
SET 
  investigator_bio = a.motivation,
  investigator_expertise = a.expertise,
  investigator_experience = a.experience,
  investigator_certifications = a.certifications,
  updated_at = NOW()
FROM investigator_applications a
WHERE p.id = a.user_id
AND p.role = 'investigator'
AND p.investigator_status = 'approved'
AND a.status = 'approved'
AND (
  p.investigator_bio IS NULL 
  OR p.investigator_bio LIKE '%NOTIFY pgrst%'  -- Fix SQL code in bio
  OR p.investigator_experience IS NULL
);

-- Verify the fix
SELECT 
  username,
  role,
  investigator_status,
  LEFT(investigator_bio, 100) as bio_preview,
  investigator_expertise,
  LEFT(investigator_experience, 100) as exp_preview
FROM profiles
WHERE role = 'investigator'
AND investigator_status = 'approved';
