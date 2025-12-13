-- ============================================================================
-- PHASE 1: DATABASE SETUP
-- ============================================================================
-- Run these commands in Supabase SQL Editor
-- Copy-paste each section and execute

-- ============================================================================
-- 1. ADD DIFFICULTY LEVEL TO CASES TABLE
-- ============================================================================

ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS difficulty_level INT DEFAULT 3;

-- Set some default difficulties based on category
UPDATE cases 
SET difficulty_level = CASE 
  WHEN category = 'UFO' THEN 4
  WHEN category = 'Cryptid' THEN 3
  WHEN category = 'Paranormal' THEN 3
  WHEN category = 'Supernatural' THEN 5
  ELSE 3
END 
WHERE difficulty_level = 3;

-- ============================================================================
-- 2. CREATE CASE DIFFICULTY VOTES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS case_difficulty_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  difficulty_rating INT CHECK (difficulty_rating >= 1 AND difficulty_rating <= 5),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(case_id, user_id)
);

-- Add RLS policy for case_difficulty_votes
ALTER TABLE case_difficulty_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see all difficulty votes" ON case_difficulty_votes
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own difficulty votes" ON case_difficulty_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own difficulty votes" ON case_difficulty_votes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own difficulty votes" ON case_difficulty_votes
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 3. CREATE VIEW FOR CASE DIFFICULTY AVERAGES
-- ============================================================================

CREATE OR REPLACE VIEW case_difficulty_avg AS
SELECT 
  case_id,
  ROUND(AVG(difficulty_rating)::numeric, 1) as avg_difficulty,
  COUNT(*) as vote_count,
  MAX(updated_at) as last_updated
FROM case_difficulty_votes
GROUP BY case_id;

-- ============================================================================
-- 4. VERIFY EXISTING TABLES
-- ============================================================================

-- Check user_follows
SELECT COUNT(*) as follow_count FROM user_follows;

-- Check user_badges
SELECT COUNT(*) as badge_count FROM user_badges;

-- Check user_challenges
SELECT COUNT(*) as challenge_count FROM user_challenges;

-- Check profiles has reputation
SELECT COUNT(*) as profiles_with_reputation 
FROM profiles 
WHERE reputation IS NOT NULL;

-- ============================================================================
-- 5. OPTIONAL: ADD SAMPLE DATA FOR TESTING
-- ============================================================================

-- If you want to test with some difficulty votes
-- Uncomment to add sample data:

/*
INSERT INTO case_difficulty_votes (case_id, user_id, difficulty_rating)
SELECT 
  c.id,
  (SELECT id FROM auth.users LIMIT 1),
  FLOOR(RANDOM() * 5 + 1)::INT
FROM cases c
LIMIT 10
ON CONFLICT (case_id, user_id) DO NOTHING;
*/

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- ✅ Added difficulty_level column to cases
-- ✅ Created case_difficulty_votes table with RLS policies
-- ✅ Created view for average difficulty calculations
-- ✅ Verified existing tables for user data

-- Next: Frontend implementation
