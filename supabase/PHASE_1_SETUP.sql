-- PHASE 1 DATABASE SETUP SCRIPT
-- Run these commands in Supabase SQL Editor
-- Date: December 13, 2025

-- ============================================
-- 1. TASK 3: Case Difficulty Ratings
-- ============================================

-- Add difficulty_level column to cases (if not exists)
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS difficulty_level INT DEFAULT 3;

-- Create case_difficulty_votes table for user votes
CREATE TABLE IF NOT EXISTS case_difficulty_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  difficulty_rating INT NOT NULL CHECK (difficulty_rating >= 1 AND difficulty_rating <= 5),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(case_id, user_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_case_difficulty_votes_case_id 
ON case_difficulty_votes(case_id);

CREATE INDEX IF NOT EXISTS idx_case_difficulty_votes_user_id 
ON case_difficulty_votes(user_id);

-- Create view for average difficulty per case
CREATE OR REPLACE VIEW case_difficulty_avg AS
SELECT 
  case_id,
  ROUND(AVG(difficulty_rating)::numeric, 1) as avg_difficulty,
  COUNT(*) as vote_count,
  MIN(difficulty_rating) as min_difficulty,
  MAX(difficulty_rating) as max_difficulty
FROM case_difficulty_votes
GROUP BY case_id;

-- Enable RLS on case_difficulty_votes
ALTER TABLE case_difficulty_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view all difficulty votes
CREATE POLICY "Anyone can view difficulty votes" ON case_difficulty_votes
  FOR SELECT
  USING (true);

-- RLS Policy: Users can only vote on their own votes
CREATE POLICY "Users can manage their own difficulty votes" ON case_difficulty_votes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 2. VERIFY EXISTING TABLES
-- ============================================

-- Verify user_follows table exists
-- If not, create it:
CREATE TABLE IF NOT EXISTS user_follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower 
ON user_follows(follower_id);

CREATE INDEX IF NOT EXISTS idx_user_follows_following 
ON user_follows(following_id);

ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view follows" ON user_follows
  FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their own follows" ON user_follows
  FOR ALL
  USING (auth.uid() = follower_id)
  WITH CHECK (auth.uid() = follower_id);

-- ============================================
-- 3. VERIFY USER_BADGES TABLE
-- ============================================

-- Verify user_badges exists
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user_id 
ON user_badges(user_id);

-- Create badges table if not exists
CREATE TABLE IF NOT EXISTS badges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '🏆',
  category TEXT, -- 'achievement', 'milestone', 'skill'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add sample badges
INSERT INTO badges (id, name, slug, description, icon, category) VALUES
  ('first-case', 'Case Creator', 'first-case', 'Submitted your first case', '📝', 'milestone'),
  ('case-solver', 'Case Solver', 'case-solver', 'Resolved your first case as investigator', '🔍', 'milestone'),
  ('poll-creator', 'Poll Creator', 'poll-creator', 'Created your first poll', '📊', 'achievement'),
  ('influencer', 'Influencer', 'influencer', 'Got 100+ votes on a poll', '⭐', 'achievement'),
  ('team-builder', 'Team Builder', 'team-builder', 'Created an investigation team', '👥', 'achievement'),
  ('evidence-expert', 'Evidence Expert', 'evidence-expert', 'Collected comprehensive evidence', '🔬', 'skill'),
  ('forum-expert', 'Forum Expert', 'forum-expert', 'Posted 50+ forum messages', '💬', 'skill'),
  ('investigator-badge', 'Verified Investigator', 'investigator-badge', 'Approved as professional investigator', '👮', 'skill')
ON CONFLICT DO NOTHING;

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view badges" ON user_badges
  FOR SELECT
  USING (true);

-- ============================================
-- 4. VERIFY USER_CHALLENGES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS user_challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id TEXT NOT NULL,
  progress INT DEFAULT 0,
  completed_at TIMESTAMPTZ,
  reward_points INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, challenge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_challenges_user_id 
ON user_challenges(user_id);

-- Create challenges table
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT, -- 'daily', 'weekly', 'milestone'
  target INT, -- How many days/actions needed
  reward_points INT,
  icon TEXT DEFAULT '🎯'
);

-- Add sample challenges
INSERT INTO challenges (id, name, description, type, target, reward_points, icon) VALUES
  ('login-streak', 'Login Streak', 'Log in for 7 consecutive days', 'daily', 7, 50, '🔥'),
  ('comment-milestone', 'Comment Master', 'Post 50 comments', 'milestone', 50, 100, '💬'),
  ('case-explorer', 'Case Explorer', 'View 20 different cases', 'milestone', 20, 75, '🔍'),
  ('forum-contributor', 'Forum Contributor', 'Create 5 forum topics', 'milestone', 5, 60, '📢')
ON CONFLICT DO NOTHING;

ALTER TABLE user_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own challenges" ON user_challenges
  FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Users can update their own challenges" ON user_challenges
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 5. VERIFY PROFILES TABLE HAS REPUTATION
-- ============================================

-- Add reputation column if missing
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS reputation INT DEFAULT 0;

-- ============================================
-- 6. TEST QUERIES (Optional)
-- ============================================

-- Test 1: Get a user's badges
-- SELECT 
--   ub.id,
--   ub.badge_id,
--   b.name,
--   b.icon,
--   ub.earned_at
-- FROM user_badges ub
-- LEFT JOIN badges b ON b.id = ub.badge_id
-- WHERE ub.user_id = 'YOUR_USER_ID'
-- ORDER BY ub.earned_at DESC;

-- Test 2: Get follow count
-- SELECT 
--   (SELECT COUNT(*) FROM user_follows WHERE follower_id = 'USER_ID') as following_count,
--   (SELECT COUNT(*) FROM user_follows WHERE following_id = 'USER_ID') as followers_count;

-- Test 3: Get case difficulty average
-- SELECT * FROM case_difficulty_avg 
-- WHERE case_id = 'YOUR_CASE_ID';

-- Test 4: Get user's login streak
-- SELECT * FROM user_challenges
-- WHERE user_id = 'YOUR_USER_ID'
-- AND challenge_id = 'login-streak';
