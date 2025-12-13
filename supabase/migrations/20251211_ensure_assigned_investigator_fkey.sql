-- Ensure assigned_investigator_id foreign key constraint exists
-- This is needed for SELECT queries to join with profiles table

-- First check if the column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'cases' 
        AND column_name = 'assigned_investigator_id'
    ) THEN
        ALTER TABLE public.cases 
        ADD COLUMN assigned_investigator_id UUID;
    END IF;
END $$;

-- Drop existing constraint if it exists (to recreate with correct name)
ALTER TABLE public.cases 
DROP CONSTRAINT IF EXISTS cases_assigned_investigator_id_fkey;

ALTER TABLE public.cases 
DROP CONSTRAINT IF EXISTS fk_assigned_investigator;

-- Add the foreign key constraint with the correct name
ALTER TABLE public.cases
ADD CONSTRAINT cases_assigned_investigator_id_fkey 
FOREIGN KEY (assigned_investigator_id) 
REFERENCES public.profiles(id) 
ON DELETE SET NULL;

-- Sync existing investigator_id values to assigned_investigator_id
UPDATE public.cases 
SET assigned_investigator_id = investigator_id 
WHERE investigator_id IS NOT NULL 
AND (assigned_investigator_id IS NULL OR assigned_investigator_id != investigator_id);

-- Create or replace trigger to keep both columns in sync
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
BEFORE INSERT OR UPDATE ON public.cases
FOR EACH ROW
EXECUTE FUNCTION sync_investigator_ids();

-- Verify the constraint exists
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'cases'
    AND kcu.column_name = 'assigned_investigator_id';
