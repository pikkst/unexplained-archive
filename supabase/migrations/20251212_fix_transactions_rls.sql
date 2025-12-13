-- Fix transactions RLS policy to allow platform donations
-- Users should be able to insert transactions from their own wallet

DROP POLICY IF EXISTS "transactions_insert_policy" ON transactions;

CREATE POLICY "transactions_insert_policy"
  ON transactions FOR INSERT
  WITH CHECK (
    -- User can insert if they own the from_wallet
    EXISTS (SELECT 1 FROM wallets WHERE id = from_wallet_id AND user_id = auth.uid())
    -- OR if authenticated and no from_wallet specified (system transactions)
    OR (auth.uid() IS NOT NULL AND from_wallet_id IS NULL)
    -- OR service role (for webhook/system operations)
    OR auth.uid() IS NULL
  );
