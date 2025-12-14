-- ============================================
-- CREATE BADGES & CHALLENGES TABLES
-- Fix 404 errors: user_badges, user_challenges
-- Date: December 14, 2025
-- ============================================

-- ============================================
-- 1. CREATE BADGES LOOKUP TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS badges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '🏆',
  category TEXT, -- 'achievement', 'milestone', 'skill'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add sample badges (safe to run multiple times)
INSERT INTO badges (id, name, slug, description, icon, category) VALUES
  ('first-case', 'Case Creator', 'first-case', 'Submitted your first case', '📝', 'milestone'),
  ('case-solver', 'Case Solver', 'case-solver', 'Resolved your first case as investigator', '🔍', 'milestone'),
  ('poll-creator', 'Poll Creator', 'poll-creator', 'Created your first poll', '📊', 'achievement'),
  ('influencer', 'Influencer', 'influencer', 'Got 100+ votes on a poll', '⭐', 'achievement'),
  ('team-builder', 'Team Builder', 'team-builder', 'Created an investigation team', '👥', 'achievement'),
  ('evidence-expert', 'Evidence Expert', 'evidence-expert', 'Collected comprehensive evidence', '🔬', 'skill'),
  ('forum-expert', 'Forum Expert', 'forum-expert', 'Posted 50+ forum messages', '💬', 'skill'),
  ('investigator-badge', 'Verified Investigator', 'investigator-badge', 'Approved as professional investigator', '👮', 'skill')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 2. CREATE USER_BADGES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id 
ON user_badges(user_id);

CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id 
ON user_badges(badge_id);

-- Enable RLS
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can view badges
CREATE POLICY "Anyone can view badges" ON user_badges
  FOR SELECT
  USING (true);

-- RLS Policy: Only system can insert badges (admin role)
-- Users cannot give themselves badges
CREATE POLICY "Only admins can manage badges" ON user_badges
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- 3. CREATE CHALLENGES LOOKUP TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT, -- 'daily', 'weekly', 'milestone'
  target INT, -- How many days/actions needed
  reward_points INT,
  icon TEXT DEFAULT '🎯'
);

-- Add sample challenges (safe to run multiple times)
INSERT INTO challenges (id, name, description, type, target, reward_points, icon) VALUES
  ('login-streak', 'Login Streak', 'Log in for 7 consecutive days', 'daily', 7, 50, '🔥'),
  ('comment-milestone', 'Comment Master', 'Post 50 comments', 'milestone', 50, 100, '💬'),
  ('case-explorer', 'Case Explorer', 'View 20 different cases', 'milestone', 20, 75, '🔍'),
  ('forum-contributor', 'Forum Contributor', 'Create 5 forum topics', 'milestone', 5, 60, '📢')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. CREATE USER_CHALLENGES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS user_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  progress INT DEFAULT 0,
  completed_at TIMESTAMPTZ,
  reward_points INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, challenge_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_user_challenges_user_id 
ON user_challenges(user_id);

CREATE INDEX IF NOT EXISTS idx_user_challenges_challenge_id 
ON user_challenges(challenge_id);

-- Enable RLS
ALTER TABLE user_challenges ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view all challenges (for leaderboards)
CREATE POLICY "Anyone can view challenges" ON user_challenges
  FOR SELECT
  USING (true);

-- RLS Policy: Users can update their own challenges
CREATE POLICY "Users can update their own challenges" ON user_challenges
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 5. VERIFICATION QUERIES
-- ============================================

-- Check if tables exist
SELECT 
  'badges' as table_name, 
  COUNT(*) as row_count 
FROM badges
UNION ALL
SELECT 
  'user_badges' as table_name, 
  COUNT(*) as row_count 
FROM user_badges
UNION ALL
SELECT 
  'challenges' as table_name, 
  COUNT(*) as row_count 
FROM challenges
UNION ALL
SELECT 
  'user_challenges' as table_name, 
  COUNT(*) as row_count 
FROM user_challenges;

-- ============================================
-- DONE!
-- ============================================

-- Now you can uncomment the code in:
-- - src/components/UserProfile.tsx
-- - src/components/UserStats.tsx
