-- Create user_saved_cases table for bookmarking cases
CREATE TABLE IF NOT EXISTS user_saved_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT, -- Optional: User can add personal notes
  UNIQUE(user_id, case_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_saved_cases_user 
ON user_saved_cases(user_id);

CREATE INDEX IF NOT EXISTS idx_user_saved_cases_case 
ON user_saved_cases(case_id);

CREATE INDEX IF NOT EXISTS idx_user_saved_cases_saved_at 
ON user_saved_cases(saved_at DESC);

-- Enable Row Level Security
ALTER TABLE user_saved_cases ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own saved cases" ON user_saved_cases;
CREATE POLICY "Users can view their own saved cases" 
ON user_saved_cases FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can save cases" ON user_saved_cases;
CREATE POLICY "Users can save cases" 
ON user_saved_cases FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unsave their cases" ON user_saved_cases;
CREATE POLICY "Users can unsave their cases" 
ON user_saved_cases FOR DELETE 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their saved case notes" ON user_saved_cases;
CREATE POLICY "Users can update their saved case notes" 
ON user_saved_cases FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add comment
COMMENT ON TABLE user_saved_cases IS 'Stores user bookmarks/saved cases for later reference';
