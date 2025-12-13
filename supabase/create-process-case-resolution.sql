-- Create the correct process_case_resolution function
-- This function handles case resolution when user accepts or disputes investigator's work

CREATE OR REPLACE FUNCTION process_case_resolution(
  p_case_id UUID,
  p_investigator_id UUID,
  p_submitter_id UUID,
  p_user_rating INTEGER,
  p_resolution_accepted BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_case RECORD;
  v_escrow_amount DECIMAL(10,2);
  v_platform_fee DECIMAL(10,2);
  v_investigator_payout DECIMAL(10,2);
  v_reputation_points INTEGER;
BEGIN
  -- Get case details
  SELECT * INTO v_case
  FROM cases
  WHERE id = p_case_id;

  IF v_case IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Case not found'
    );
  END IF;

  -- Verify case is in correct status
  IF v_case.status != 'UNDER_INVESTIGATION' AND v_case.status != 'PENDING_REVIEW' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Case is not ready for resolution'
    );
  END IF;

  IF p_resolution_accepted THEN
    -- User accepts the resolution
    
    -- Calculate reputation based on rating (1-5 stars = 5-25 points)
    v_reputation_points := p_user_rating * 5;
    
    -- Update case status and rating
    UPDATE cases
    SET 
      status = 'RESOLVED',
      user_rating = p_user_rating,
      resolved_at = NOW(),
      updated_at = NOW()
    WHERE id = p_case_id;

    -- Release escrow payment to investigator
    IF v_case.reward_amount > 0 THEN
      -- Calculate platform fee (10%)
      v_platform_fee := v_case.reward_amount * 0.10;
      v_investigator_payout := v_case.reward_amount - v_platform_fee;

      -- Transfer from escrow to investigator wallet
      UPDATE wallets
      SET 
        balance = balance + v_investigator_payout,
        total_earnings = total_earnings + v_investigator_payout,
        updated_at = NOW()
      WHERE user_id = p_investigator_id;

      -- Record transaction for investigator
      INSERT INTO transactions (
        user_id,
        type,
        amount,
        status,
        description,
        case_id,
        created_at
      ) VALUES (
        p_investigator_id,
        'CASE_RESOLUTION_PAYOUT',
        v_investigator_payout,
        'COMPLETED',
        'Payment received for resolving case: ' || v_case.title,
        p_case_id,
        NOW()
      );

      -- Record platform fee
      INSERT INTO transactions (
        user_id,
        type,
        amount,
        status,
        description,
        case_id,
        created_at
      ) VALUES (
        p_investigator_id,
        'PLATFORM_FEE',
        -v_platform_fee,
        'COMPLETED',
        'Platform fee for case resolution',
        p_case_id,
        NOW()
      );

      -- Update submitter's wallet escrow
      UPDATE wallets
      SET 
        escrow_balance = escrow_balance - v_case.reward_amount,
        updated_at = NOW()
      WHERE user_id = p_submitter_id;
    END IF;

    -- Award reputation to investigator
    IF EXISTS (SELECT 1 FROM reputation WHERE user_id = p_investigator_id) THEN
      UPDATE reputation
      SET 
        total_points = total_points + v_reputation_points,
        cases_resolved = cases_resolved + 1,
        updated_at = NOW()
      WHERE user_id = p_investigator_id;
    ELSE
      INSERT INTO reputation (
        user_id,
        total_points,
        cases_resolved,
        created_at,
        updated_at
      ) VALUES (
        p_investigator_id,
        v_reputation_points,
        1,
        NOW(),
        NOW()
      );
    END IF;

    -- Small reputation reward to submitter for valid case
    IF EXISTS (SELECT 1 FROM reputation WHERE user_id = p_submitter_id) THEN
      UPDATE reputation
      SET 
        total_points = total_points + 2,
        updated_at = NOW()
      WHERE user_id = p_submitter_id;
    ELSE
      INSERT INTO reputation (
        user_id,
        total_points,
        created_at,
        updated_at
      ) VALUES (
        p_submitter_id,
        2,
        NOW(),
        NOW()
      );
    END IF;

    -- Create notification for investigator
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      case_id,
      created_at
    ) VALUES (
      p_investigator_id,
      'CASE_RESOLVED',
      'Case Resolution Accepted',
      'Your investigation has been accepted with ' || p_user_rating || ' stars! Payment has been released to your wallet.',
      p_case_id,
      NOW()
    );

    RETURN jsonb_build_object(
      'success', true,
      'status', 'RESOLVED',
      'investigator_payout', v_investigator_payout,
      'platform_fee', v_platform_fee,
      'reputation_earned', v_reputation_points
    );

  ELSE
    -- User disputes the resolution
    UPDATE cases
    SET 
      status = 'DISPUTED',
      updated_at = NOW()
    WHERE id = p_case_id;

    -- Create notification for investigator
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      case_id,
      created_at
    ) VALUES (
      p_investigator_id,
      'CASE_DISPUTED',
      'Case Resolution Disputed',
      'The submitter has disputed your investigation. The case will be reviewed.',
      p_case_id,
      NOW()
    );

    -- Create notification for admins (this would need admin role check)
    -- For now, we'll just return success

    RETURN jsonb_build_object(
      'success', true,
      'status', 'DISPUTED'
    );
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION process_case_resolution(UUID, UUID, UUID, INTEGER, BOOLEAN) TO authenticated;

-- Test the function exists
SELECT 
  'Function created successfully' as status,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'process_case_resolution'
AND n.nspname = 'public';
