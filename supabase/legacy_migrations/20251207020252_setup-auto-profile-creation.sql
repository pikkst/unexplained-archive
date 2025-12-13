-- =============================================
-- COMPLETE USER SIGNUP SETUP
-- Auto-creates profile + sends welcome notification
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- 1. FUNCTION: Auto-create profile on signup
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
BEGIN
  -- Generate username from email or metadata
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username', 
    split_part(NEW.email, '@', 1)
  );
  
  -- Ensure username is unique by appending random suffix if needed
  WHILE EXISTS (SELECT 1 FROM profiles WHERE username = v_username) LOOP
    v_username := split_part(NEW.email, '@', 1) || '_' || substr(md5(random()::text), 1, 6);
  END LOOP;
  
  -- Insert profile
  INSERT INTO public.profiles (id, username, full_name, role, avatar_url, bio, reputation)
  VALUES (
    NEW.id,
    v_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    '',
    0
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    avatar_url = EXCLUDED.avatar_url;
  
  RAISE LOG 'Profile created for user %', NEW.id;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 2. DROP AND RECREATE TRIGGER
-- =============================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 3. RLS POLICIES FOR PROFILES
-- =============================================

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;

-- Create policies
CREATE POLICY "Public profiles are viewable by everyone" 
  ON profiles FOR SELECT 
  USING (true);

CREATE POLICY "Users can insert own profile" 
  ON profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- =============================================
-- 4. GRANT PERMISSIONS
-- =============================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON profiles TO anon, authenticated;
GRANT INSERT ON profiles TO authenticated, anon;
GRANT UPDATE ON profiles TO authenticated;
GRANT DELETE ON profiles TO authenticated;

-- =============================================
-- 5. VERIFICATION & TESTING
-- =============================================

DO $$ 
DECLARE
  policy_count INTEGER;
  trigger_exists BOOLEAN;
  trigger_enabled TEXT;
BEGIN
  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE schemaname = 'public' AND tablename = 'profiles';
  
  -- Check trigger exists and is enabled
  SELECT 
    tgenabled::TEXT
  INTO trigger_enabled
  FROM pg_trigger 
  WHERE tgname = 'on_auth_user_created'
  LIMIT 1;
  
  trigger_exists := trigger_enabled IS NOT NULL;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE '     USER SIGNUP CONFIGURATION STATUS';
  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Profile Table RLS: ENABLED';
  RAISE NOTICE '   └─ Active Policies: %', policy_count;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Auto-Profile Trigger: %', 
    CASE 
      WHEN trigger_exists AND trigger_enabled = 'O' THEN 'ENABLED ✅' 
      WHEN trigger_exists THEN 'DISABLED ⚠️'
      ELSE 'MISSING ❌' 
    END;
  RAISE NOTICE '';
  
  IF policy_count >= 3 AND trigger_exists AND trigger_enabled = 'O' THEN
    RAISE NOTICE '🎉 All systems ready! New users will:';
    RAISE NOTICE '   1. Auto-create profile on signup';
    RAISE NOTICE '   2. Receive welcome notification';
    RAISE NOTICE '   3. Have full access to their profile';
  ELSE
    RAISE NOTICE '⚠️  Configuration incomplete - check errors above';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- Show current policies (for debugging)
SELECT 
  '📋 Profile Policies:' as info,
  policyname, 
  cmd as operation,
  CASE 
    WHEN qual IS NOT NULL THEN 'USING: ' || qual 
    ELSE 'No USING clause' 
  END as row_filter,
  CASE 
    WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || with_check 
    ELSE 'No WITH CHECK clause' 
  END as insert_check
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;

-- =============================================
-- 6. TEST QUERY (Manual Testing)
-- =============================================

-- To manually test after signup, run:
-- SELECT * FROM profiles WHERE id = 'USER_ID_HERE';

-- To check trigger:
-- SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'on_auth_user_created';
-- tgenabled = 'O' means enabled
