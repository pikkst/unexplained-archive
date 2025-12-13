-- =============================================
-- FIX PERFORMANCE ISSUES (RLS & INDEXES) - FIXED
-- =============================================

-- 1. DROP DUPLICATE INDEXES
-- Table: public.transactions
DROP INDEX IF EXISTS idx_transactions_created; -- Duplicate of idx_transactions_created_at
DROP INDEX IF EXISTS idx_transactions_stripe_intent; -- Duplicate of idx_transactions_stripe_payment_intent

-- 2. OPTIMIZE RLS POLICIES
-- Replacing auth.uid() with (select auth.uid()) to prevent re-evaluation for each row.
-- Also qualifying same-table column references (table.column) to avoid ambiguous name resolution.

-- Table: admin_actions
DROP POLICY IF EXISTS "Admins can view all admin actions" ON admin_actions;
DROP POLICY IF EXISTS "Admins view admin actions" ON admin_actions;
DROP POLICY IF EXISTS "Admins view all admin actions" ON admin_actions; -- Handling potential duplicate names

CREATE POLICY "Admins view admin actions" ON admin_actions
FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
);

-- Table: comments
DROP POLICY IF EXISTS "Authenticated users can create comments" ON comments;
DROP POLICY IF EXISTS "Users can update own comments" ON comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON comments;

CREATE POLICY "Authenticated users can create comments" ON comments
FOR INSERT WITH CHECK ((select auth.uid()) = comments.user_id);

CREATE POLICY "Users can update own comments" ON comments
FOR UPDATE USING ((select auth.uid()) = comments.user_id);

CREATE POLICY "Users can delete own comments" ON comments
FOR DELETE USING (
  (select auth.uid()) = comments.user_id OR
  EXISTS (
    SELECT 1 FROM cases WHERE cases.id = comments.case_id AND cases.user_id = (select auth.uid())
  )
);

-- Table: withdrawal_requests
DROP POLICY IF EXISTS "Users can view own withdrawal requests" ON withdrawal_requests;
DROP POLICY IF EXISTS "Users can view their own withdrawal requests" ON withdrawal_requests;
DROP POLICY IF EXISTS "Users can create withdrawal requests" ON withdrawal_requests;
DROP POLICY IF EXISTS "Users can create their own withdrawal requests" ON withdrawal_requests;
DROP POLICY IF EXISTS "Admins can update withdrawal requests" ON withdrawal_requests;

CREATE POLICY "Users can view own withdrawal requests" ON withdrawal_requests
FOR SELECT USING ((select auth.uid()) = withdrawal_requests.user_id);

CREATE POLICY "Users can create withdrawal requests" ON withdrawal_requests
FOR INSERT WITH CHECK ((select auth.uid()) = withdrawal_requests.user_id);

CREATE POLICY "Admins can update withdrawal requests" ON withdrawal_requests
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
);

-- Table: investigators
DROP POLICY IF EXISTS "Users can apply to become investigators" ON investigators;
DROP POLICY IF EXISTS "Users can update own investigator profile" ON investigators;

CREATE POLICY "Users can apply to become investigators" ON investigators
FOR INSERT WITH CHECK ((select auth.uid()) = investigators.user_id);

CREATE POLICY "Users can update own investigator profile" ON investigators
FOR UPDATE USING ((select auth.uid()) = investigators.user_id);

-- Table: donations
DROP POLICY IF EXISTS "Donations are viewable by involved parties" ON donations;
DROP POLICY IF EXISTS "Users can create donations" ON donations;

CREATE POLICY "Donations are viewable by involved parties" ON donations
FOR SELECT USING (
  (select auth.uid()) = donations.from_user_id OR
  EXISTS (
    SELECT 1 FROM investigators
    WHERE investigators.id = donations.to_investigator_id
      AND investigators.user_id = (select auth.uid())
  )
);

CREATE POLICY "Users can create donations" ON donations
FOR INSERT WITH CHECK ((select auth.uid()) = donations.from_user_id);

