-- Add missing resolved_at column
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;

-- Create index for resolved cases
CREATE INDEX IF NOT EXISTS idx_cases_resolved_at ON cases(resolved_at) WHERE resolved_at IS NOT NULL;

-- Verify columns
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'cases'
AND column_name IN ('resolved_at', 'user_rating');
