-- Add show_email field to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_email BOOLEAN DEFAULT false;

-- Add comment
COMMENT ON COLUMN profiles.show_email IS 'Whether user wants to display their email publicly on their profile';
