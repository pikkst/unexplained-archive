-- =============================================
-- Add additional profile fields
-- Run this in your Supabase SQL Editor
-- =============================================

-- Add location and website columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS website TEXT;

-- Add comment for documentation
COMMENT ON COLUMN profiles.location IS 'User''s location (city, country)';
COMMENT ON COLUMN profiles.website IS 'User''s personal or professional website URL';

-- =============================================
-- Storage Setup for Profile Pictures
-- =============================================
-- This creates the storage bucket and policies for media uploads

-- Create storage bucket for media (if not exists)
-- Note: This might need to be done manually in Supabase Dashboard > Storage
-- Bucket name: media
-- Public: true
-- File size limit: 50MB
-- Allowed MIME types: image/*, video/*

-- Storage policies for media bucket
-- Allow authenticated users to upload their own files
CREATE POLICY "Users can upload their own media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'media' AND (storage.foldername(name))[1] = 'avatars' AND auth.uid()::text = (storage.foldername(name))[2]);

-- Allow public read access to all media
CREATE POLICY "Public media access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'media');

-- Allow users to update their own media
CREATE POLICY "Users can update their own media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'media' AND (storage.foldername(name))[1] = 'avatars' AND auth.uid()::text = (storage.foldername(name))[2]);

-- Allow users to delete their own media
CREATE POLICY "Users can delete their own media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'media' AND (storage.foldername(name))[1] = 'avatars' AND auth.uid()::text = (storage.foldername(name))[2]);
