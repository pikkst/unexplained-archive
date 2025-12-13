-- Add user_feedback column to cases table for storing user's comments/review
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS user_feedback TEXT;

-- Add index for searching feedback
CREATE INDEX IF NOT EXISTS idx_cases_user_rating ON cases(user_rating) 
WHERE user_rating IS NOT NULL;

-- Verify column was added
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'cases'
AND column_name IN ('user_rating', 'user_feedback');
