-- Drop existing table if it has wrong structure
DROP TABLE IF EXISTS public.case_team_members CASCADE;

-- Create case_team_members table
CREATE TABLE public.case_team_members (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    investigator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
    contribution_percentage integer DEFAULT 0 CHECK (contribution_percentage >= 0 AND contribution_percentage <= 100),
    status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'removed')),
    joined_at timestamptz DEFAULT timezone('utc', now()),
    left_at timestamptz,
    notes text,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now()),
    CONSTRAINT unique_case_investigator UNIQUE(case_id, investigator_id, status)
);

COMMENT ON TABLE public.case_team_members IS 'Team members working collaboratively on cases';

-- Create indexes
CREATE INDEX idx_team_members_case ON public.case_team_members(case_id);
CREATE INDEX idx_team_members_investigator ON public.case_team_members(investigator_id);
CREATE INDEX idx_team_members_status ON public.case_team_members(case_id, status);

-- Enable RLS
ALTER TABLE public.case_team_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Team members viewable by case participants" ON public.case_team_members
  FOR SELECT USING (
    -- Anyone can view team members of a case
    true
  );

CREATE POLICY "Team leaders can manage members" ON public.case_team_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.case_team_members ctm
      WHERE ctm.case_id = case_team_members.case_id
      AND ctm.investigator_id = auth.uid()
      AND ctm.role = 'leader'
      AND ctm.status = 'active'
    )
  );

-- Function: Get team members for a case
CREATE OR REPLACE FUNCTION get_case_team(p_case_id UUID)
RETURNS TABLE (
    investigator_id UUID,
    username TEXT,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT,
    contribution_percentage INTEGER,
    status TEXT,
    joined_at TIMESTAMPTZ,
    reputation INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ctm.investigator_id,
        p.username,
        p.full_name,
        p.avatar_url,
        ctm.role,
        ctm.contribution_percentage,
        ctm.status,
        ctm.joined_at,
        p.reputation
    FROM case_team_members ctm
    JOIN profiles p ON ctm.investigator_id = p.id
    WHERE ctm.case_id = p_case_id
    AND ctm.status = 'active'
    ORDER BY 
        CASE WHEN ctm.role = 'leader' THEN 0 ELSE 1 END,
        ctm.joined_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Auto-add assigned investigator as team leader
CREATE OR REPLACE FUNCTION auto_add_investigator_to_team()
RETURNS TRIGGER AS $$
BEGIN
    -- When an investigator is assigned, add them as team leader
    IF NEW.assigned_investigator_id IS NOT NULL THEN
        -- Only add if this is a new assignment (INSERT or changed investigator)
        IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.assigned_investigator_id IS NULL OR OLD.assigned_investigator_id != NEW.assigned_investigator_id)) THEN
            INSERT INTO public.case_team_members (
                case_id,
                investigator_id,
                role,
                contribution_percentage,
                status
            ) VALUES (
                NEW.id,
                NEW.assigned_investigator_id,
                'leader',
                100,
                'active'
            )
            ON CONFLICT (case_id, investigator_id, status) 
            DO UPDATE SET 
                role = 'leader',
                contribution_percentage = 100,
                updated_at = timezone('utc', now());
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_add_investigator_trigger ON public.cases;
CREATE TRIGGER auto_add_investigator_trigger
AFTER INSERT OR UPDATE OF assigned_investigator_id ON public.cases
FOR EACH ROW
EXECUTE FUNCTION auto_add_investigator_to_team();

COMMENT ON FUNCTION get_case_team IS 'Returns active team members for a specific case with their profiles';
COMMENT ON TRIGGER auto_add_investigator_trigger ON public.cases IS 'Automatically adds assigned investigator as team leader';