-- Table: follows
DROP POLICY IF EXISTS "Users can follow others" ON follows;
DROP POLICY IF EXISTS "Users can unfollow" ON follows;

CREATE POLICY "Users can follow others" ON follows
FOR INSERT WITH CHECK ((select auth.uid()) = follows.follower_id);

CREATE POLICY "Users can unfollow" ON follows
FOR DELETE USING ((select auth.uid()) = follows.follower_id);

-- Table: transaction_limits
DROP POLICY IF EXISTS "Users can view own transaction limits" ON transaction_limits;
DROP POLICY IF EXISTS "Users can view their own transaction limits" ON transaction_limits;
DROP POLICY IF EXISTS "Admins can view all transaction limits" ON transaction_limits;
DROP POLICY IF EXISTS "Users can insert own transaction limits" ON transaction_limits;
DROP POLICY IF EXISTS "Admins can update transaction limits" ON transaction_limits;

CREATE POLICY "Users can view own transaction limits" ON transaction_limits
FOR SELECT USING ((select auth.uid()) = transaction_limits.user_id);

CREATE POLICY "Admins can view all transaction limits" ON transaction_limits
FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
);

CREATE POLICY "Users can insert own transaction limits" ON transaction_limits
FOR INSERT WITH CHECK ((select auth.uid()) = transaction_limits.user_id);

CREATE POLICY "Admins can update transaction limits" ON transaction_limits
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
);

-- Table: transactions
DROP POLICY IF EXISTS "Users view own transactions" ON transactions;
DROP POLICY IF EXISTS "transactions_insert_policy" ON transactions;
DROP POLICY IF EXISTS "transactions_select_policy" ON transactions;
DROP POLICY IF EXISTS "Admins view all transactions" ON transactions;

CREATE POLICY "Users view own transactions" ON transactions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM wallets
    WHERE wallets.id = transactions.from_wallet_id
      AND wallets.user_id = (select auth.uid())
  )
  OR
  EXISTS (
    SELECT 1 FROM wallets
    WHERE wallets.id = transactions.to_wallet_id
      AND wallets.user_id = (select auth.uid())
  )
);

CREATE POLICY "transactions_insert_policy" ON transactions
FOR INSERT WITH CHECK (
  -- Ensure user owns the sender wallet
  EXISTS (
    SELECT 1 FROM wallets
    WHERE wallets.id = transactions.from_wallet_id
      AND wallets.user_id = (select auth.uid())
  )
);

CREATE POLICY "Admins view all transactions" ON transactions
FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
);

-- Table: subscriptions
DROP POLICY IF EXISTS "Users view own subscriptions" ON subscriptions;

CREATE POLICY "Users view own subscriptions" ON subscriptions
FOR SELECT USING ((select auth.uid()) = subscriptions.user_id);

-- Table: ai_usage
DROP POLICY IF EXISTS "Users view own ai usage" ON ai_usage;
DROP POLICY IF EXISTS "Users can view own translation usage" ON ai_usage;
DROP POLICY IF EXISTS "Users can insert own translation usage" ON ai_usage;
DROP POLICY IF EXISTS "Admins can view all translation usage" ON ai_usage;

CREATE POLICY "Users view own ai usage" ON ai_usage
FOR SELECT USING ((select auth.uid()) = ai_usage.user_id);

CREATE POLICY "Users can insert own translation usage" ON ai_usage
FOR INSERT WITH CHECK ((select auth.uid()) = ai_usage.user_id);

CREATE POLICY "Admins can view all translation usage" ON ai_usage
FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
);

-- Table: kyc_verification
DROP POLICY IF EXISTS "Users view own kyc" ON kyc_verification;

CREATE POLICY "Users view own kyc" ON kyc_verification
FOR SELECT USING ((select auth.uid()) = kyc_verification.user_id);

-- Table: referrals
DROP POLICY IF EXISTS "Users view own referrals" ON referrals;

