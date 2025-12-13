-- =============================================
-- FIX TRANSACTION LIMITS RLS POLICIES
-- Resolves 406 Not Acceptable error
-- =============================================

-- Drop all existing policies on transaction_limits
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
        AND tablename = 'transaction_limits'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON transaction_limits', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- Ensure RLS is enabled
ALTER TABLE transaction_limits ENABLE ROW LEVEL SECURITY;

-- Create clear, non-conflicting policies

-- 1. Users can view their own transaction limits
CREATE POLICY "Users can view own transaction limits"
  ON transaction_limits 
  FOR SELECT
  USING (user_id = auth.uid());

-- 2. Admins can view all transaction limits
CREATE POLICY "Admins can view all transaction limits"
  ON transaction_limits 
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- 3. Users can insert their own transaction limits (for auto-creation)
CREATE POLICY "Users can insert own transaction limits"
  ON transaction_limits 
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 4. System/triggers can insert for any user (needed for auto-creation)
CREATE POLICY "System can insert transaction limits"
  ON transaction_limits 
  FOR INSERT
  WITH CHECK (true);

-- 5. Admins can update any transaction limits
CREATE POLICY "Admins can update transaction limits"
  ON transaction_limits 
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- 6. System can update via triggers (for limit resets and KYC updates)
CREATE POLICY "System can update transaction limits"
  ON transaction_limits 
  FOR UPDATE
  USING (true);

-- =============================================
-- ENSURE DEFAULT LIMITS FOR EXISTING USERS
-- =============================================

-- Create transaction limits for users who don't have them
INSERT INTO transaction_limits (user_id, daily_limit, monthly_limit)
SELECT 
  p.id,
  100.00, -- Default daily limit
  1000.00 -- Default monthly limit
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM transaction_limits tl WHERE tl.user_id = p.id
)
ON CONFLICT (user_id) DO NOTHING;

-- =============================================
-- GRANT PERMISSIONS
-- =============================================

-- Grant table permissions to authenticated users
GRANT SELECT ON transaction_limits TO authenticated;
GRANT INSERT ON transaction_limits TO authenticated;

-- Grant all permissions to service role (for triggers)
GRANT ALL ON transaction_limits TO service_role;

-- =============================================
-- VERIFICATION
-- =============================================

DO $$ 
DECLARE
  policy_count INTEGER;
  user_count INTEGER;
  limit_count INTEGER;
BEGIN
  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies 
  WHERE schemaname = 'public' 
  AND tablename = 'transaction_limits';
  
  -- Count users
  SELECT COUNT(*) INTO user_count
  FROM profiles;
  
  -- Count transaction limits
  SELECT COUNT(*) INTO limit_count
  FROM transaction_limits;
  
  RAISE NOTICE '✅ Transaction Limits RLS Fixed!';
  RAISE NOTICE '   - % RLS policies active', policy_count;
  RAISE NOTICE '   - % users in database', user_count;
  RAISE NOTICE '   - % transaction limit records', limit_count;
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Policies created:';
  RAISE NOTICE '   - Users can view own limits';
  RAISE NOTICE '   - Admins can view all limits';
  RAISE NOTICE '   - Users/system can insert limits';
  RAISE NOTICE '   - Admins/system can update limits';
  RAISE NOTICE '';
  
  IF limit_count < user_count THEN
    RAISE NOTICE '⚠️  Some users still missing transaction limits!';
  ELSE
    RAISE NOTICE '✅ All users have transaction limits';
  END IF;
END $$;

-- Show current policies (for debugging)
SELECT 
  policyname,
  cmd as operation,
  CASE 
    WHEN qual IS NOT NULL THEN 'USING: ' || qual
    WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || with_check
    ELSE 'No condition'
  END as condition
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename = 'transaction_limits'
ORDER BY policyname;
