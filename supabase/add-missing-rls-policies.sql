-- Add missing RLS policies for critical tables
-- SECURITY FIX: Prevents unauthorized access to sensitive data
-- IDEMPOTENT: Safe to run multiple times

-- =============================================================================
-- TABLE: case_team_members
-- =============================================================================
ALTER TABLE IF EXISTS case_team_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view team members" ON case_team_members;
DROP POLICY IF EXISTS "Team leaders can add members" ON case_team_members;
DROP POLICY IF EXISTS "Team leaders can update members" ON case_team_members;

-- Anyone can view team members (public info)
CREATE POLICY "Anyone can view team members" ON case_team_members
  FOR SELECT USING (true);

-- Only team leaders can add members
CREATE POLICY "Team leaders can add members" ON case_team_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM case_team_members ctm
      WHERE ctm.case_id = case_team_members.case_id
      AND ctm.investigator_id = auth.uid()
      AND ctm.role = 'leader'
      AND ctm.status = 'active'
    )
  );

-- Team leaders can update team members
CREATE POLICY "Team leaders can update members" ON case_team_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM case_team_members ctm
      WHERE ctm.case_id = case_team_members.case_id
      AND ctm.investigator_id = auth.uid()
      AND ctm.role = 'leader'
      AND ctm.status = 'active'
    )
  );

-- =============================================================================
-- TABLE: user_follows
-- =============================================================================
ALTER TABLE IF EXISTS user_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own follows" ON user_follows;
DROP POLICY IF EXISTS "Users can follow others" ON user_follows;
DROP POLICY IF EXISTS "Users can unfollow" ON user_follows;
DROP POLICY IF EXISTS "Anyone can view follows" ON user_follows;

-- Users can view their own follows
CREATE POLICY "Users can view their own follows" ON user_follows
  FOR SELECT USING (follower_id = auth.uid() OR following_id = auth.uid());

-- Users can follow others
CREATE POLICY "Users can follow others" ON user_follows
  FOR INSERT WITH CHECK (follower_id = auth.uid());

-- Users can unfollow
CREATE POLICY "Users can unfollow" ON user_follows
  FOR DELETE USING (follower_id = auth.uid());

-- =============================================================================
-- TABLE: user_badges
-- =============================================================================
ALTER TABLE IF EXISTS user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can view badges" ON user_badges;
DROP POLICY IF EXISTS "Service role only for insert" ON user_badges;

-- Everyone can view badges (public achievements)
CREATE POLICY "Everyone can view badges" ON user_badges
  FOR SELECT USING (true);

-- Only system can insert badges (via SECURITY DEFINER functions)
CREATE POLICY "Service role only for insert" ON user_badges
  FOR INSERT WITH CHECK (false); -- Will be done via SECURITY DEFINER functions

-- =============================================================================
-- TABLE: user_challenges
-- =============================================================================
ALTER TABLE IF EXISTS user_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own challenges" ON user_challenges;
DROP POLICY IF EXISTS "Service role only for insert" ON user_challenges;
DROP POLICY IF EXISTS "Service role only for update" ON user_challenges;

-- Users can view their own challenges
CREATE POLICY "Users can view own challenges" ON user_challenges
  FOR SELECT USING (user_id = auth.uid());

-- System manages challenges (via SECURITY DEFINER functions)
CREATE POLICY "Service role only for insert" ON user_challenges
  FOR INSERT WITH CHECK (false);

CREATE POLICY "Service role only for update" ON user_challenges
  FOR UPDATE USING (false);

-- =============================================================================
-- TABLE: withdrawal_requests
-- =============================================================================
ALTER TABLE IF EXISTS withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own withdrawals" ON withdrawal_requests;
DROP POLICY IF EXISTS "Users can request withdrawals" ON withdrawal_requests;
DROP POLICY IF EXISTS "Service role only for withdrawal update" ON withdrawal_requests;

-- Users can view their own withdrawal requests
CREATE POLICY "Users can view own withdrawals" ON withdrawal_requests
  FOR SELECT USING (user_id = auth.uid());

-- Users can create withdrawal requests
CREATE POLICY "Users can request withdrawals" ON withdrawal_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Only system can update withdrawal status
CREATE POLICY "Service role only for withdrawal update" ON withdrawal_requests
  FOR UPDATE USING (false);

-- =============================================================================
-- TABLE: case_notes (from recent addition)
-- =============================================================================
-- Already has RLS from create-case-notes-table.sql ✅

-- =============================================================================
-- TABLE: webhook_events (from recent security fix)
-- =============================================================================
-- Already has RLS from add-webhook-idempotency.sql ✅

-- =============================================================================
-- TABLE: withdrawal_rate_limits (from recent security fix)
-- =============================================================================
-- Already has RLS from add-withdrawal-rate-limiting.sql ✅

COMMENT ON TABLE case_team_members IS 'RLS enabled - team collaboration protected';
COMMENT ON TABLE user_follows IS 'RLS enabled - follow relationships protected';
COMMENT ON TABLE user_badges IS 'RLS enabled - badges publicly visible';
COMMENT ON TABLE user_challenges IS 'RLS enabled - challenges private';
COMMENT ON TABLE withdrawal_requests IS 'RLS enabled - withdrawal data private';
