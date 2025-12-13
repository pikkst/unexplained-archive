-- =============================================
-- FIX EXISTING USERS WITHOUT PROFILES
-- Creates profiles for users who registered before trigger was enabled
-- Safe to run multiple times
-- =============================================

-- Create profiles for all auth users who don't have one yet
INSERT INTO public.profiles (id, username, full_name, role, avatar_url, bio, reputation, created_at, updated_at)
SELECT 
  au.id,
  -- Generate username from email
  COALESCE(
    au.raw_user_meta_data->>'username',
    split_part(au.email, '@', 1) || '_' || substr(md5(au.id::text), 1, 6)
  ) as username,
  COALESCE(au.raw_user_meta_data->>'full_name', '') as full_name,
  'user' as role,
  COALESCE(au.raw_user_meta_data->>'avatar_url', '') as avatar_url,
  '' as bio,
  0 as reputation,
  au.created_at,
  NOW() as updated_at
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL  -- Only users without profiles
ON CONFLICT (id) DO NOTHING;

-- Report results
DO $$ 
DECLARE
  total_users INTEGER;
  users_with_profiles INTEGER;
  users_without_profiles INTEGER;
BEGIN
  -- Count total auth users
  SELECT COUNT(*) INTO total_users FROM auth.users;
  
  -- Count users with profiles
  SELECT COUNT(*) INTO users_with_profiles 
  FROM auth.users au
  INNER JOIN profiles p ON p.id = au.id;
  
  users_without_profiles := total_users - users_with_profiles;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE '     PROFILE SYNC REPORT';
  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'Total Auth Users:     %', total_users;
  RAISE NOTICE 'Users with Profiles:  %', users_with_profiles;
  RAISE NOTICE 'Missing Profiles:     %', users_without_profiles;
  RAISE NOTICE '';
  
  IF users_without_profiles = 0 THEN
    RAISE NOTICE '✅ All users have profiles!';
  ELSE
    RAISE NOTICE '⚠️  % user(s) still missing profiles - check errors above', users_without_profiles;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- Show users and their profile status
SELECT 
  au.id,
  au.email,
  au.created_at as registered_at,
  CASE WHEN p.id IS NOT NULL THEN '✅ Has Profile' ELSE '❌ Missing Profile' END as profile_status,
  p.username
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
ORDER BY au.created_at DESC
LIMIT 20;
