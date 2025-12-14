-- Add progress_percentage column to cases table
-- Progress scale: 0-100%

ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0 
CHECK (progress_percentage BETWEEN 0 AND 100);

-- Add index for filtering/sorting by progress
CREATE INDEX IF NOT EXISTS idx_cases_progress 
ON cases(progress_percentage);

-- Add comment for documentation
COMMENT ON COLUMN cases.progress_percentage IS 'Investigation progress percentage from 0 to 100. Default is 0 (not started).';

-- Update existing cases based on status
UPDATE cases 
SET progress_percentage = CASE 
  WHEN status = 'RESOLVED' THEN 100
  WHEN status = 'INVESTIGATING' THEN 50
  WHEN status = 'DISPUTED' THEN 75
  WHEN status = 'VOTING' THEN 85
  ELSE 0
END
WHERE progress_percentage = 0;
