-- Create case_notes table for private investigation notes
-- Visible only to team members assigned to the case

CREATE TABLE IF NOT EXISTS case_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  is_important BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_case_notes_case_id ON case_notes(case_id);
CREATE INDEX idx_case_notes_author_id ON case_notes(author_id);
CREATE INDEX idx_case_notes_created_at ON case_notes(created_at DESC);

-- Enable Row Level Security
ALTER TABLE case_notes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view notes on cases they're team members of
CREATE POLICY "Users can view notes on their team cases"
ON case_notes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM case_team_members
    WHERE case_team_members.case_id = case_notes.case_id
    AND case_team_members.user_id = auth.uid()
    AND case_team_members.status = 'accepted'
  )
);

-- Policy: Users can insert notes on cases they're team members of
CREATE POLICY "Users can insert notes on their team cases"
ON case_notes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM case_team_members
    WHERE case_team_members.case_id = case_notes.case_id
    AND case_team_members.user_id = auth.uid()
    AND case_team_members.status = 'accepted'
  )
  AND author_id = auth.uid()
);

-- Policy: Users can update their own notes
CREATE POLICY "Users can update their own notes"
ON case_notes FOR UPDATE
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

-- Policy: Users can delete their own notes
CREATE POLICY "Users can delete their own notes"
ON case_notes FOR DELETE
USING (author_id = auth.uid());

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_case_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER case_notes_updated_at
BEFORE UPDATE ON case_notes
FOR EACH ROW
EXECUTE FUNCTION update_case_notes_updated_at();

-- Add comment
COMMENT ON TABLE case_notes IS 'Private investigation notes for case team members';