CREATE POLICY "Users view own referrals" ON referrals
FOR SELECT USING (
  (select auth.uid()) = referrals.referrer_id OR (select auth.uid()) = referrals.referee_id
);

-- Table: moderation_flags
DROP POLICY IF EXISTS "Admins view moderation flags" ON moderation_flags;

CREATE POLICY "Admins view moderation flags" ON moderation_flags
FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
);

-- Table: user_bans
DROP POLICY IF EXISTS "Admins manage bans" ON user_bans;

CREATE POLICY "Admins manage bans" ON user_bans
FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
);

-- Table: user_challenges
DROP POLICY IF EXISTS "Users view own challenges" ON user_challenges;
DROP POLICY IF EXISTS "Users update own challenges" ON user_challenges;
DROP POLICY IF EXISTS "Admins view all user challenges" ON user_challenges;

CREATE POLICY "Users view own challenges" ON user_challenges
FOR SELECT USING ((select auth.uid()) = user_challenges.user_id);

CREATE POLICY "Users update own challenges" ON user_challenges
FOR UPDATE USING ((select auth.uid()) = user_challenges.user_id);

CREATE POLICY "Admins view all user challenges" ON user_challenges
FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
);

-- Table: messages
DROP POLICY IF EXISTS "messages_view_policy" ON messages;
DROP POLICY IF EXISTS "messages_insert_policy" ON messages;

CREATE POLICY "messages_view_policy" ON messages
FOR SELECT USING (
  (select auth.uid()) = messages.sender_id OR (select auth.uid()) = messages.recipient_id
);

CREATE POLICY "messages_insert_policy" ON messages
FOR INSERT WITH CHECK (
  (select auth.uid()) = messages.sender_id
);

-- Table: notifications
DROP POLICY IF EXISTS "notifications_view_policy" ON notifications;

CREATE POLICY "notifications_view_policy" ON notifications
FOR SELECT USING (
  (select auth.uid()) = notifications.user_id
);

-- Table: case_team_members
DROP POLICY IF EXISTS "team_members_view_policy" ON case_team_members;

CREATE POLICY "team_members_view_policy" ON case_team_members
FOR SELECT USING (
  (select auth.uid()) = case_team_members.investigator_id OR
  EXISTS (SELECT 1 FROM cases WHERE cases.id = case_team_members.case_id AND cases.user_id = (select auth.uid()))
);

-- Table: team_invitations
DROP POLICY IF EXISTS "invitations_view_policy" ON team_invitations;

CREATE POLICY "invitations_view_policy" ON team_invitations
FOR SELECT USING (
  (select auth.uid()) = team_invitations.to_investigator_id OR
  (select auth.uid()) = team_invitations.from_investigator_id OR
  EXISTS (
    SELECT 1 FROM cases
    WHERE cases.id = team_invitations.case_id
      AND (cases.user_id = (select auth.uid()) OR cases.team_leader_id = (select auth.uid()))
  )
);

-- Table: profiles
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can insert own profile" ON profiles
FOR INSERT WITH CHECK ((select auth.uid()) = profiles.id);

CREATE POLICY "Users can update own profile" ON profiles
FOR UPDATE USING ((select auth.uid()) = profiles.id);

-- Table: analytics_events
DROP POLICY IF EXISTS "Admins can view all analytics" ON analytics_events;

CREATE POLICY "Admins can view all analytics" ON analytics_events
FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
);

-- Table: analytics_daily_stats
DROP POLICY IF EXISTS "Admins can view daily stats" ON analytics_daily_stats;

CREATE POLICY "Admins can view daily stats" ON analytics_daily_stats
FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
);

-- Table: blog_articles
DROP POLICY IF EXISTS "Anyone can view published articles" ON blog_articles;
DROP POLICY IF EXISTS "Admins can insert articles" ON blog_articles;
DROP POLICY IF EXISTS "Admins can update articles" ON blog_articles;
DROP POLICY IF EXISTS "Admins can delete articles" ON blog_articles;

