-- =============================================
-- ESCROW RELEASE SYSTEM
-- Run this in Supabase SQL Editor AFTER setup-stripe-database-functions.sql
-- =============================================

-- Function: Release escrow funds to investigator(s) when case resolved
CREATE OR REPLACE FUNCTION release_case_escrow(
  p_case_id UUID,
  p_investigator_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_escrow_amount DECIMAL;
  v_investigator_wallet_id UUID;
  v_team_members JSONB;
  v_team_member JSONB;
  v_member_share DECIMAL;
  v_total_shares INTEGER;
  result JSONB;
BEGIN
  -- Get case escrow amount
  SELECT current_escrow INTO v_escrow_amount
  FROM cases
  WHERE id = p_case_id;
  
  IF v_escrow_amount IS NULL OR v_escrow_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No escrow funds available'
    );
  END IF;
  
  -- Get investigator's wallet
  SELECT id INTO v_investigator_wallet_id
  FROM wallets
  WHERE user_id = p_investigator_id;
  
  IF v_investigator_wallet_id IS NULL THEN
    -- Create wallet if doesn't exist
    INSERT INTO wallets (user_id, balance)
    VALUES (p_investigator_id, 0)
    RETURNING id INTO v_investigator_wallet_id;
  END IF;
  
  -- Check if this is a team case
  SELECT team_reward_split INTO v_team_members
  FROM cases
  WHERE id = p_case_id;
  
  IF v_team_members IS NOT NULL AND jsonb_array_length(v_team_members) > 0 THEN
    -- Team case - split rewards according to team_reward_split
    FOR v_team_member IN SELECT * FROM jsonb_array_elements(v_team_members)
    LOOP
      DECLARE
        v_member_id UUID;
        v_member_wallet_id UUID;
        v_share_percentage DECIMAL;
        v_share_amount DECIMAL;
      BEGIN
        v_member_id := (v_team_member->>'user_id')::UUID;
        v_share_percentage := (v_team_member->>'share')::DECIMAL / 100.0;
        v_share_amount := v_escrow_amount * v_share_percentage;
        
        -- Get member's wallet
        SELECT id INTO v_member_wallet_id
        FROM wallets
        WHERE user_id = v_member_id;
        
        IF v_member_wallet_id IS NULL THEN
          INSERT INTO wallets (user_id, balance)
          VALUES (v_member_id, 0)
          RETURNING id INTO v_member_wallet_id;
        END IF;
        
        -- Add funds to member's wallet
        PERFORM add_wallet_balance(v_member_wallet_id, v_share_amount);
        
        -- Create transaction record
        INSERT INTO transactions (
          to_wallet_id,
          case_id,
          transaction_type,
          amount,
          status,
          completed_at,
          description,
          metadata
        ) VALUES (
          v_member_wallet_id,
          p_case_id,
          'reward',
          v_share_amount,
          'completed',
          NOW(),
          'Case resolution reward (team member)',
          jsonb_build_object(
            'share_percentage', v_share_percentage * 100,
            'total_escrow', v_escrow_amount
          )
        );
      END;
    END LOOP;
  ELSE
    -- Solo investigator - release full amount
    PERFORM add_wallet_balance(v_investigator_wallet_id, v_escrow_amount);
    
    -- Create transaction record
    INSERT INTO transactions (
      to_wallet_id,
      case_id,
      transaction_type,
      amount,
      status,
      completed_at,
      description
    ) VALUES (
      v_investigator_wallet_id,
      p_case_id,
      'reward',
      v_escrow_amount,
      'completed',
      NOW(),
      'Case resolution reward'
    );
  END IF;
  
  -- Clear case escrow
  UPDATE cases
  SET current_escrow = 0,
      escrow_released = true,
      escrow_released_at = NOW(),
      updated_at = NOW()
  WHERE id = p_case_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'amount_released', v_escrow_amount,
    'team_split', v_team_members IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Refund escrow to donors when case rejected/failed
CREATE OR REPLACE FUNCTION refund_case_escrow(
  p_case_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_escrow_amount DECIMAL;
  v_donation_tx RECORD;
  v_refund_amount DECIMAL;
  v_donor_wallet_id UUID;
  v_total_refunded DECIMAL := 0;
BEGIN
  -- Get case escrow amount
  SELECT current_escrow INTO v_escrow_amount
  FROM cases
  WHERE id = p_case_id;
  
  IF v_escrow_amount IS NULL OR v_escrow_amount <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No escrow funds to refund'
    );
  END IF;
  
  -- Find all donation transactions for this case
  FOR v_donation_tx IN 
    SELECT 
      t.id,
      t.amount,
      t.metadata->>'userId' as user_id,
      t.metadata->>'netAmount' as net_amount
    FROM transactions t
    WHERE t.case_id = p_case_id
      AND t.transaction_type = 'donation'
      AND t.status = 'completed'
  LOOP
    -- Refund the net amount (what actually went into escrow)
    v_refund_amount := COALESCE((v_donation_tx.net_amount)::DECIMAL, v_donation_tx.amount);
    
    -- Get or create donor's wallet
    SELECT id INTO v_donor_wallet_id
    FROM wallets
    WHERE user_id = v_donation_tx.user_id::UUID;
    
    IF v_donor_wallet_id IS NULL THEN
      INSERT INTO wallets (user_id, balance)
      VALUES (v_donation_tx.user_id::UUID, 0)
      RETURNING id INTO v_donor_wallet_id;
    END IF;
    
    -- Add refund to donor's wallet
    PERFORM add_wallet_balance(v_donor_wallet_id, v_refund_amount);
    v_total_refunded := v_total_refunded + v_refund_amount;
    
    -- Create refund transaction record
    INSERT INTO transactions (
      to_wallet_id,
      case_id,
      transaction_type,
      amount,
      status,
      completed_at,
      description,
      metadata
    ) VALUES (
      v_donor_wallet_id,
      p_case_id,
      'refund',
      v_refund_amount,
      'completed',
      NOW(),
      'Case escrow refund - investigation rejected',
      jsonb_build_object(
        'original_transaction_id', v_donation_tx.id,
        'reason', 'investigation_rejected'
      )
    );
  END LOOP;
  
  -- Clear case escrow
  UPDATE cases
  SET current_escrow = 0,
      escrow_refunded = true,
      escrow_refunded_at = NOW(),
      updated_at = NOW()
  WHERE id = p_case_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'total_refunded', v_total_refunded,
    'original_escrow', v_escrow_amount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add new columns to cases table if they don't exist
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS escrow_released BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS escrow_released_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS escrow_refunded BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS escrow_refunded_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS team_reward_split JSONB; -- Format: [{"user_id": "uuid", "share": 50}]
