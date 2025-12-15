-- ====================================================
-- APPLY THESE MIGRATIONS IN SUPABASE SQL EDITOR
-- ====================================================
-- Go to: https://supabase.com/dashboard/project/yubgqedvrsrzzbpxpvhs/sql/new
-- Copy and paste this entire file and click "Run"
-- ====================================================

-- Migration 1: Add show_email field to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_email BOOLEAN DEFAULT false;
COMMENT ON COLUMN profiles.show_email IS 'Whether user wants to display their email publicly on their profile';

-- Migration 2: Fix profiles RLS policies for public read access
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

CREATE POLICY "Public profiles are viewable by everyone" ON profiles
  FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

COMMENT ON TABLE profiles IS 'User profiles - publicly readable, self-editable';

-- Migration 3: Create get_user_public_email function
CREATE OR REPLACE FUNCTION get_user_public_email(user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email TEXT;
  show_email_flag BOOLEAN;
BEGIN
  -- Check if user wants to show email
  SELECT show_email INTO show_email_flag
  FROM profiles
  WHERE id = user_id;
  
  -- If user doesn't want to show email, return null
  IF NOT COALESCE(show_email_flag, FALSE) THEN
    RETURN NULL;
  END IF;
  
  -- Get email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = user_id;
  
  RETURN user_email;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_public_email(UUID) TO authenticated, anon;
COMMENT ON FUNCTION get_user_public_email IS 'Returns user email only if they have opted to show it publicly via show_email flag in profiles';

-- ====================================================
-- VERIFICATION QUERIES (optional - run after above)
-- ====================================================

-- Check if show_email column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'show_email';

-- Check RLS policies on profiles
SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'profiles';

-- Test function
SELECT get_user_public_email('00000000-0000-0000-0000-000000000000'::UUID);
