-- Create media storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media', 
  'media', 
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm']
) ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow public read access to media bucket
DROP POLICY IF EXISTS "Public read access for media" ON storage.objects;
CREATE POLICY "Public read access for media"
ON storage.objects FOR SELECT
USING (bucket_id = 'media');

-- Allow authenticated users to upload to media bucket
DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');

-- Allow service role full access (for Edge Functions)
DROP POLICY IF EXISTS "Service role full access to media" ON storage.objects;
CREATE POLICY "Service role full access to media"
ON storage.objects FOR ALL
USING (bucket_id = 'media' AND auth.role() = 'service_role');
