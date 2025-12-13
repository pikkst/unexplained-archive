-- Create forum_post_likes table to track who liked what
CREATE TABLE IF NOT EXISTS forum_post_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate likes
  UNIQUE(post_id, user_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_forum_post_likes_post ON forum_post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_post_likes_user ON forum_post_likes(user_id);

-- Enable RLS
ALTER TABLE forum_post_likes ENABLE ROW LEVEL SECURITY;

-- Policies
-- Anyone can view likes
CREATE POLICY "Anyone can view likes" ON forum_post_likes
  FOR SELECT
  USING (true);

-- Users can like posts
CREATE POLICY "Users can like posts" ON forum_post_likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can unlike posts
CREATE POLICY "Users can unlike posts" ON forum_post_likes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON forum_post_likes TO authenticated;
GRANT SELECT ON forum_post_likes TO anon;
