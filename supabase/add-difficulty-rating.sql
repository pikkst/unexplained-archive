-- Add difficulty_rating column to cases table
-- Rating scale: 1-5 (1 = Easy, 5 = Impossible)

ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS difficulty_rating INTEGER DEFAULT 3 
CHECK (difficulty_rating BETWEEN 1 AND 5);

-- Add index for filtering by difficulty
CREATE INDEX IF NOT EXISTS idx_cases_difficulty 
ON cases(difficulty_rating);

-- Add comment for documentation
COMMENT ON COLUMN cases.difficulty_rating IS 'Case difficulty rating from 1 (Easy) to 5 (Impossible). Default is 3 (Medium).';
