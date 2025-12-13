-- Fix Storage RLS policies for media bucket
-- Run this in Supabase SQL Editor

-- First, ensure the media bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view media files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload media files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own media files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own media files" ON storage.objects;

-- Create storage policies for media bucket
CREATE POLICY "Anyone can view media files"
ON storage.objects FOR SELECT
USING (bucket_id = 'media');

CREATE POLICY "Authenticated users can upload media files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'media' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update own media files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'media' 
  AND auth.uid() = owner
)
WITH CHECK (
  bucket_id = 'media' 
  AND auth.uid() = owner
);

CREATE POLICY "Users can delete own media files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'media' 
  AND auth.uid() = owner
);

-- Verify storage policies are created
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects';
