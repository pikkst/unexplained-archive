-- =============================================
-- QUICK SETUP FOR PROFILE EDITING
-- Copy and paste this entire script into Supabase SQL Editor
-- =============================================

-- Step 1: Add new columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS website TEXT;

-- Step 2: Create media storage bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  52428800, -- 50MB
  ARRAY['image/*', 'video/*']
)
ON CONFLICT (id) DO NOTHING;

-- Step 3: Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Users can upload their own media" ON storage.objects;
DROP POLICY IF EXISTS "Public media access" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own media" ON storage.objects;

-- Step 4: Create storage policies
-- Allow authenticated users to upload their own files
CREATE POLICY "Users can upload their own media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media' AND 
  (storage.foldername(name))[1] = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[2]
);

-- Allow public read access to all media
CREATE POLICY "Public media access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'media');

-- Allow users to update their own media
CREATE POLICY "Users can update their own media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'media' AND 
  (storage.foldername(name))[1] = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[2]
);

-- Allow users to delete their own media
CREATE POLICY "Users can delete their own media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'media' AND 
  (storage.foldername(name))[1] = 'avatars' AND 
  auth.uid()::text = (storage.foldername(name))[2]
);

-- Step 5: Verify the setup
SELECT 'Setup completed successfully!' as status;
SELECT 'Profiles table has ' || count(*) || ' rows' as profiles_count FROM profiles;
SELECT 'Media bucket exists: ' || (SELECT name FROM storage.buckets WHERE id = 'media') as bucket_status;

-- Done! Now you can test the profile editing feature.
