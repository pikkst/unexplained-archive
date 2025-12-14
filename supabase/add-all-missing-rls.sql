-- ADD RLS TO ALL MISSING TABLES
-- Based on check-rls-status.sql results
-- CRITICAL SECURITY FIX - 16 tables need protection!

-- =============================================================================
-- 1. admin_actions - Admin activity log
-- =============================================================================
ALTER TABLE IF EXISTS admin_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can view admin actions" ON admin_actions;
DROP POLICY IF EXISTS "Only admins can insert admin actions" ON admin_actions;

CREATE POLICY "Only admins can view admin actions" ON admin_actions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Only admins can insert admin actions" ON admin_actions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =============================================================================
-- 2. ai_usage - AI API usage tracking
-- =============================================================================
ALTER TABLE IF EXISTS ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own AI usage" ON ai_usage;
DROP POLICY IF EXISTS "Service role only for AI usage insert" ON ai_usage;

CREATE POLICY "Users can view own AI usage" ON ai_usage
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role only for AI usage insert" ON ai_usage
  FOR INSERT WITH CHECK (false); -- Only via SECURITY DEFINER functions

-- =============================================================================
-- 3. badges - Badge definitions
-- =============================================================================
ALTER TABLE IF EXISTS badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view badges" ON badges;

CREATE POLICY "Everyone can view badges" ON badges
  FOR SELECT USING (true);

-- =============================================================================
-- 4. boost_pricing - Boost price tiers
-- =============================================================================
ALTER TABLE IF EXISTS boost_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view boost pricing" ON boost_pricing;

CREATE POLICY "Everyone can view boost pricing" ON boost_pricing
  FOR SELECT USING (true);

-- =============================================================================
-- 5. case_followers - Users following cases
-- =============================================================================
ALTER TABLE IF EXISTS case_followers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view followers" ON case_followers;
DROP POLICY IF EXISTS "Users can follow cases" ON case_followers;
DROP POLICY IF EXISTS "Users can unfollow cases" ON case_followers;

CREATE POLICY "Anyone can view followers" ON case_followers
  FOR SELECT USING (true);

CREATE POLICY "Users can follow cases" ON case_followers
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can unfollow cases" ON case_followers
  FOR DELETE USING (user_id = auth.uid());

-- =============================================================================
-- 6. challenges - Challenge definitions
-- =============================================================================
ALTER TABLE IF EXISTS challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view challenges" ON challenges;

CREATE POLICY "Everyone can view challenges" ON challenges
  FOR SELECT USING (true);

-- =============================================================================
-- 7. comments - Case comments
-- =============================================================================
ALTER TABLE IF EXISTS comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view comments" ON comments;
DROP POLICY IF EXISTS "Users can create comments" ON comments;
DROP POLICY IF EXISTS "Users can update own comments" ON comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON comments;

CREATE POLICY "Anyone can view comments" ON comments
  FOR SELECT USING (true);

CREATE POLICY "Users can create comments" ON comments
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own comments" ON comments
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own comments" ON comments
  FOR DELETE USING (user_id = auth.uid());

-- =============================================================================
-- 8. featured_cases - Featured case highlights
-- =============================================================================
ALTER TABLE IF EXISTS featured_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view featured cases" ON featured_cases;
DROP POLICY IF EXISTS "Users can view own boosts" ON featured_cases;
DROP POLICY IF EXISTS "Admins can manage featured cases" ON featured_cases;

CREATE POLICY "Everyone can view featured cases" ON featured_cases
  FOR SELECT USING (true);

CREATE POLICY "Users can view own boosts" ON featured_cases
  FOR SELECT USING (paid_by = auth.uid());

CREATE POLICY "Admins can manage featured cases" ON featured_cases
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =============================================================================
-- 9. forum_posts - Forum post replies
-- =============================================================================
ALTER TABLE IF EXISTS forum_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view forum posts" ON forum_posts;
DROP POLICY IF EXISTS "Users can create forum posts" ON forum_posts;
DROP POLICY IF EXISTS "Users can update own forum posts" ON forum_posts;
DROP POLICY IF EXISTS "Users can delete own forum posts" ON forum_posts;

CREATE POLICY "Anyone can view forum posts" ON forum_posts
  FOR SELECT USING (true);

CREATE POLICY "Users can create forum posts" ON forum_posts
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own forum posts" ON forum_posts
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own forum posts" ON forum_posts
  FOR DELETE USING (user_id = auth.uid());