CREATE POLICY "Anyone can view published articles" ON blog_articles
FOR SELECT USING (blog_articles.published = true); -- public

CREATE POLICY "Admins can insert articles" ON blog_articles
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
);

CREATE POLICY "Admins can update articles" ON blog_articles
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
);

CREATE POLICY "Admins can delete articles" ON blog_articles
FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
);

-- Table: blog_comments
DROP POLICY IF EXISTS "Authenticated users can create comments" ON blog_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON blog_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON blog_comments;

CREATE POLICY "Authenticated users can create comments" ON blog_comments
FOR INSERT WITH CHECK ((select auth.uid()) = blog_comments.user_id);

CREATE POLICY "Users can update their own comments" ON blog_comments
FOR UPDATE USING ((select auth.uid()) = blog_comments.user_id);

CREATE POLICY "Users can delete their own comments" ON blog_comments
FOR DELETE USING ((select auth.uid()) = blog_comments.user_id);

-- Table: seo_rankings
DROP POLICY IF EXISTS "Admins can manage SEO rankings" ON seo_rankings;

CREATE POLICY "Admins can manage SEO rankings" ON seo_rankings
FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
);

-- Table: platform_revenue
DROP POLICY IF EXISTS "admins_view_platform_revenue" ON platform_revenue;

CREATE POLICY "admins_view_platform_revenue" ON platform_revenue
FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
);

-- Table: wallets
DROP POLICY IF EXISTS "wallets_select_policy" ON wallets;
DROP POLICY IF EXISTS "wallets_update_policy" ON wallets;
DROP POLICY IF EXISTS "wallets_delete_policy" ON wallets;
DROP POLICY IF EXISTS "Admins view all wallets" ON wallets;

CREATE POLICY "wallets_select_policy" ON wallets
FOR SELECT USING ((select auth.uid()) = wallets.user_id);

CREATE POLICY "wallets_update_policy" ON wallets
FOR UPDATE USING ((select auth.uid()) = wallets.user_id);

CREATE POLICY "wallets_delete_policy" ON wallets
FOR DELETE USING ((select auth.uid()) = wallets.user_id);

CREATE POLICY "Admins view all wallets" ON wallets
FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
);

-- Table: forum_threads
DROP POLICY IF EXISTS "Authenticated users can create forum threads" ON forum_threads;
DROP POLICY IF EXISTS "Users can update own forum threads" ON forum_threads;
DROP POLICY IF EXISTS "Users can delete own forum threads" ON forum_threads;

CREATE POLICY "Authenticated users can create forum threads" ON forum_threads
FOR INSERT WITH CHECK ((select auth.uid()) = forum_threads.user_id);

CREATE POLICY "Users can update own forum threads" ON forum_threads
FOR UPDATE USING ((select auth.uid()) = forum_threads.user_id);

CREATE POLICY "Users can delete own forum threads" ON forum_threads
FOR DELETE USING ((select auth.uid()) = forum_threads.user_id);

-- Table: forum_comments
DROP POLICY IF EXISTS "Authenticated users can create forum comments" ON forum_comments;
DROP POLICY IF EXISTS "Users can update own forum comments" ON forum_comments;
DROP POLICY IF EXISTS "Users can delete own forum comments" ON forum_comments;

CREATE POLICY "Authenticated users can create forum comments" ON forum_comments
FOR INSERT WITH CHECK ((select auth.uid()) = forum_comments.user_id);

CREATE POLICY "Users can update own forum comments" ON forum_comments
FOR UPDATE USING ((select auth.uid()) = forum_comments.user_id);

CREATE POLICY "Users can delete own forum comments" ON forum_comments
FOR DELETE USING ((select auth.uid()) = forum_comments.user_id);

