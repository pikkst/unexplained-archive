-- =============================================
-- COMPLETE FIX - REMOVE ALL WALLET RESTRICTIONS
-- This script forcefully removes ALL restrictions
-- =============================================

-- Step 1: Drop ALL existing policies on wallets table
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'wallets'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON wallets', pol.policyname);
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- Step 2: Drop ALL triggers on wallets table
DO $$ 
DECLARE
    trg RECORD;
BEGIN
    FOR trg IN 
        SELECT tgname 
        FROM pg_trigger 
        WHERE tgrelid = 'wallets'::regclass
        AND NOT tgisinternal
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON wallets', trg.tgname);
        RAISE NOTICE 'Dropped trigger: %', trg.tgname;
    END LOOP;
END $$;

-- Step 3: Drop ALL check constraints on wallets
DO $$ 
DECLARE
    con RECORD;
BEGIN
    FOR con IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'wallets'::regclass 
        AND contype = 'c'
        AND conname != 'positive_balance' -- Keep the balance check
    LOOP
        EXECUTE format('ALTER TABLE wallets DROP CONSTRAINT IF EXISTS %I', con.conname);
        RAISE NOTICE 'Dropped constraint: %', con.conname;
    END LOOP;
END $$;

-- Step 4: Drop old wallet creation functions
DROP FUNCTION IF EXISTS create_wallet_for_investigator CASCADE;
DROP FUNCTION IF EXISTS auto_create_wallet_on_profile CASCADE;
DROP FUNCTION IF EXISTS auto_create_wallet_for_all_users CASCADE;
DROP FUNCTION IF EXISTS check_wallet_user_role CASCADE;

-- Step 5: Create NEW simple policies (no role restrictions)
CREATE POLICY "wallets_select_policy"
  ON wallets FOR SELECT
  USING (user_id = auth.uid() OR auth.role() = 'authenticated');

CREATE POLICY "wallets_insert_policy"
  ON wallets FOR INSERT
  WITH CHECK (true);

CREATE POLICY "wallets_update_policy"
  ON wallets FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "wallets_delete_policy"
  ON wallets FOR DELETE
  USING (user_id = auth.uid());

-- Step 6: Create new trigger function (NO role checks)
CREATE OR REPLACE FUNCTION create_wallet_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO wallets (user_id, balance, currency)
  VALUES (NEW.id, 0.00, 'EUR')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Wallet creation failed for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Create new trigger
CREATE TRIGGER trigger_create_wallet_on_signup
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_wallet_on_signup();

-- Step 8: Create wallets for ALL existing users
INSERT INTO wallets (user_id, balance, currency)
SELECT p.id, 0.00, 'EUR'
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM wallets w WHERE w.user_id = p.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Step 9: Update transaction policies
DROP POLICY IF EXISTS "Users can create transactions from their wallets" ON transactions;

CREATE POLICY "transactions_insert_policy"
  ON transactions FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM wallets WHERE id = from_wallet_id AND user_id = auth.uid())
    OR auth.uid() IS NULL
  );

CREATE POLICY "transactions_select_policy"
  ON transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM wallets 
      WHERE (id = from_wallet_id OR id = to_wallet_id) 
      AND user_id = auth.uid()
    )
  );

-- Step 10: Grant permissions
GRANT ALL ON wallets TO authenticated, anon;
GRANT ALL ON transactions TO authenticated;

-- =============================================
-- VERIFICATION
-- =============================================

DO $$ 
DECLARE
  wallet_count INTEGER;
  profile_count INTEGER;
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO wallet_count FROM wallets;
  SELECT COUNT(*) INTO profile_count FROM profiles;
  SELECT COUNT(*) INTO policy_count FROM pg_policies WHERE tablename = 'wallets';
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'WALLET SYSTEM FIXED';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total profiles: %', profile_count;
  RAISE NOTICE 'Total wallets: %', wallet_count;
  RAISE NOTICE 'Active policies: %', policy_count;
  RAISE NOTICE '';
  RAISE NOTICE '✓ All role restrictions removed';
  RAISE NOTICE '✓ All users can now have wallets';
  RAISE NOTICE '✓ Auto-wallet creation enabled';
  RAISE NOTICE '========================================';
END $$;