-- =============================================================================
-- 10. forum_threads - Forum discussion threads
-- =============================================================================
ALTER TABLE IF EXISTS forum_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view forum threads" ON forum_threads;
DROP POLICY IF EXISTS "Users can create forum threads" ON forum_threads;
DROP POLICY IF EXISTS "Users can update own forum threads" ON forum_threads;
DROP POLICY IF EXISTS "Users can delete own forum threads" ON forum_threads;

CREATE POLICY "Anyone can view forum threads" ON forum_threads
  FOR SELECT USING (true);

CREATE POLICY "Users can create forum threads" ON forum_threads
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own forum threads" ON forum_threads
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own forum threads" ON forum_threads
  FOR DELETE USING (user_id = auth.uid());

-- =============================================================================
-- 11. kyc_verification - KYC documents
-- =============================================================================
ALTER TABLE IF EXISTS kyc_verification ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own KYC" ON kyc_verification;
DROP POLICY IF EXISTS "Users can submit KYC" ON kyc_verification;
DROP POLICY IF EXISTS "Admins can view all KYC" ON kyc_verification;

CREATE POLICY "Users can view own KYC" ON kyc_verification
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can submit KYC" ON kyc_verification
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all KYC" ON kyc_verification
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =============================================================================
-- 12. moderation_flags - Content moderation flags
-- =============================================================================
ALTER TABLE IF EXISTS moderation_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can flag content" ON moderation_flags;
DROP POLICY IF EXISTS "Admins can view flags" ON moderation_flags;

CREATE POLICY "Users can flag content" ON moderation_flags
  FOR INSERT WITH CHECK (flagged_by = auth.uid());

CREATE POLICY "Admins can view flags" ON moderation_flags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =============================================================================
-- 13. stripe_accounts - Stripe account connections (SYSTEM TABLE)
-- =============================================================================
ALTER TABLE IF EXISTS stripe_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only for stripe accounts" ON stripe_accounts;

-- No user_id column - this is a system config table
-- Only service role can access
CREATE POLICY "Service role only for stripe accounts" ON stripe_accounts
  FOR ALL USING (false);

-- =============================================================================
-- 14. transaction_limits - User transaction limits
-- =============================================================================
ALTER TABLE IF EXISTS transaction_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own limits" ON transaction_limits;
DROP POLICY IF EXISTS "Service role only for limits" ON transaction_limits;

CREATE POLICY "Users can view own limits" ON transaction_limits
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role only for limits" ON transaction_limits
  FOR ALL USING (false);

-- =============================================================================
-- 15. withdrawal_requests - Already in other file but RLS disabled!
-- =============================================================================
ALTER TABLE IF EXISTS withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own withdrawals" ON withdrawal_requests;
DROP POLICY IF EXISTS "Users can request withdrawals" ON withdrawal_requests;
DROP POLICY IF EXISTS "Service role only for withdrawal update" ON withdrawal_requests;

CREATE POLICY "Users can view own withdrawals" ON withdrawal_requests
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can request withdrawals" ON withdrawal_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role only for withdrawal update" ON withdrawal_requests
  FOR UPDATE USING (false);

-- =============================================================================
-- 16. subscriptions - HAS POLICIES BUT RLS DISABLED!
-- =============================================================================
ALTER TABLE IF EXISTS subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies already exist, just enabling RLS

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE admin_actions IS 'RLS enabled - admin only access';
COMMENT ON TABLE ai_usage IS 'RLS enabled - user can view own usage';
COMMENT ON TABLE badges IS 'RLS enabled - public read';
COMMENT ON TABLE boost_pricing IS 'RLS enabled - public read';
COMMENT ON TABLE case_followers IS 'RLS enabled - users can follow/unfollow';
COMMENT ON TABLE challenges IS 'RLS enabled - public read';
COMMENT ON TABLE comments IS 'RLS enabled - public read, own edit/delete';
COMMENT ON TABLE featured_cases IS 'RLS enabled - public read, admin manage';
COMMENT ON TABLE forum_posts IS 'RLS enabled - public read, own edit/delete';
COMMENT ON TABLE forum_threads IS 'RLS enabled - public read, own edit/delete';
COMMENT ON TABLE kyc_verification IS 'RLS enabled - own view, admin verify';
COMMENT ON TABLE moderation_flags IS 'RLS enabled - user flag, admin review';
COMMENT ON TABLE stripe_accounts IS 'RLS enabled - service role only (no user_id)';
COMMENT ON TABLE transaction_limits IS 'RLS enabled - own view only';
COMMENT ON TABLE withdrawal_requests IS 'RLS enabled - own view/create';
COMMENT ON TABLE subscriptions IS 'RLS enabled - existing policies active';
