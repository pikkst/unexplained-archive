-- Add missing user_rating column to cases table
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_cases_user_rating ON cases(user_rating) WHERE user_rating IS NOT NULL;

-- Verify column was added
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'cases'
AND column_name = 'user_rating';
