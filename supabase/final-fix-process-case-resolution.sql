-- Fix process_case_resolution to use correct column names
-- wallets: balance, reserved (not escrow_balance, total_earnings)
-- transactions: transaction_type (not type), metadata (not description)

CREATE OR REPLACE FUNCTION process_case_resolution(
  p_case_id UUID,
  p_investigator_id UUID,
  p_submitter_id UUID,
  p_user_rating INTEGER,
  p_resolution_accepted BOOLEAN,
  p_user_feedback TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_case RECORD;
  v_platform_fee DECIMAL(10,2);
  v_investigator_payout DECIMAL(10,2);
  v_reputation_points INTEGER;
  v_investigator_id UUID;
  v_submitter_id UUID;
BEGIN
  -- Get case details (using correct column names)
  SELECT 
    c.*,
    c.user_id as case_submitter_id,
    COALESCE(c.assigned_investigator_id, c.investigator_id) as case_investigator_id
  INTO v_case
  FROM cases c
  WHERE c.id = p_case_id;

  IF v_case IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Case not found'
    );
  END IF;

  v_investigator_id := v_case.case_investigator_id;
  v_submitter_id := v_case.case_submitter_id;

  -- Verify case is in correct status
  IF v_case.status NOT IN ('UNDER_INVESTIGATION', 'PENDING_REVIEW') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Case is not ready for resolution. Current status: ' || COALESCE(v_case.status, 'NULL')
    );
  END IF;

  IF p_resolution_accepted THEN
    -- User accepts the resolution
    
    -- Calculate reputation based on rating (1-5 stars = 5-25 points)
    v_reputation_points := p_user_rating * 5;
    
    -- Update case status, rating and feedback
    UPDATE cases
    SET 
      status = 'RESOLVED',
      user_rating = p_user_rating,
      user_feedback = p_user_feedback,
      updated_at = NOW()
    WHERE id = p_case_id;

    -- Release escrow payment to investigator
    IF v_case.reward_amount > 0 AND v_investigator_id IS NOT NULL THEN
      -- Calculate platform fee (10%)
      v_platform_fee := v_case.reward_amount * 0.10;
      v_investigator_payout := v_case.reward_amount - v_platform_fee;

      -- Transfer from reserved to investigator balance
      UPDATE wallets
      SET 
        balance = balance + v_investigator_payout,
        updated_at = NOW()
      WHERE user_id = v_investigator_id;

      -- Get wallet IDs for transaction
      INSERT INTO transactions (
        user_id,
        from_wallet_id,
        to_wallet_id,
        amount,
        currency,
        transaction_type,
        status,
        case_id,
        metadata,
        created_at,
        completed_at
      )
      SELECT
        v_investigator_id,
        (SELECT id FROM wallets WHERE user_id = v_submitter_id),
        (SELECT id FROM wallets WHERE user_id = v_investigator_id),
        v_investigator_payout,
        'EUR',
        'case_reward',
        'completed',
        p_case_id,
        jsonb_build_object(
          'description', 'Payment received for resolving case: ' || v_case.title,
          'rating', p_user_rating,
          'platform_fee', v_platform_fee
        ),
        NOW(),
        NOW();

      -- Update submitter's wallet - remove from reserved
      UPDATE wallets
      SET 
        reserved = reserved - v_case.reward_amount,
        updated_at = NOW()
      WHERE user_id = v_submitter_id;
    END IF;

    -- Award reputation to investigator
    IF v_investigator_id IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM reputation WHERE user_id = v_investigator_id) THEN
        UPDATE reputation
        SET 
          total_points = total_points + v_reputation_points,
          cases_resolved = cases_resolved + 1,
          updated_at = NOW()
        WHERE user_id = v_investigator_id;
      ELSE
        INSERT INTO reputation (
          user_id,
          total_points,
          cases_resolved,
          created_at,
          updated_at
        ) VALUES (
          v_investigator_id,
          v_reputation_points,
          1,
          NOW(),
          NOW()
        );
      END IF;
    END IF;

    -- Small reputation reward to submitter for valid case
    IF EXISTS (SELECT 1 FROM reputation WHERE user_id = v_submitter_id) THEN
      UPDATE reputation
      SET 
        total_points = total_points + 2,
        updated_at = NOW()
      WHERE user_id = v_submitter_id;
    ELSE
      INSERT INTO reputation (
        user_id,
        total_points,
        created_at,
        updated_at
      ) VALUES (
        v_submitter_id,
        2,
        NOW(),
        NOW()
      );
    END IF;

    -- Create notification for investigator
    IF v_investigator_id IS NOT NULL THEN
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        case_id,
        created_at
      ) VALUES (
        v_investigator_id,
        'case_resolved',
        'Case Resolution Accepted ✅',
        'Your investigation has been accepted with ' || p_user_rating || ' stars! Payment of €' || v_investigator_payout || ' has been released to your wallet.',
        p_case_id,
        NOW()
      );
    END IF;

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
    IF v_investigator_id IS NOT NULL THEN
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        case_id,
        created_at
      ) VALUES (
        v_investigator_id,
        'case_disputed',
        'Case Resolution Disputed ⚠️',
        'The submitter has disputed your investigation. The case will be reviewed by administrators.',
        p_case_id,
        NOW()
      );
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'DISPUTED'
    );
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE,
      'hint', 'Check error logs for details'
    );
END;
$$;

-- Re-grant execute permission (with new signature including feedback)
GRANT EXECUTE ON FUNCTION process_case_resolution(UUID, UUID, UUID, INTEGER, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION process_case_resolution(UUID, UUID, UUID, INTEGER, BOOLEAN) TO authenticated;

-- Test query
SELECT 'Function fixed with correct column names!' as status;