-- Table: background_checks
DROP POLICY IF EXISTS "Users can view own checks" ON background_checks;
DROP POLICY IF EXISTS "Admins can view all checks" ON background_checks;
DROP POLICY IF EXISTS "Users can request checks" ON background_checks;
DROP POLICY IF EXISTS "Admins can update checks" ON background_checks;

CREATE POLICY "Users can view own checks" ON background_checks
FOR SELECT USING ((select auth.uid()) = background_checks.investigator_id); -- table uses investigator_id -> profiles.id

CREATE POLICY "Admins can view all checks" ON background_checks
FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
);

CREATE POLICY "Users can request checks" ON background_checks
FOR INSERT WITH CHECK ((select auth.uid()) = background_checks.investigator_id);

CREATE POLICY "Admins can update checks" ON background_checks
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
);

-- Table: cases
DROP POLICY IF EXISTS "Authenticated users can create cases" ON cases;
DROP POLICY IF EXISTS "Users can update own cases" ON cases;
DROP POLICY IF EXISTS "Users can delete own cases" ON cases;

CREATE POLICY "Authenticated users can create cases" ON cases
FOR INSERT WITH CHECK ((select auth.uid()) = cases.user_id);

CREATE POLICY "Users can update own cases" ON cases
FOR UPDATE USING ((select auth.uid()) = cases.user_id);

CREATE POLICY "Users can delete own cases" ON cases
FOR DELETE USING ((select auth.uid()) = cases.user_id);

-- Table: case_followers
DROP POLICY IF EXISTS "follow_cases" ON case_followers;
DROP POLICY IF EXISTS "unfollow_cases" ON case_followers;

-- FIX: table case_followers has column "user_id", not "follower_id"
CREATE POLICY "follow_cases" ON case_followers
FOR INSERT WITH CHECK ((select auth.uid()) = case_followers.user_id);

CREATE POLICY "unfollow_cases" ON case_followers
FOR DELETE USING ((select auth.uid()) = case_followers.user_id);

-- Table: challenges
DROP POLICY IF EXISTS "Admins manage challenges" ON challenges;

CREATE POLICY "Admins manage challenges" ON challenges
FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
);

-- Table: investigator_applications
DROP POLICY IF EXISTS "users_insert_own_application" ON investigator_applications;
DROP POLICY IF EXISTS "users_select_own_application" ON investigator_applications;
DROP POLICY IF EXISTS "admins_select_all_applications" ON investigator_applications;
DROP POLICY IF EXISTS "admins_update_applications" ON investigator_applications;

CREATE POLICY "users_insert_own_application" ON investigator_applications
FOR INSERT WITH CHECK ((select auth.uid()) = investigator_applications.user_id);

CREATE POLICY "users_select_own_application" ON investigator_applications
FOR SELECT USING ((select auth.uid()) = investigator_applications.user_id);

CREATE POLICY "admins_select_all_applications" ON investigator_applications
FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
);

CREATE POLICY "admins_update_applications" ON investigator_applications
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
);

-- Table: featured_cases
DROP POLICY IF EXISTS "view_own_featured_cases" ON featured_cases;
DROP POLICY IF EXISTS "create_own_featured_cases" ON featured_cases;

CREATE POLICY "view_own_featured_cases" ON featured_cases
FOR SELECT USING (
  EXISTS (SELECT 1 FROM cases WHERE cases.id = featured_cases.case_id AND cases.user_id = (select auth.uid()))
);

CREATE POLICY "create_own_featured_cases" ON featured_cases
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM cases WHERE cases.id = featured_cases.case_id AND cases.user_id = (select auth.uid()))
);

-- Table: stripe_accounts
DROP POLICY IF EXISTS "Admins manage stripe accounts" ON stripe_accounts;

CREATE POLICY "Admins manage stripe accounts" ON stripe_accounts
FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
);

-- Table: internal_transfers
DROP POLICY IF EXISTS "Admins manage internal transfers" ON internal_transfers;

CREATE POLICY "Admins manage internal transfers" ON internal_transfers
FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
);