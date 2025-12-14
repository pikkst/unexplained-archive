-- Fix SECURITY DEFINER security issue on case_difficulty_avg view
-- This recreates the view with explicit SECURITY INVOKER to respect RLS policies

-- Drop the existing view (CASCADE removes dependent objects if any)
DROP VIEW IF EXISTS public.case_difficulty_avg CASCADE;

-- Recreate with explicit security_invoker = true
-- This forces the view to execute with the privileges of the calling user,
-- respecting all RLS policies and permissions
CREATE VIEW public.case_difficulty_avg 
WITH (security_invoker = true) AS
SELECT 
  case_id,
  ROUND(AVG(difficulty_rating)::numeric, 1) as avg_difficulty,
  COUNT(*) as vote_count,
  MAX(updated_at) as last_updated
FROM case_difficulty_votes
GROUP BY case_id;

-- Grant appropriate permissions
GRANT SELECT ON public.case_difficulty_avg TO authenticated;
GRANT SELECT ON public.case_difficulty_avg TO anon;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ View case_difficulty_avg recreated as SECURITY INVOKER';
  RAISE NOTICE 'RLS policies will now be respected when querying this view';
END $$;
