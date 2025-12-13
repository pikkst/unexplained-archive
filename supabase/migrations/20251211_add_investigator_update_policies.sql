-- Add UPDATE policy for investigators to assign themselves to OPEN cases
-- This allows approved investigators to update assigned_investigator_id and status

-- First, check current UPDATE policies
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'cases' AND cmd = 'UPDATE';

-- Create policy for investigators to assign themselves to cases
CREATE POLICY "Investigators can assign themselves to open cases" ON public.cases
  FOR UPDATE
  USING (
    -- Only allow if case is OPEN (not already assigned)
    status = 'OPEN' 
    AND assigned_investigator_id IS NULL
    AND investigator_id IS NULL
  )
  WITH CHECK (
    -- Only allow if user is approved investigator
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'investigator'
      AND profiles.investigator_status = 'approved'
    )
    -- And only setting themselves as investigator
    AND assigned_investigator_id = auth.uid()
    -- And changing status to INVESTIGATING
    AND status = 'INVESTIGATING'
  );

-- Also allow investigators to update cases they are assigned to
CREATE POLICY "Investigators can update their assigned cases" ON public.cases
  FOR UPDATE
  USING (
    -- User is the assigned investigator
    (assigned_investigator_id = auth.uid() OR investigator_id = auth.uid())
  )
  WITH CHECK (
    -- User is still the assigned investigator (prevent stealing cases)
    (assigned_investigator_id = auth.uid() OR investigator_id = auth.uid())
  );

COMMENT ON POLICY "Investigators can assign themselves to open cases" ON public.cases IS 
  'Approved investigators can assign themselves to OPEN cases by setting assigned_investigator_id to their ID';

COMMENT ON POLICY "Investigators can update their assigned cases" ON public.cases IS 
  'Investigators can update case details, notes, and status for cases assigned to them';

-- Verify new policies
SELECT 
    policyname,
    cmd,
    roles,
    permissive
FROM pg_policies
WHERE tablename = 'cases'
AND cmd = 'UPDATE'
ORDER BY policyname;
