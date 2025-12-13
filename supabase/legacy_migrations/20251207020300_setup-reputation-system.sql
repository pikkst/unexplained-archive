-- =============================================
-- REPUTATION & TRUST SCORE SYSTEM
-- Run this in Supabase SQL Editor
-- =============================================

-- Function: Update investigator reputation (positive outcome)
CREATE OR REPLACE FUNCTION reward_investigator_reputation(
  investigator_id UUID,
  points INTEGER DEFAULT 10
)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET reputation = reputation + points,
      updated_at = NOW()
  WHERE id = investigator_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Penalize investigator reputation (negative outcome)
CREATE OR REPLACE FUNCTION penalize_investigator_reputation(
  investigator_id UUID,
  points INTEGER DEFAULT 5
)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET reputation = GREATEST(0, reputation - points),
      updated_at = NOW()
  WHERE id = investigator_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update submitter trust score (penalize for false disputes)
CREATE OR REPLACE FUNCTION penalize_submitter_trust(
  submitter_id UUID,
  points INTEGER DEFAULT 3
)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET reputation = GREATEST(0, reputation - points),
      updated_at = NOW()
  WHERE id = submitter_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Reward submitter for valid case submission
CREATE OR REPLACE FUNCTION reward_submitter(
  submitter_id UUID,
  points INTEGER DEFAULT 2
)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET reputation = reputation + points,
      updated_at = NOW()
  WHERE id = submitter_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Process case resolution with reputation updates
CREATE OR REPLACE FUNCTION process_case_resolution(
  p_case_id UUID,
  p_investigator_id UUID,
  p_submitter_id UUID,
  p_user_rating INTEGER,
  p_resolution_accepted BOOLEAN
)
RETURNS VOID AS $$
DECLARE
  reputation_points INTEGER;
BEGIN
  IF p_resolution_accepted THEN
    -- Calculate reputation based on rating (1-5 stars = 5-25 points)
    reputation_points := p_user_rating * 5;
    
    -- Reward investigator
    PERFORM reward_investigator_reputation(p_investigator_id, reputation_points);
    
    -- Small reward to submitter for valid case
    PERFORM reward_submitter(p_submitter_id, 2);
    
    -- Update case with rating and status
    UPDATE cases
    SET user_rating = p_user_rating,
        status = 'RESOLVED',
        resolved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_case_id;
    
    -- Release escrow to investigator
    PERFORM release_case_escrow(p_case_id, p_investigator_id);
  ELSE
    -- Case disputed - no reputation changes yet (wait for admin/vote)
    UPDATE cases
    SET status = 'DISPUTED',
        updated_at = NOW()
    WHERE id = p_case_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Process voting outcome
CREATE OR REPLACE FUNCTION process_voting_outcome(
  p_case_id UUID,
  p_community_approves BOOLEAN
)
RETURNS VOID AS $$
DECLARE
  v_investigator_id UUID;
  v_submitter_id UUID;
  v_team_members UUID[];
BEGIN
  -- Get case details
  SELECT assigned_investigator_id, user_id
  INTO v_investigator_id, v_submitter_id
  FROM cases
  WHERE id = p_case_id;
  
  IF p_community_approves THEN
    -- Community agrees with investigator
    -- Reward investigator (moderate amount)
    PERFORM reward_investigator_reputation(v_investigator_id, 15);
    
    -- Penalize submitter for invalid dispute
    PERFORM penalize_submitter_trust(v_submitter_id, 10);
    
    -- Update case status
    UPDATE cases
    SET status = 'RESOLVED',
        updated_at = NOW()
    WHERE id = p_case_id;
    
    -- Release escrow to investigator
    PERFORM release_case_escrow(p_case_id, v_investigator_id);
  ELSE
    -- Community disagrees with investigator
    -- Penalize investigator
    PERFORM penalize_investigator_reputation(v_investigator_id, 15);
    
    -- Refund submitter (no reputation penalty)
    UPDATE cases
    SET status = 'OPEN',
        assigned_investigator_id = NULL,
        updated_at = NOW()
    WHERE id = p_case_id;
    
    -- Refund escrow to all donors
    PERFORM refund_case_escrow(p_case_id);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Admin resolves dispute (overrides community vote)
CREATE OR REPLACE FUNCTION admin_resolve_dispute(
  p_case_id UUID,
  p_admin_decision TEXT, -- 'RELEASE' | 'REFUND' | 'VOTE'
  p_admin_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_investigator_id UUID;
  v_submitter_id UUID;
BEGIN
  -- Get case details
  SELECT assigned_investigator_id, user_id
  INTO v_investigator_id, v_submitter_id
  FROM cases
  WHERE id = p_case_id;
  
  CASE p_admin_decision
    WHEN 'RELEASE' THEN
      -- Admin approves investigator's work
      PERFORM reward_investigator_reputation(v_investigator_id, 20);
      PERFORM penalize_submitter_trust(v_submitter_id, 15);
      
      UPDATE cases
      SET status = 'RESOLVED',
          updated_at = NOW()
      WHERE id = p_case_id;
      
      -- Release escrow to investigator
      PERFORM release_case_escrow(p_case_id, v_investigator_id);
      
    WHEN 'REFUND' THEN
      -- Admin rejects investigator's work
      PERFORM penalize_investigator_reputation(v_investigator_id, 20);
      
      UPDATE cases
      SET status = 'OPEN',
          assigned_investigator_id = NULL,
          updated_at = NOW()
      WHERE id = p_case_id;
      
      -- Refund escrow to donors
      PERFORM refund_case_escrow(p_case_id);
      
    WHEN 'VOTE' THEN
      -- Send to community voting
      UPDATE cases
      SET status = 'VOTING',
          updated_at = NOW()
      WHERE id = p_case_id;
  END CASE;
  
  -- Log admin action
  INSERT INTO admin_actions (admin_id, case_id, action_type, created_at)
  VALUES (p_admin_id, p_case_id, p_admin_decision, NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create admin actions log table if it doesn't exist
CREATE TABLE IF NOT EXISTS admin_actions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policy for admin actions
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view all admin actions" ON admin_actions;
CREATE POLICY "Admins view all admin actions" ON admin_actions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
