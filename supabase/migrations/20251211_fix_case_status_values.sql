-- Fix case status values to match frontend expectations
-- Problem: Database uses 'pending', 'verified', but frontend expects 'OPEN', 'INVESTIGATING', etc.

-- First, update the CHECK constraint to allow both old and new values temporarily
ALTER TABLE public.cases DROP CONSTRAINT IF EXISTS cases_status_check;
ALTER TABLE public.cases ADD CONSTRAINT cases_status_check 
  CHECK (status IN ('pending', 'verified', 'investigating', 'closed', 'disputed', 'voting', 'OPEN', 'INVESTIGATING', 'PENDING_REVIEW', 'RESOLVED', 'CLOSED', 'DISPUTED', 'VOTING', 'IN_PROGRESS'));

-- Update existing data from old status values to new ones
UPDATE public.cases SET status = 'OPEN' WHERE status = 'pending';
UPDATE public.cases SET status = 'INVESTIGATING' WHERE status = 'verified';
UPDATE public.cases SET status = 'INVESTIGATING' WHERE status = 'investigating';
UPDATE public.cases SET status = 'RESOLVED' WHERE status = 'closed';

-- Change default value
ALTER TABLE public.cases ALTER COLUMN status SET DEFAULT 'OPEN';

-- Now enforce only the new status values
ALTER TABLE public.cases DROP CONSTRAINT IF EXISTS cases_status_check;
ALTER TABLE public.cases ADD CONSTRAINT cases_status_check 
  CHECK (status IN ('OPEN', 'INVESTIGATING', 'PENDING_REVIEW', 'RESOLVED', 'CLOSED', 'DISPUTED', 'VOTING', 'IN_PROGRESS'));

-- Verify the changes
SELECT 
  status, 
  COUNT(*) as count,
  array_agg(title) as sample_titles
FROM public.cases 
GROUP BY status;

-- Fix RLS policies to allow viewing OPEN cases (not just 'pending')
-- The old policy blocked 'pending' cases, but now 'OPEN' cases should be visible to all

DROP POLICY IF EXISTS "Public can view verified cases." ON public.cases;
DROP POLICY IF EXISTS "Users can view their own unverified cases." ON public.cases;

-- Allow everyone to view cases that are not 'pending' (old status)
-- This includes: OPEN, INVESTIGATING, PENDING_REVIEW, RESOLVED, CLOSED, DISPUTED, VOTING
CREATE POLICY "Public can view active cases." ON public.cases
  FOR SELECT USING (true);  -- All authenticated and unauthenticated users can see all cases

-- Keep policy for owners to see their own cases regardless of status
CREATE POLICY "Users can view their own cases." ON public.cases
  FOR SELECT USING (auth.uid() = user_id);

COMMENT ON POLICY "Public can view active cases." ON public.cases IS 
  'Everyone can view all cases regardless of status. This ensures investigators can see OPEN cases.';

-- Add assigned_investigator_id column as alias for investigator_id
ALTER TABLE public.cases 
ADD COLUMN IF NOT EXISTS assigned_investigator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Sync existing data
UPDATE public.cases SET assigned_investigator_id = investigator_id WHERE investigator_id IS NOT NULL;

-- Create trigger to keep both columns in sync
CREATE OR REPLACE FUNCTION sync_investigator_ids()
RETURNS TRIGGER AS $$
BEGIN
  -- If assigned_investigator_id is updated, sync to investigator_id
  IF NEW.assigned_investigator_id IS DISTINCT FROM OLD.assigned_investigator_id THEN
    NEW.investigator_id := NEW.assigned_investigator_id;
  END IF;
  
  -- If investigator_id is updated, sync to assigned_investigator_id
  IF NEW.investigator_id IS DISTINCT FROM OLD.investigator_id THEN
    NEW.assigned_investigator_id := NEW.investigator_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_investigator_ids_trigger ON public.cases;
CREATE TRIGGER sync_investigator_ids_trigger
BEFORE UPDATE ON public.cases
FOR EACH ROW
EXECUTE FUNCTION sync_investigator_ids();
