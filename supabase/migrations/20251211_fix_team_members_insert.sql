-- Add INSERT policy for case_team_members
-- This is needed for the trigger to auto-add investigators

CREATE POLICY "System can auto-add team members" ON public.case_team_members
  FOR INSERT 
  WITH CHECK (true);

-- Also allow authenticated users to insert themselves
CREATE POLICY "Authenticated users can join teams" ON public.case_team_members
  FOR INSERT 
  TO authenticated
  WITH CHECK (investigator_id = auth.uid());

-- Verify policies
SELECT 
    policyname,
    cmd,
    roles,
    permissive
FROM pg_policies
WHERE tablename = 'case_team_members'
ORDER BY policyname;
