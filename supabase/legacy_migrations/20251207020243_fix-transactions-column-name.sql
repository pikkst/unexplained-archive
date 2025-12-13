-- =============================================
-- FIX TRANSACTIONS TABLE - ADD 'type' ALIAS
-- Resolves "Could not find the 'type' column" error
-- =============================================

-- Check current column names
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'transactions'
ORDER BY ordinal_position;

-- The transactions table has 'transaction_type' but code expects 'type'
-- Add 'type' as a generated column that mirrors transaction_type

-- STEP 1: Drop the existing view first (it might have conflicting column names)
DROP VIEW IF EXISTS transactions_with_users CASCADE;

-- STEP 2: Add 'type' as an alias column (RECOMMENDED - doesn't break existing queries)
-- This creates a computed column that mirrors transaction_type
ALTER TABLE transactions 
  ADD COLUMN IF NOT EXISTS type TEXT 
  GENERATED ALWAYS AS (transaction_type) STORED;

-- STEP 3: Recreate the view WITHOUT the duplicate 'type' alias
CREATE OR REPLACE VIEW transactions_with_users AS
SELECT 
  t.*,
  -- Don't add 'type' here since it's now in the table itself via t.*
  w_from.user_id as from_user_id,
  w_to.user_id as to_user_id,
  p_from.username as from_username,
  p_from.avatar_url as from_avatar_url,
  p_to.username as to_username,
  p_to.avatar_url as to_avatar_url
FROM transactions t
LEFT JOIN wallets w_from ON t.from_wallet_id = w_from.id
LEFT JOIN wallets w_to ON t.to_wallet_id = w_to.id
LEFT JOIN profiles p_from ON w_from.user_id = p_from.id
LEFT JOIN profiles p_to ON w_to.user_id = p_to.id;

-- Force PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- Verify the fix
DO $$ 
DECLARE
  has_type BOOLEAN;
  has_transaction_type BOOLEAN;
BEGIN
  -- Check if both columns exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'transactions'
    AND column_name = 'type'
  ) INTO has_type;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'transactions'
    AND column_name = 'transaction_type'
  ) INTO has_transaction_type;
  
  RAISE NOTICE '✅ Transactions table column fix complete!';
  RAISE NOTICE '   - transaction_type column: %', CASE WHEN has_transaction_type THEN 'EXISTS ✅' ELSE 'MISSING ❌' END;
  RAISE NOTICE '   - type column (alias): %', CASE WHEN has_type THEN 'EXISTS ✅' ELSE 'MISSING ❌' END;
  RAISE NOTICE '';
  RAISE NOTICE '🔄 PostgREST schema cache reloaded';
END $$;

-- Show both columns
SELECT 
  column_name,
  data_type,
  is_generated,
  generation_expression
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'transactions'
AND column_name IN ('type', 'transaction_type')
ORDER BY ordinal_position;
