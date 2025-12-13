-- Check what's in the approved investigator's profile
SELECT 
  id,
  username,
  role,
  investigator_status,
  LEFT(investigator_bio, 200) as bio_preview,
  investigator_expertise,
  LEFT(investigator_experience, 200) as experience_preview,
  investigator_certifications
FROM profiles
WHERE role = 'investigator'
AND investigator_status = 'approved'
LIMIT 5;

-- Check their original application
SELECT 
  a.id,
  a.user_id,
  p.username,
  LEFT(a.motivation, 200) as motivation_preview,
  a.expertise,
  LEFT(a.experience, 200) as experience_preview,
  a.certifications,
  a.status
FROM investigator_applications a
JOIN profiles p ON a.user_id = p.id
WHERE a.status = 'approved'
LIMIT 5;
