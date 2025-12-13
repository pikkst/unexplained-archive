-- =============================================
-- IMMEDIATE FIX FOR TESTUURIJA CORRUPTED DATA
-- Directly clean up SQL NOTIFY commands
-- =============================================

-- Step 1: Direct cleanup for TestUurija (using user ID for reliability)
UPDATE profiles
SET 
  investigator_bio = 'Experienced paranormal investigator with expertise in unexplained phenomena. Dedicated to uncovering the truth behind mysterious cases and applying scientific methods to paranormal research.',
  investigator_experience = 'Background in paranormal investigation and research. Experienced in field investigation, evidence analysis, and case documentation. Ready to take on challenging cases involving unexplained phenomena.',
  updated_at = NOW()
WHERE id = 'c357f5ee-21df-43bb-a37a-33850d5fa7e0'::uuid;

-- Step 2: Try to restore from application if it exists
UPDATE profiles p
SET 
  investigator_bio = a.motivation,
  investigator_experience = COALESCE(a.experience, p.investigator_experience),
  investigator_expertise = COALESCE(a.expertise, p.investigator_expertise),
  investigator_certifications = COALESCE(a.certifications, p.investigator_certifications),
  updated_at = NOW()
FROM investigator_applications a
WHERE p.id = 'c357f5ee-21df-43bb-a37a-33850d5fa7e0'::uuid
AND p.id = a.user_id
AND a.status = 'approved'
AND a.motivation IS NOT NULL
AND a.motivation NOT LIKE '%NOTIFY pgrst%'
AND a.motivation NOT LIKE '%Force PostgREST%'
AND LENGTH(a.motivation) > 20; -- Ensure it's real content

-- Step 3: Verify the fix
SELECT 
  username,
  role,
  investigator_status,
  LEFT(investigator_bio, 150) as bio_preview,
  investigator_expertise,
  LEFT(investigator_experience, 150) as exp_preview,
  investigator_certifications
FROM profiles
WHERE id = 'c357f5ee-21df-43bb-a37a-33850d5fa7e0'::uuid;

-- Step 4: Completion message
DO $$ 
BEGIN
  RAISE NOTICE '✅ TestUurija profile cleaned!';
  RAISE NOTICE '   Bio and experience fields updated with proper content';
  RAISE NOTICE '   If original application data exists, it has been restored';
END $$;
