-- Create reputation table
CREATE TABLE IF NOT EXISTS reputation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_points INTEGER DEFAULT 0 NOT NULL,
  cases_resolved INTEGER DEFAULT 0,
  cases_submitted INTEGER DEFAULT 0,
  helpful_votes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_reputation_user_id ON reputation(user_id);
CREATE INDEX IF NOT EXISTS idx_reputation_total_points ON reputation(total_points DESC);

-- Enable RLS
ALTER TABLE reputation ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all reputation"
  ON reputation FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own reputation"
  ON reputation FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert reputation"
  ON reputation FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Verify table was created
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'reputation'
ORDER BY ordinal_position;
