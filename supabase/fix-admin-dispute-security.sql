-- FIX: Add admin role verification to admin_resolve_dispute function
-- CRITICAL SECURITY PATCH: Prevent non-admins from resolving disputes

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
  v_is_admin BOOLEAN;
BEGIN
  -- ✅ CRITICAL SECURITY CHECK: Verify caller is admin
  SELECT role = 'admin' INTO v_is_admin
  FROM profiles
  WHERE id = p_admin_id;
  
  IF NOT v_is_admin OR v_is_admin IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Admin role required'
    );
  END IF;
  
  -- ✅ Additional check: Verify p_admin_id matches the authenticated user
  IF p_admin_id != auth.uid() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: admin_id does not match authenticated user'
    );
  END IF;

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

      -- Record platform fee revenue
      INSERT INTO platform_revenue (
        revenue_type,
        amount,
        currency,
        transaction_id,
        case_id,
        description,
        created_at
      )
      SELECT
        'platform_fee',
        v_platform_fee,
        'EUR',
        (SELECT id FROM transactions WHERE case_id = p_case_id ORDER BY created_at DESC LIMIT 1),
        p_case_id,
        'Platform fee from case reward (10%)',
        NOW();
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Dispute resolved in favor of investigator. Funds released.',
      'case_id', p_case_id,
      'investigator_payout', v_investigator_payout,
      'platform_fee', v_platform_fee
    );

  ELSE
    -- Admin rejects investigator's work - refund submitter
    UPDATE cases
    SET 
      status = 'OPEN',
      assigned_investigator_id = NULL,
      investigator_id = NULL,
      updated_at = NOW()
    WHERE id = p_case_id;

    -- Refund submitter - move from reserved back to balance
    IF v_case.reward_amount > 0 AND v_submitter_id IS NOT NULL THEN
      UPDATE wallets
      SET 
        balance = balance + v_case.reward_amount,
        reserved = reserved - v_case.reward_amount,
        updated_at = NOW()
      WHERE user_id = v_submitter_id;

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
        v_submitter_id,
        (SELECT id FROM wallets WHERE user_id = v_submitter_id),
        (SELECT id FROM wallets WHERE user_id = v_submitter_id),
        v_case.reward_amount,
        'EUR',
        'refund',
        'completed',
        p_case_id,
        jsonb_build_object(
          'description', 'Admin resolved dispute in favor of submitter. Case reopened.',
          'admin_id', p_admin_id,
          'admin_notes', p_resolution
        ),
        NOW(),
        NOW();
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Dispute resolved in favor of submitter. Case reopened.',
      'case_id', p_case_id,
      'refund_amount', v_case.reward_amount
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

COMMENT ON FUNCTION admin_resolve_dispute IS 'Admin-only function to resolve disputed cases. Verifies admin role before execution.';
