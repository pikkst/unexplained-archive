-- Storage policies for media bucket (evidence files, case images, etc.)

-- Allow authenticated users to upload files to evidence folder
CREATE POLICY "Authenticated users can upload evidence files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media' 
  AND (storage.foldername(name))[1] = 'evidence'
);

-- Allow authenticated users to update their own uploaded files
CREATE POLICY "Users can update their evidence files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'media' 
  AND (storage.foldername(name))[1] = 'evidence'
  AND auth.uid()::text = owner::text
);

-- Allow everyone to view evidence files (public read)
CREATE POLICY "Public can view evidence files"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'media' 
  AND (storage.foldername(name))[1] = 'evidence'
);

-- Allow users to delete their evidence files (or case investigator)
CREATE POLICY "Investigators can delete evidence files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'media' 
  AND (storage.foldername(name))[1] = 'evidence'
);

-- Also ensure case-media uploads work (for case submissions)
CREATE POLICY "Authenticated users can upload case media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'media' 
  AND (storage.foldername(name))[1] = 'case-media'
);

CREATE POLICY "Public can view case media"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'media' 
  AND (storage.foldername(name))[1] = 'case-media'
);

COMMENT ON POLICY "Authenticated users can upload evidence files" ON storage.objects IS 
  'Allows authenticated investigators to upload evidence files to cases';
