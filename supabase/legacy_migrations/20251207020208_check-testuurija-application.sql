-- Check if TestUurija has an application record
SELECT 
  a.id,
  a.user_id,
  a.motivation,
  a.expertise,
  a.experience,
  a.certifications,
  a.status,
  a.created_at,
  p.username
FROM investigator_applications a
JOIN profiles p ON a.user_id = p.id
WHERE p.username = 'TestUurija'
ORDER BY a.created_at DESC;

-- Check the profile
SELECT 
  id,
  username,
  role,
  investigator_status,
  investigator_bio,
  investigator_experience,
  investigator_expertise,
  investigator_certifications
FROM profiles
WHERE username = 'TestUurija';
