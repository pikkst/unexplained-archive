-- =============================================
-- FIX SECURITY AND RLS ISSUES
-- Addresses database linter errors
-- =============================================

-- 1. Enable RLS on tables where it is missing
ALTER TABLE IF EXISTS user_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS stripe_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS internal_transfers ENABLE ROW LEVEL SECURITY;

-- 2. Create RLS Policies

-- Challenges: Public read, Admin write
DROP POLICY IF EXISTS "Public view challenges" ON challenges;
CREATE POLICY "Public view challenges" ON challenges FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage challenges" ON challenges;
CREATE POLICY "Admins manage challenges" ON challenges FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- User Challenges: Users see/modify own, Admins view all
DROP POLICY IF EXISTS "Users view own challenges" ON user_challenges;
CREATE POLICY "Users view own challenges" ON user_challenges FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own challenges" ON user_challenges;
CREATE POLICY "Users update own challenges" ON user_challenges FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins view all user challenges" ON user_challenges;
CREATE POLICY "Admins view all user challenges" ON user_challenges FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Stripe Accounts: Admins only
DROP POLICY IF EXISTS "Admins manage stripe accounts" ON stripe_accounts;
CREATE POLICY "Admins manage stripe accounts" ON stripe_accounts FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Internal Transfers: Admins only
DROP POLICY IF EXISTS "Admins manage internal transfers" ON internal_transfers;
CREATE POLICY "Admins manage internal transfers" ON internal_transfers FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 3. Fix "Security Definer View" warnings
-- Recreating views ensures they are standard views (Security Invoker by default in Postgres)
-- This ensures RLS on underlying tables is respected.

-- Recreate transaction_statistics
DROP VIEW IF EXISTS transaction_statistics;
CREATE OR REPLACE VIEW transaction_statistics
WITH (security_invoker = true)
AS
SELECT
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as transaction_count,
  SUM(amount) as total_volume
FROM transactions
GROUP BY DATE_TRUNC('day', created_at);

GRANT SELECT ON transaction_statistics TO authenticated;

-- Recreate translation_analytics
DROP VIEW IF EXISTS translation_analytics;
CREATE OR REPLACE VIEW translation_analytics
WITH (security_invoker = true)
AS
SELECT
  user_id,
  feature,
  cost,
  created_at
FROM ai_usage
WHERE feature IN ('translation', 'ocr');

GRANT SELECT ON translation_analytics TO authenticated;

-- Recreate transactions_with_users
-- Note: We make sure to include the 'type' column alias as per previous fixes
DROP VIEW IF EXISTS transactions_with_users;
CREATE OR REPLACE VIEW transactions_with_users
WITH (security_invoker = true)
AS
SELECT
  t.*,
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

GRANT SELECT ON transactions_with_users TO authenticated;

-- Force schema reload
NOTIFY pgrst, 'reload schema';