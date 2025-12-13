-- Create featured_cases and case_followers tables
-- Run this in Supabase SQL Editor

-- =============================================
-- DROP EXISTING TABLES AND POLICIES (clean slate)
-- =============================================
DROP TABLE IF EXISTS featured_cases CASCADE;
DROP TABLE IF EXISTS case_followers CASCADE;

-- =============================================
-- FEATURED CASES TABLE (for boost feature)
-- =============================================
CREATE TABLE featured_cases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired')),
  featured_until TIMESTAMPTZ NOT NULL,
  boost_level INTEGER DEFAULT 1 CHECK (boost_level BETWEEN 1 AND 3),
  payment_amount NUMERIC(10, 2) NOT NULL,
  payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for faster queries
CREATE INDEX idx_featured_cases_case_id ON featured_cases(case_id);
CREATE INDEX idx_featured_cases_status ON featured_cases(status);
CREATE INDEX idx_featured_cases_featured_until ON featured_cases(featured_until);

-- =============================================
-- CASE FOLLOWERS TABLE (for following feature)
-- =============================================
CREATE TABLE case_followers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  guest_email TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  verification_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(case_id, user_id)
);

-- Index for faster queries
CREATE INDEX idx_case_followers_case_id ON case_followers(case_id);
CREATE INDEX idx_case_followers_user_id ON case_followers(user_id);
CREATE INDEX idx_case_followers_guest_email ON case_followers(guest_email);

-- =============================================
-- RLS POLICIES
-- =============================================

-- Featured Cases Policies
ALTER TABLE featured_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_active_featured_cases"
ON featured_cases FOR SELECT
USING (status = 'active' AND featured_until > now());

CREATE POLICY "create_own_featured_cases"
ON featured_cases FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "view_own_featured_cases"
ON featured_cases FOR SELECT
USING (auth.uid() = user_id);

-- Case Followers Policies
ALTER TABLE case_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_all_followers"
ON case_followers FOR SELECT
USING (true);

CREATE POLICY "follow_cases"
ON case_followers FOR INSERT
WITH CHECK (auth.uid() = user_id OR guest_email IS NOT NULL);

CREATE POLICY "unfollow_cases"
ON case_followers FOR DELETE
USING (auth.uid() = user_id);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to get follower count
CREATE OR REPLACE FUNCTION get_follower_count(p_case_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM case_followers
    WHERE case_id = p_case_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is following a case
CREATE OR REPLACE FUNCTION is_following_case(p_case_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM case_followers
    WHERE case_id = p_case_id
    AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if case is boosted
CREATE OR REPLACE FUNCTION is_case_boosted(p_case_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM featured_cases
    WHERE case_id = p_case_id
    AND status = 'active'
    AND featured_until > now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify tables are created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('featured_cases', 'case_followers');
