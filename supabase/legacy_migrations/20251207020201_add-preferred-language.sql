-- Add preferred_language column to profiles table
-- This enables auto-translation feature for paid investigators

-- Add column with default 'en' (English)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(2) DEFAULT 'en';

-- Create index for faster language lookups
CREATE INDEX IF NOT EXISTS idx_profiles_preferred_language 
ON profiles(preferred_language);

-- Update existing profiles to have English as default
UPDATE profiles 
SET preferred_language = 'en' 
WHERE preferred_language IS NULL;

-- Add comment
COMMENT ON COLUMN profiles.preferred_language IS 'User preferred language for auto-translation (ISO 639-1 code)';

-- Verify the change
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'preferred_language';
