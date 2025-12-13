-- ========================================
-- TEAM COLLABORATION SYSTEM
-- Multi-investigator case support
-- ========================================

-- 1. CASE TEAM MEMBERS TABLE
-- Track all investigators working on a case
CREATE TABLE IF NOT EXISTS case_team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    investigator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('leader', 'member')),
    joined_at TIMESTAMP DEFAULT NOW(),
    invited_by UUID REFERENCES profiles(id),
    contribution_percentage INTEGER DEFAULT NULL CHECK (contribution_percentage >= 0 AND contribution_percentage <= 100),
    status TEXT DEFAULT 'active' CHECK (status IN ('invited', 'active', 'left', 'removed')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Prevent duplicate team memberships
    CONSTRAINT unique_case_investigator UNIQUE(case_id, investigator_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_case ON case_team_members(case_id);
CREATE INDEX IF NOT EXISTS idx_team_members_investigator ON case_team_members(investigator_id);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON case_team_members(status);

-- 2. TEAM INVITATIONS TABLE
-- Track pending team invitations
CREATE TABLE IF NOT EXISTS team_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    from_investigator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    to_investigator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    message TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    created_at TIMESTAMP DEFAULT NOW(),
    responded_at TIMESTAMP,
    
    -- Prevent duplicate invitations
    CONSTRAINT unique_team_invitation UNIQUE(case_id, to_investigator_id, status)
);

CREATE INDEX IF NOT EXISTS idx_team_invitations_to ON team_invitations(to_investigator_id, status);
CREATE INDEX IF NOT EXISTS idx_team_invitations_case ON team_invitations(case_id);

-- 3. Extend cases table for team support
ALTER TABLE cases 
    ADD COLUMN IF NOT EXISTS team_leader_id UUID REFERENCES profiles(id),
    ADD COLUMN IF NOT EXISTS is_team_case BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_cases_team_leader ON cases(team_leader_id);

-- ========================================
-- TEAM MANAGEMENT FUNCTIONS
-- ========================================

-- Function: Create team and set leader when investigator claims case
CREATE OR REPLACE FUNCTION claim_case_as_leader(
    p_case_id UUID,
    p_investigator_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_case RECORD;
BEGIN
    -- Check if case exists and is available
    SELECT * INTO v_case FROM cases WHERE id = p_case_id;
    
    IF v_case IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Case not found');
    END IF;
    
    IF v_case.status != 'OPEN' THEN
        RETURN json_build_object('success', false, 'error', 'Case is not available for claiming');
    END IF;
    
    -- Update case
    UPDATE cases 
    SET 
        assigned_investigator_id = p_investigator_id,
        team_leader_id = p_investigator_id,
        is_team_case = false, -- Starts as single investigator
        status = 'INVESTIGATING',
        updated_at = NOW()
    WHERE id = p_case_id;
    
    -- Add leader to team_members
    INSERT INTO case_team_members (case_id, investigator_id, role, status, invited_by)
    VALUES (p_case_id, p_investigator_id, 'leader', 'active', p_investigator_id);
    
    RETURN json_build_object(
        'success', true,
        'message', 'Case claimed successfully',
        'case_id', p_case_id,
        'team_leader', true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Invite investigator to team
CREATE OR REPLACE FUNCTION invite_team_member(
    p_case_id UUID,
    p_from_investigator_id UUID,
    p_to_investigator_id UUID,
    p_message TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_is_leader BOOLEAN;
    v_already_member BOOLEAN;
    v_invitation_id UUID;
BEGIN
    -- Verify sender is team leader
    SELECT EXISTS (
        SELECT 1 FROM case_team_members 
        WHERE case_id = p_case_id 
        AND investigator_id = p_from_investigator_id 
        AND role = 'leader'
        AND status = 'active'
    ) INTO v_is_leader;
    
    IF NOT v_is_leader THEN
        RETURN json_build_object('success', false, 'error', 'Only team leader can invite members');
    END IF;
    
    -- Check if already a team member
    SELECT EXISTS (
        SELECT 1 FROM case_team_members 
        WHERE case_id = p_case_id 
        AND investigator_id = p_to_investigator_id
        AND status IN ('active', 'invited')
    ) INTO v_already_member;
    
    IF v_already_member THEN
        RETURN json_build_object('success', false, 'error', 'Investigator is already on the team');
    END IF;
    
    -- Check for pending invitation
    IF EXISTS (
        SELECT 1 FROM team_invitations 
        WHERE case_id = p_case_id 
        AND to_investigator_id = p_to_investigator_id 
        AND status = 'pending'
    ) THEN
        RETURN json_build_object('success', false, 'error', 'Invitation already sent');
    END IF;
    
    -- Create invitation
    INSERT INTO team_invitations (case_id, from_investigator_id, to_investigator_id, message)
    VALUES (p_case_id, p_from_investigator_id, p_to_investigator_id, p_message)
    RETURNING id INTO v_invitation_id;
    
    -- Update case to team mode
    UPDATE cases 
    SET is_team_case = true 
    WHERE id = p_case_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Invitation sent',
        'invitation_id', v_invitation_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Accept team invitation
CREATE OR REPLACE FUNCTION accept_team_invitation(
    p_invitation_id UUID,
    p_investigator_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_invitation RECORD;
BEGIN
    -- Get invitation details
    SELECT * INTO v_invitation 
    FROM team_invitations 
    WHERE id = p_invitation_id 
    AND to_investigator_id = p_investigator_id
    AND status = 'pending';
    
    IF v_invitation IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invitation not found or already processed');
    END IF;
    
    -- Update invitation status
    UPDATE team_invitations 
    SET 
        status = 'accepted',
        responded_at = NOW()
    WHERE id = p_invitation_id;
    
    -- Add to team members
    INSERT INTO case_team_members (case_id, investigator_id, role, status, invited_by)
    VALUES (
        v_invitation.case_id,
        p_investigator_id,
        'member',
        'active',
        v_invitation.from_investigator_id
    );
    
    RETURN json_build_object(
        'success', true,
        'message', 'Successfully joined team',
        'case_id', v_invitation.case_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Reject team invitation
CREATE OR REPLACE FUNCTION reject_team_invitation(
    p_invitation_id UUID,
    p_investigator_id UUID
)
RETURNS JSON AS $$
BEGIN
    -- Update invitation status
    UPDATE team_invitations 
    SET 
        status = 'rejected',
        responded_at = NOW()
    WHERE id = p_invitation_id 
    AND to_investigator_id = p_investigator_id
    AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Invitation not found');
    END IF;
    
    RETURN json_build_object('success', true, 'message', 'Invitation rejected');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Remove team member (leader only)
CREATE OR REPLACE FUNCTION remove_team_member(
    p_case_id UUID,
    p_leader_id UUID,
    p_member_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_is_leader BOOLEAN;
BEGIN
    -- Verify sender is team leader
    SELECT EXISTS (
        SELECT 1 FROM case_team_members 
        WHERE case_id = p_case_id 
        AND investigator_id = p_leader_id 
        AND role = 'leader'
    ) INTO v_is_leader;
    
    IF NOT v_is_leader THEN
        RETURN json_build_object('success', false, 'error', 'Only team leader can remove members');
    END IF;
    
    -- Cannot remove leader
    IF p_member_id = p_leader_id THEN
        RETURN json_build_object('success', false, 'error', 'Leader cannot remove themselves');
    END IF;
    
    -- Update member status
    UPDATE case_team_members 
    SET 
        status = 'removed',
        updated_at = NOW()
    WHERE case_id = p_case_id 
    AND investigator_id = p_member_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Team member not found');
    END IF;
    
    RETURN json_build_object('success', true, 'message', 'Team member removed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Leave team (member voluntarily leaves)
CREATE OR REPLACE FUNCTION leave_team(
    p_case_id UUID,
    p_investigator_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_member RECORD;
BEGIN
    -- Get member details
    SELECT * INTO v_member 
    FROM case_team_members 
    WHERE case_id = p_case_id 
    AND investigator_id = p_investigator_id
    AND status = 'active';
    
    IF v_member IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not a member of this team');
    END IF;
    
    -- Leader cannot leave (must transfer leadership first)
    IF v_member.role = 'leader' THEN
        RETURN json_build_object('success', false, 'error', 'Team leader must transfer leadership before leaving');
    END IF;
    
    -- Update status
    UPDATE case_team_members 
    SET 
        status = 'left',
        updated_at = NOW()
    WHERE case_id = p_case_id 
    AND investigator_id = p_investigator_id;
    
    RETURN json_build_object('success', true, 'message', 'Successfully left team');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
    joined_at TIMESTAMP,
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

-- Function: Set reward split percentages (leader only)
CREATE OR REPLACE FUNCTION set_reward_split(
    p_case_id UUID,
    p_leader_id UUID,
    p_splits JSONB -- Array of {investigator_id, percentage}
)
RETURNS JSON AS $$
DECLARE
    v_is_leader BOOLEAN;
    v_total_percentage INTEGER := 0;
    v_split JSONB;
BEGIN
    -- Verify sender is team leader
    SELECT EXISTS (
        SELECT 1 FROM case_team_members 
        WHERE case_id = p_case_id 
        AND investigator_id = p_leader_id 
        AND role = 'leader'
    ) INTO v_is_leader;
    
    IF NOT v_is_leader THEN
        RETURN json_build_object('success', false, 'error', 'Only team leader can set reward splits');
    END IF;
    
    -- Validate total percentage = 100
    FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
    LOOP
        v_total_percentage := v_total_percentage + (v_split->>'percentage')::INTEGER;
    END LOOP;
    
    IF v_total_percentage != 100 THEN
        RETURN json_build_object('success', false, 'error', 'Total percentage must equal 100');
    END IF;
    
    -- Update contribution percentages
    FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits)
    LOOP
        UPDATE case_team_members 
        SET contribution_percentage = (v_split->>'percentage')::INTEGER
        WHERE case_id = p_case_id 
        AND investigator_id = (v_split->>'investigator_id')::UUID;
    END LOOP;
    
    RETURN json_build_object('success', true, 'message', 'Reward splits updated');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Distribute team reward (called after escrow release)
CREATE OR REPLACE FUNCTION distribute_team_reward(
    p_case_id UUID,
    p_total_amount DECIMAL
)
RETURNS JSON AS $$
DECLARE
    v_team_member RECORD;
    v_member_amount DECIMAL;
    v_wallet_id UUID;
    v_total_distributed DECIMAL := 0;
BEGIN
    -- Distribute to each team member based on contribution percentage
    FOR v_team_member IN 
        SELECT investigator_id, contribution_percentage 
        FROM case_team_members 
        WHERE case_id = p_case_id 
        AND status = 'active'
        AND contribution_percentage IS NOT NULL
    LOOP
        -- Calculate member's share
        v_member_amount := p_total_amount * (v_team_member.contribution_percentage::DECIMAL / 100);
        
        -- Get or create wallet
        INSERT INTO wallets (user_id, balance)
        VALUES (v_team_member.investigator_id, 0)
        ON CONFLICT (user_id) DO NOTHING;
        
        SELECT id INTO v_wallet_id 
        FROM wallets 
        WHERE user_id = v_team_member.investigator_id;
        
        -- Add funds to wallet
        UPDATE wallets 
        SET balance = balance + v_member_amount
        WHERE id = v_wallet_id;
        
        -- Create transaction record
        INSERT INTO transactions (
            from_wallet_id,
            to_wallet_id,
            amount,
            type,
            description,
            case_id,
            created_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000001', -- Platform wallet
            v_wallet_id,
            v_member_amount,
            'case_reward',
            'Team case reward distribution',
            p_case_id,
            NOW()
        );
        
        v_total_distributed := v_total_distributed + v_member_amount;
    END LOOP;
    
    RETURN json_build_object(
        'success', true,
        'total_distributed', v_total_distributed,
        'message', 'Reward distributed to team members'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================

ALTER TABLE case_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;

-- Team members: Team members and case submitter can view
CREATE POLICY team_members_view_policy ON case_team_members
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM cases 
        WHERE cases.id = case_team_members.case_id 
        AND (
            cases.user_id = auth.uid() 
            OR cases.team_leader_id = auth.uid()
            OR case_team_members.investigator_id = auth.uid()
        )
    )
);

-- Team invitations: Only sender and recipient can view
CREATE POLICY invitations_view_policy ON team_invitations
FOR SELECT USING (
    from_investigator_id = auth.uid() OR to_investigator_id = auth.uid()
);

-- ========================================
-- TRIGGERS
-- ========================================

-- Trigger: Auto-calculate equal split if not set when case resolved
CREATE OR REPLACE FUNCTION auto_calculate_reward_split()
RETURNS TRIGGER AS $$
DECLARE
    v_member_count INTEGER;
    v_equal_percentage INTEGER;
BEGIN
    IF NEW.status = 'RESOLVED' AND OLD.status != 'RESOLVED' THEN
        -- Count active team members without set percentages
        SELECT COUNT(*) INTO v_member_count
        FROM case_team_members
        WHERE case_id = NEW.id
        AND status = 'active'
        AND contribution_percentage IS NULL;
        
        IF v_member_count > 0 THEN
            -- Calculate equal split
            v_equal_percentage := 100 / v_member_count;
            
            -- Update all members without percentage
            UPDATE case_team_members
            SET contribution_percentage = v_equal_percentage
            WHERE case_id = NEW.id
            AND status = 'active'
            AND contribution_percentage IS NULL;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_reward_split
BEFORE UPDATE ON cases
FOR EACH ROW
EXECUTE FUNCTION auto_calculate_reward_split();

-- ========================================
-- COMMENTS
-- ========================================

COMMENT ON TABLE case_team_members IS 'Tracks investigators working on a case as a team';
COMMENT ON TABLE team_invitations IS 'Pending invitations for investigators to join case teams';
COMMENT ON FUNCTION claim_case_as_leader IS 'Investigator claims case and becomes team leader';
COMMENT ON FUNCTION invite_team_member IS 'Team leader invites another investigator to join';
COMMENT ON FUNCTION accept_team_invitation IS 'Investigator accepts team invitation';
COMMENT ON FUNCTION distribute_team_reward IS 'Splits reward among team members based on contribution percentages';
