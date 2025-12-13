-- Create user_follows table for following other users
CREATE TABLE IF NOT EXISTS user_follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate follows
  UNIQUE(follower_id, following_id),
  
  -- Can't follow yourself
  CHECK (follower_id != following_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);

-- Enable RLS
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

-- Policies
-- Anyone can view follows
CREATE POLICY "Anyone can view follows" ON user_follows
  FOR SELECT
  USING (true);

-- Users can follow others
CREATE POLICY "Users can follow others" ON user_follows
  FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

-- Users can unfollow
CREATE POLICY "Users can unfollow" ON user_follows
  FOR DELETE
  USING (auth.uid() = follower_id);

-- Grant permissions
GRANT ALL ON user_follows TO authenticated;
GRANT SELECT ON user_follows TO anon;
