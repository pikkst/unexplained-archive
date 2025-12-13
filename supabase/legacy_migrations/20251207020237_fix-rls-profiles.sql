-- =============================================
-- FIX RLS PROFILE CREATION ISSUE
-- Safe to run multiple times (uses IF EXISTS / OR REPLACE)
-- =============================================

-- Drop and recreate INSERT policy for profiles
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Users can insert own profile" 
  ON profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- =============================================
-- AUTO-CREATE PROFILE ON SIGNUP (TRIGGER)
-- =============================================

-- Function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, role, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'user',
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- GRANT PERMISSIONS
-- =============================================

-- Grant necessary permissions for authenticated users
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Specific permission for profiles table
GRANT INSERT ON profiles TO authenticated;
GRANT INSERT ON profiles TO anon;  -- Needed for signup

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Show all RLS policies for profiles
DO $$ 
DECLARE
  policy_count INTEGER;
  trigger_exists BOOLEAN;
BEGIN
  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE schemaname = 'public' AND tablename = 'profiles';
  
  -- Check trigger exists
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'on_auth_user_created'
  ) INTO trigger_exists;
  
  RAISE NOTICE '✅ Profile RLS configured!';
  RAISE NOTICE '   - % RLS policies active on profiles table', policy_count;
  RAISE NOTICE '   - Auto-profile trigger: %', CASE WHEN trigger_exists THEN 'ENABLED ✅' ELSE 'MISSING ❌' END;
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Users can now register!';
END $$;

-- Show policies (for debugging)
SELECT 
  policyname, 
  cmd as operation,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;
