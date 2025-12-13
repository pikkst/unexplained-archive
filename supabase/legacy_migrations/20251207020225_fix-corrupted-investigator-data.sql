-- =============================================
-- FIX CORRUPTED INVESTIGATOR DATA
-- Remove SQL NOTIFY commands from bio/experience fields
-- and restore proper data from applications table
-- =============================================

-- Step 1: First check what we're dealing with
SELECT 
  p.id,
  p.username,
  p.role,
  p.investigator_status,
  LEFT(p.investigator_bio, 100) as corrupted_bio,
  LEFT(p.investigator_experience, 100) as corrupted_exp,
  LEFT(a.motivation, 100) as correct_motivation,
  LEFT(a.experience, 100) as correct_experience,
  a.expertise
FROM profiles p
LEFT JOIN investigator_applications a ON p.id = a.user_id AND a.status = 'approved'
WHERE p.role = 'investigator'
AND p.investigator_status = 'approved'
AND (
  p.investigator_bio LIKE '%NOTIFY pgrst%'
  OR p.investigator_bio LIKE '%Force PostgREST%'
  OR p.investigator_experience LIKE '%NOTIFY pgrst%'
  OR p.investigator_experience LIKE '%Force PostgREST%'
);

-- Step 2: Fix the corrupted data by copying from applications
UPDATE profiles p
SET 
  investigator_bio = COALESCE(a.motivation, 'Experienced paranormal investigator'),
  investigator_experience = COALESCE(a.experience, 'Available for case investigations'),
  investigator_expertise = COALESCE(a.expertise, ARRAY['Paranormal Investigation']),
  investigator_certifications = COALESCE(a.certifications, '[]'::jsonb),
  updated_at = NOW()
FROM investigator_applications a
WHERE p.id = a.user_id
AND p.role = 'investigator'
AND p.investigator_status = 'approved'
AND a.status = 'approved'
AND (
  p.investigator_bio LIKE '%NOTIFY pgrst%'
  OR p.investigator_bio LIKE '%Force PostgREST%'
  OR p.investigator_experience LIKE '%NOTIFY pgrst%'
  OR p.investigator_experience LIKE '%Force PostgREST%'
  OR p.investigator_bio IS NULL
  OR p.investigator_experience IS NULL
);

-- Step 3: For investigators without an application record, set default values
UPDATE profiles
SET 
  investigator_bio = 'Experienced investigator specializing in unexplained phenomena',
  investigator_experience = 'Available for case investigations',
  investigator_expertise = COALESCE(investigator_expertise, ARRAY['Paranormal Investigation']),
  updated_at = NOW()
WHERE role = 'investigator'
AND investigator_status = 'approved'
AND (
  investigator_bio IS NULL
  OR investigator_bio LIKE '%NOTIFY pgrst%'
  OR investigator_bio LIKE '%Force PostgREST%'
  OR investigator_experience IS NULL
  OR investigator_experience LIKE '%NOTIFY pgrst%'
  OR investigator_experience LIKE '%Force PostgREST%'
)
AND NOT EXISTS (
  SELECT 1 FROM investigator_applications 
  WHERE investigator_applications.user_id = profiles.id 
  AND investigator_applications.status = 'approved'
);

-- Step 4: Verify the fix
DO $$ 
DECLARE
  corrupted_count INTEGER;
  fixed_count INTEGER;
  total_investigators INTEGER;
BEGIN
  -- Count corrupted records
  SELECT COUNT(*) INTO corrupted_count
  FROM profiles
  WHERE role = 'investigator'
  AND investigator_status = 'approved'
  AND (
    investigator_bio LIKE '%NOTIFY pgrst%'
    OR investigator_bio LIKE '%Force PostgREST%'
    OR investigator_experience LIKE '%NOTIFY pgrst%'
    OR investigator_experience LIKE '%Force PostgREST%'
  );
  
  -- Count total investigators
  SELECT COUNT(*) INTO total_investigators
  FROM profiles
  WHERE role = 'investigator'
  AND investigator_status = 'approved';
  
  -- Calculate fixed count
  fixed_count := total_investigators - corrupted_count;
  
  RAISE NOTICE '✅ Investigator Data Cleanup Complete!';
  RAISE NOTICE '   - Total Investigators: %', total_investigators;
  RAISE NOTICE '   - Fixed Records: %', fixed_count;
  RAISE NOTICE '   - Still Corrupted: %', corrupted_count;
  RAISE NOTICE '';
  
  IF corrupted_count > 0 THEN
    RAISE NOTICE '⚠️  Some records still corrupted - manual review needed';
  ELSE
    RAISE NOTICE '✅ All investigator profiles cleaned!';
  END IF;
END $$;

-- Step 5: Show cleaned records
SELECT 
  username,
  role,
  investigator_status,
  LEFT(investigator_bio, 100) as bio_preview,
  investigator_expertise,
  LEFT(COALESCE(investigator_experience, 'N/A'), 100) as exp_preview,
  investigator_certifications
FROM profiles
WHERE role = 'investigator'
AND investigator_status = 'approved'
ORDER BY username;
