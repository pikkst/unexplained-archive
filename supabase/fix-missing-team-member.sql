-- Fix missing team member entry for existing assigned case
-- Insert TestUurija as team leader for põltsamaa case

INSERT INTO public.case_team_members (
    case_id,
    investigator_id,
    role,
    contribution_percentage,
    status
) 
SELECT 
    '3b2413c5-9fa5-4609-aaf8-0f8444ee9734'::uuid,
    '1d5fd006-9953-4d8a-9885-df448e4bd66f'::uuid,
    'leader',
    100,
    'active'
WHERE NOT EXISTS (
    SELECT 1 FROM case_team_members
    WHERE case_id = '3b2413c5-9fa5-4609-aaf8-0f8444ee9734'
    AND investigator_id = '1d5fd006-9953-4d8a-9885-df448e4bd66f'
);

-- Verify it was added
SELECT * FROM case_team_members
WHERE case_id = '3b2413c5-9fa5-4609-aaf8-0f8444ee9734';
