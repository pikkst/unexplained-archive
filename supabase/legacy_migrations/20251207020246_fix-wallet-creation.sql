-- =============================================
-- FIX WALLET CREATION CONFLICT
-- Only create wallets for investigators and admins
-- =============================================

-- Update the create_user_wallet function to only create wallets for investigators/admins
CREATE OR REPLACE FUNCTION create_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create wallet for investigators and admins
  IF NEW.role IN ('investigator', 'admin') THEN
    INSERT INTO wallets (user_id, balance, currency)
    VALUES (NEW.id, 0.00, 'EUR')
    ON CONFLICT (user_id) DO NOTHING;
    
    INSERT INTO transaction_limits (user_id, daily_limit, monthly_limit)
    VALUES (NEW.id, 100.00, 500.00)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW 
  EXECUTE FUNCTION create_user_wallet();

-- Also create trigger for when user becomes investigator
CREATE OR REPLACE FUNCTION create_wallet_on_role_change()
RETURNS TRIGGER AS $$
BEGIN
  -- When user becomes investigator or admin, create wallet if they don't have one
  IF NEW.role IN ('investigator', 'admin') AND OLD.role = 'user' THEN
    INSERT INTO wallets (user_id, balance, currency)
    VALUES (NEW.id, 0.00, 'EUR')
    ON CONFLICT (user_id) DO NOTHING;
    
    INSERT INTO transaction_limits (user_id, daily_limit, monthly_limit)
    VALUES (NEW.id, 100.00, 500.00)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_role_change ON profiles;
CREATE TRIGGER on_profile_role_change
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW 
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION create_wallet_on_role_change();

-- Verification
DO $$ 
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE '     WALLET CREATION FIX APPLIED';
  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Wallets will now only be created for:';
  RAISE NOTICE '   - Investigators (role=investigator)';
  RAISE NOTICE '   - Admins (role=admin)';
  RAISE NOTICE '';
  RAISE NOTICE '✅ When regular user becomes investigator:';
  RAISE NOTICE '   - Wallet is auto-created';
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;
