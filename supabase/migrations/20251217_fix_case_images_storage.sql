-- Fix storage policies for case image uploads
-- Drop old policies
DROP POLICY IF EXISTS "Authenticated users can upload case media" ON storage.objects;
DROP POLICY IF EXISTS "Public can view case media" ON storage.objects;

-- Recreate with support for both case-media and case-images folders
CREATE POLICY "Authenticated users can upload case media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media' 
  AND ((storage.foldername(name))[1] = 'case-media' OR (storage.foldername(name))[1] = 'case-images')
);

CREATE POLICY "Public can view case media"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'media' 
  AND ((storage.foldername(name))[1] = 'case-media' OR (storage.foldername(name))[1] = 'case-images')
);
