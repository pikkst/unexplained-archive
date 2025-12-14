-- Create evidence likes table for upvoting comments
CREATE TABLE IF NOT EXISTS evidence_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, comment_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_evidence_likes_user ON evidence_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_likes_comment ON evidence_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_evidence_likes_created ON evidence_likes(created_at DESC);

-- Add vote count column to comments for denormalization (optional but improves performance)
ALTER TABLE comments 
ADD COLUMN IF NOT EXISTS vote_count INTEGER DEFAULT 0;

-- Create index on vote count for sorting
CREATE INDEX IF NOT EXISTS idx_comments_vote_count ON comments(vote_count DESC);

-- Enable Row Level Security
ALTER TABLE evidence_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for evidence_likes
-- Anyone can view likes
CREATE POLICY "Anyone can view evidence likes"
  ON evidence_likes FOR SELECT
  USING (true);

-- Users can like evidence (insert)
CREATE POLICY "Users can like evidence"
  ON evidence_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can unlike their own likes (delete)
CREATE POLICY "Users can unlike their own evidence"
  ON evidence_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update vote counts
CREATE OR REPLACE FUNCTION update_comment_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE comments 
    SET vote_count = vote_count + 1 
    WHERE id = NEW.comment_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE comments 
    SET vote_count = vote_count - 1 
    WHERE id = OLD.comment_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically update vote counts
DROP TRIGGER IF EXISTS evidence_likes_vote_count_trigger ON evidence_likes;
CREATE TRIGGER evidence_likes_vote_count_trigger
  AFTER INSERT OR DELETE ON evidence_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_comment_vote_count();

-- Initialize vote counts for existing comments
UPDATE comments c
SET vote_count = (
  SELECT COUNT(*)
  FROM evidence_likes el
  WHERE el.comment_id = c.id
)
WHERE vote_count = 0 OR vote_count IS NULL;
