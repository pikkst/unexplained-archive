-- QUICK MIGRATION GUIDE
-- Copy this SQL into Supabase SQL editor and press RUN

-- ============================================================================
-- RUN THIS SQL IN SUPABASE SQL EDITOR
-- ============================================================================

-- 1. Add missing fields to cases table
ALTER TABLE public.cases 
  ADD COLUMN IF NOT EXISTS investigation_log JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS resolution_proposal TEXT,
  ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS investigator_notes TEXT;

-- 2. Add comments
COMMENT ON COLUMN public.cases.investigation_log IS 'JSONB array of investigator log entries';
COMMENT ON COLUMN public.cases.resolution_proposal IS 'Investigator final report text';
COMMENT ON COLUMN public.cases.documents IS 'JSONB array of attached documents';

-- 3. Add indexes
CREATE INDEX IF NOT EXISTS idx_cases_investigation_log ON cases USING GIN (investigation_log);
CREATE INDEX IF NOT EXISTS idx_cases_documents ON cases USING GIN (documents);

-- Check if it works:
SELECT 
  column_name, 
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'cases' 
  AND column_name IN ('investigation_log', 'resolution_proposal', 'documents', 'investigator_notes');

-- If you see 4 rows, everything is OK! ✅
