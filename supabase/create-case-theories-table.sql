-- Create case theories table for community voting
CREATE TABLE IF NOT EXISTS case_theories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  theory_type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  vote_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create theory votes table
CREATE TABLE IF NOT EXISTS theory_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  theory_id UUID NOT NULL REFERENCES case_theories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(theory_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_case_theories_case ON case_theories(case_id);
CREATE INDEX IF NOT EXISTS idx_case_theories_user ON case_theories(user_id);
CREATE INDEX IF NOT EXISTS idx_case_theories_type ON case_theories(theory_type);
CREATE INDEX IF NOT EXISTS idx_case_theories_votes ON case_theories(vote_count DESC);
CREATE INDEX IF NOT EXISTS idx_case_theories_created ON case_theories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_theory_votes_theory ON theory_votes(theory_id);
CREATE INDEX IF NOT EXISTS idx_theory_votes_user ON theory_votes(user_id);

-- Enable Row Level Security
ALTER TABLE case_theories ENABLE ROW LEVEL SECURITY;
ALTER TABLE theory_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for case_theories
-- Anyone can view theories
CREATE POLICY "Anyone can view theories"
  ON case_theories FOR SELECT
  USING (true);

-- Authenticated users can create theories
CREATE POLICY "Authenticated users can create theories"
  ON case_theories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own theories
CREATE POLICY "Users can update own theories"
  ON case_theories FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own theories
CREATE POLICY "Users can delete own theories"
  ON case_theories FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for theory_votes
-- Anyone can view votes
CREATE POLICY "Anyone can view theory votes"
  ON theory_votes FOR SELECT
  USING (true);

-- Users can vote on theories
CREATE POLICY "Users can vote on theories"
  ON theory_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove their votes
CREATE POLICY "Users can remove their votes"
  ON theory_votes FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update theory vote counts
CREATE OR REPLACE FUNCTION update_theory_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE case_theories 
    SET vote_count = vote_count + 1 
    WHERE id = NEW.theory_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE case_theories 
    SET vote_count = vote_count - 1 
    WHERE id = OLD.theory_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for vote count updates
DROP TRIGGER IF EXISTS theory_votes_count_trigger ON theory_votes;
CREATE TRIGGER theory_votes_count_trigger
  AFTER INSERT OR DELETE ON theory_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_theory_vote_count();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_case_theories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS case_theories_updated_at_trigger ON case_theories;
CREATE TRIGGER case_theories_updated_at_trigger
  BEFORE UPDATE ON case_theories
  FOR EACH ROW
  EXECUTE FUNCTION update_case_theories_updated_at();
