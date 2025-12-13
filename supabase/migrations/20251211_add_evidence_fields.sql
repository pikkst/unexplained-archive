-- Add evidence_files field to cases table for investigator evidence
-- This stores URLs to documents, images, videos uploaded by investigators

ALTER TABLE public.cases 
ADD COLUMN IF NOT EXISTS evidence_files jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.cases.evidence_files IS 'Array of evidence files uploaded by investigators. Format: [{"url": "...", "name": "...", "type": "image|video|document", "uploaded_at": "...", "uploaded_by": "..."}]';

-- Add investigator notes field if not exists
ALTER TABLE public.cases 
ADD COLUMN IF NOT EXISTS investigator_notes text;

-- Add resolution proposal field if not exists
ALTER TABLE public.cases 
ADD COLUMN IF NOT EXISTS resolution_proposal text;

COMMENT ON COLUMN public.cases.investigator_notes IS 'Field notes and analysis from the investigator';
COMMENT ON COLUMN public.cases.resolution_proposal IS 'Investigators proposed resolution/conclusion';
