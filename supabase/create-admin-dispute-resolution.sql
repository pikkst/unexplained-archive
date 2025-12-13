-- Create admin function to resolve disputes
-- This function allows admins to review and resolve disputed cases

CREATE OR REPLACE FUNCTION admin_resolve_dispute(
  p_case_id UUID,
  p_admin_id UUID,
  p_resolution TEXT,
  p_approve_investigator BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_case RECORD;
  v_investigator_id UUID;
  v_submitter_id UUID;
  v_platform_fee DECIMAL(10,2);
  v_investigator_payout DECIMAL(10,2);
BEGIN
  -- Get case details
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

  IF v_case.status != 'DISPUTED' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Case is not disputed'
    );
  END IF;

  v_investigator_id := v_case.case_investigator_id;
  v_submitter_id := v_case.case_submitter_id;

  IF p_approve_investigator THEN
    -- Admin approves investigator's work
    v_platform_fee := v_case.reward_amount * 0.10;
    v_investigator_payout := v_case.reward_amount - v_platform_fee;

    -- Update case to RESOLVED
    UPDATE cases
    SET 
      status = 'RESOLVED',
      updated_at = NOW()
    WHERE id = p_case_id;

    -- Release payment to investigator
    IF v_case.reward_amount > 0 AND v_investigator_id IS NOT NULL THEN
      UPDATE wallets
      SET 
        balance = balance + v_investigator_payout,
        updated_at = NOW()
      WHERE user_id = v_investigator_id;

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
          'description', 'Admin resolved dispute in favor of investigator',
          'admin_id', p_admin_id,
          'admin_notes', p_resolution
        ),
        NOW(),
        NOW();

      -- Remove from submitter's reserved
      UPDATE wallets
      SET 
        reserved = reserved - v_case.reward_amount,
        updated_at = NOW()
      WHERE user_id = v_submitter_id;
    END IF;

    -- Notify investigator
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      case_id,
      created_at
    ) VALUES (
      v_investigator_id,
      'dispute_resolved',
      'Dispute Resolved in Your Favor ✅',
      'An admin has reviewed the dispute and approved your investigation. Payment has been released.',
      p_case_id,
      NOW()
    );

    -- Notify submitter
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      case_id,
      created_at
    ) VALUES (
      v_submitter_id,
      'dispute_resolved',
      'Dispute Resolved',
      'An admin has reviewed your dispute. The investigator''s work has been approved.',
      p_case_id,
      NOW()
    );

  ELSE
    -- Admin approves submitter (refund)
    UPDATE cases
    SET 
      status = 'OPEN',
      assigned_investigator_id = NULL,
      investigator_id = NULL,
      updated_at = NOW()
    WHERE id = p_case_id;

    -- Refund submitter (money stays in reserved, case reopens)
    -- Notify investigator
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      case_id,
      created_at
    ) VALUES (
      v_investigator_id,
      'dispute_resolved',
      'Dispute Resolved - Investigation Not Approved ⚠️',
      'An admin has reviewed the dispute and did not approve your investigation. The case has been reopened.',
      p_case_id,
      NOW()
    );

    -- Notify submitter
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      case_id,
      created_at
    ) VALUES (
      v_submitter_id,
      'dispute_resolved',
      'Dispute Resolved in Your Favor ✅',
      'An admin has reviewed your dispute and the case has been reopened for a new investigation.',
      p_case_id,
      NOW()
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'approved_investigator', p_approve_investigator,
    'admin_notes', p_resolution
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute to authenticated users with proper role check
GRANT EXECUTE ON FUNCTION admin_resolve_dispute(UUID, UUID, TEXT, BOOLEAN) TO authenticated;

-- Test
SELECT 'Admin dispute resolution function created successfully!' as status;
