-- Fix RLS policies to prevent 500 errors
-- The "FOR ALL" policy was causing recursion issues

-- Drop the problematic policy
DROP POLICY IF EXISTS "Team leaders can manage members" ON public.case_team_members;

-- Create separate policies for UPDATE and DELETE only
CREATE POLICY "Team leaders can update members" ON public.case_team_members
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.case_team_members ctm
      WHERE ctm.case_id = case_team_members.case_id
      AND ctm.investigator_id = auth.uid()
      AND ctm.role = 'leader'
      AND ctm.status = 'active'
    )
  );

CREATE POLICY "Team leaders can delete members" ON public.case_team_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.case_team_members ctm
      WHERE ctm.case_id = case_team_members.case_id
      AND ctm.investigator_id = auth.uid()
      AND ctm.role = 'leader'
      AND ctm.status = 'active'
    )
  );

-- Verify all policies
SELECT 
    policyname,
    cmd,
    permissive,
    roles
FROM pg_policies
WHERE tablename = 'case_team_members'
ORDER BY cmd, policyname;
