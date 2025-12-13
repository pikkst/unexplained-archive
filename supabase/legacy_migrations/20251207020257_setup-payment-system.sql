-- Payment System Implementation with ESCROW
-- Direct payments via Stripe → Platform Wallet → Escrow → Release on resolution
-- Run this in Supabase SQL Editor

-- 1. Make user_id nullable for platform wallet (system account)
ALTER TABLE wallets ALTER COLUMN user_id DROP NOT NULL;

-- 2. Create platform wallet (system wallet for escrow)
INSERT INTO wallets (id, user_id, balance, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001', -- Fixed UUID for platform wallet
  NULL, -- System wallet, no user owner
  0,
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 2. Update transactions table for new payment flow
ALTER TABLE transactions 
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_charge_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_refund_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS escrow_status TEXT DEFAULT NULL; -- 'held', 'released', 'refunded'

-- 2. Add indexes for Stripe lookups
CREATE INDEX IF NOT EXISTS idx_transactions_stripe_payment_intent 
  ON transactions(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_transactions_stripe_session 
  ON transactions(stripe_session_id);

-- 3. Update subscriptions table
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer 
  ON subscriptions(stripe_customer_id);

-- 4. Drop old wallet constraint (will use trigger for validation instead)
DO $$
BEGIN
  -- Drop old constraint if exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'wallets_investigator_only'
  ) THEN
    ALTER TABLE wallets DROP CONSTRAINT wallets_investigator_only;
  END IF;
  
  -- Drop new constraint if exists (can't use subqueries in CHECK)
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'wallets_valid_owner'
  ) THEN
    ALTER TABLE wallets DROP CONSTRAINT wallets_valid_owner;
  END IF;
END $$;

-- 4b. Create trigger to validate wallet owner
CREATE OR REPLACE FUNCTION validate_wallet_owner()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow NULL user_id for system wallet
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if user exists and is investigator or admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = NEW.user_id 
    AND role IN ('investigator', 'admin')
  ) THEN
    RAISE EXCEPTION 'Wallets can only be created for investigators, admins, or system (NULL user_id)';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_wallet_owner_trigger ON wallets;
CREATE TRIGGER validate_wallet_owner_trigger
  BEFORE INSERT OR UPDATE ON wallets
  FOR EACH ROW
  EXECUTE FUNCTION validate_wallet_owner();

-- 5. Function to process direct donation (with ESCROW)
CREATE OR REPLACE FUNCTION process_direct_donation(
  p_case_id UUID,
  p_amount DECIMAL,
  p_stripe_payment_intent_id TEXT,
  p_stripe_charge_id TEXT,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_transaction_id UUID;
  v_platform_fee DECIMAL;
  v_net_amount DECIMAL;
  v_platform_wallet_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
  -- Calculate platform fee (10%)
  v_platform_fee := p_amount * 0.10;
  v_net_amount := p_amount - v_platform_fee;
  
  -- Create transaction record (money goes to ESCROW in platform wallet)
  INSERT INTO transactions (
    transaction_type,
    amount,
    currency,
    user_id,
    case_id,
    to_wallet_id,
    stripe_payment_intent_id,
    stripe_charge_id,
    status,
    escrow_status,
    metadata
  ) VALUES (
    'donation',
    p_amount,
    'EUR',
    p_user_id,
    p_case_id,
    v_platform_wallet_id, -- Goes to platform wallet as ESCROW
    p_stripe_payment_intent_id,
    p_stripe_charge_id,
    'completed',
    'held', -- Held in escrow until case resolved
    jsonb_build_object(
      'platform_fee', v_platform_fee,
      'net_amount', v_net_amount,
      'payment_method', 'stripe',
      'escrow_note', 'Funds held until case resolution confirmed'
    )
  ) RETURNING id INTO v_transaction_id;
  
  -- Update case reward pool (shown to users, but held in escrow)
  UPDATE cases 
  SET reward = reward + v_net_amount
  WHERE id = p_case_id;
  
  -- Update platform wallet balance
  UPDATE wallets
  SET balance = balance + v_net_amount
  WHERE id = v_platform_wallet_id;
  
  -- Record platform fee
  INSERT INTO transactions (
    transaction_type,
    amount,
    currency,
    case_id,
    to_wallet_id,
    status,
    metadata
  ) VALUES (
    'platform_fee',
    v_platform_fee,
    'EUR',
    p_case_id,
    v_platform_wallet_id,
    'completed',
    jsonb_build_object(
      'fee_type', 'donation',
      'source_transaction_id', v_transaction_id
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'net_amount', v_net_amount,
    'escrow_status', 'held'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Function to release escrow to investigator (when submitter approves)
-- UPDATED: Now supports team reward distribution
CREATE OR REPLACE FUNCTION release_escrow_to_investigator(
  p_case_id UUID,
  p_approved_by UUID
)
RETURNS JSONB AS $$
DECLARE
  v_case RECORD;
  v_investigator_wallet_id UUID;
  v_platform_wallet_id UUID := '00000000-0000-0000-0000-000000000001';
  v_platform_fee DECIMAL;
  v_investigator_amount DECIMAL;
  v_total_escrow DECIMAL;
  v_is_team_case BOOLEAN;
BEGIN
  -- Get case details
  SELECT * INTO v_case FROM cases WHERE id = p_case_id;
  
  IF v_case IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Case not found');
  END IF;
  
  IF v_case.status != 'RESOLVED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Case must be in RESOLVED status');
  END IF;
  
  IF v_case.assigned_investigator_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No investigator assigned');
  END IF;
  
  -- Verify approver is case submitter
  IF p_approved_by != v_case.submitted_by_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only case submitter can approve resolution');
  END IF;
  
  -- Calculate amounts (15% platform fee on resolution)
  v_total_escrow := v_case.reward;
  v_platform_fee := v_total_escrow * 0.15;
  v_investigator_amount := v_total_escrow - v_platform_fee;
  
  -- Check if this is a team case
  SELECT is_team_case INTO v_is_team_case FROM cases WHERE id = p_case_id;
  
  IF v_is_team_case THEN
    -- TEAM DISTRIBUTION: Use distribute_team_reward function
    PERFORM distribute_team_reward(p_case_id, v_investigator_amount);
  ELSE
    -- SINGLE INVESTIGATOR: Original logic
    -- Get or create investigator wallet
    INSERT INTO wallets (user_id, balance)
    VALUES (v_case.assigned_investigator_id, 0)
    ON CONFLICT (user_id) DO NOTHING;
    
    SELECT id INTO v_investigator_wallet_id 
    FROM wallets 
    WHERE user_id = v_case.assigned_investigator_id;
    
    -- Transfer to investigator wallet
    UPDATE wallets 
    SET 
      balance = balance + v_investigator_amount,
      total_earned = total_earned + v_investigator_amount
    WHERE id = v_investigator_wallet_id;
    
    -- Create payout transaction
    INSERT INTO transactions (
      transaction_type,
      amount,
      currency,
      case_id,
      from_wallet_id,
      to_wallet_id,
      user_id,
      status,
      metadata
    ) VALUES (
      'case_reward',
      v_investigator_amount,
      'EUR',
      p_case_id,
      v_platform_wallet_id,
      v_investigator_wallet_id,
      v_case.assigned_investigator_id,
      'completed',
      jsonb_build_object(
        'platform_fee', v_platform_fee,
        'gross_amount', v_total_escrow,
        'approved_by', p_approved_by,
        'approved_at', NOW()
      )
    );
  END IF;
  
  -- Deduct from platform wallet (common for both single and team)
  UPDATE wallets 
  SET balance = balance - v_total_escrow
  WHERE id = v_platform_wallet_id;
  
  -- Update donation transactions escrow status
  UPDATE transactions
  SET 
    escrow_status = 'released',
    metadata = metadata || jsonb_build_object(
      'released_at', NOW(),
      'approved_by', p_approved_by,
      'is_team_case', v_is_team_case
    )
  WHERE case_id = p_case_id 
  AND type = 'donation' 
  AND escrow_status = 'held';
  
  -- Record platform fee
  INSERT INTO transactions (
    type,
    amount,
    currency,
    case_id,
    status,
    metadata
  ) VALUES (
    'platform_fee',
    v_platform_fee,
    'EUR',
    p_case_id,
    'completed',
    jsonb_build_object(
      'fee_type', 'case_resolution',
      'case_id', p_case_id
    )
  );
  
  -- Update case status to CLOSED
  UPDATE cases 
  SET status = 'CLOSED'
  WHERE id = p_case_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'investigator_amount', v_investigator_amount,
    'platform_fee', v_platform_fee,
    'escrow_released', true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function to reject resolution and escalate to admin
CREATE OR REPLACE FUNCTION reject_resolution_escalate_admin(
  p_case_id UUID,
  p_rejected_by UUID,
  p_rejection_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_case RECORD;
BEGIN
  -- Get case details
  SELECT * INTO v_case FROM cases WHERE id = p_case_id;
  
  IF v_case IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Case not found');
  END IF;
  
  -- Verify rejecter is case submitter
  IF p_rejected_by != v_case.submitted_by_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only case submitter can reject resolution');
  END IF;
  
  -- Update case status to DISPUTED
  UPDATE cases 
  SET 
    status = 'DISPUTED',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'dispute_raised_at', NOW(),
      'dispute_raised_by', p_rejected_by,
      'rejection_reason', p_rejection_reason,
      'awaiting_admin_review', true
    )
  WHERE id = p_case_id;
  
  -- Create dispute record
  INSERT INTO transactions (
    transaction_type,
    amount,
    currency,
    case_id,
    user_id,
    status,
    metadata
  ) VALUES (
    'dispute',
    0,
    'EUR',
    p_case_id,
    p_rejected_by,
    'pending',
    jsonb_build_object(
      'reason', p_rejection_reason,
      'created_at', NOW(),
      'status', 'awaiting_admin_review'
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'case_status', 'DISPUTED',
    'escalated_to_admin', true,
    'escrow_status', 'held'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function for admin to resolve dispute (release to investigator)
CREATE OR REPLACE FUNCTION admin_resolve_dispute_release(
  p_case_id UUID,
  p_admin_id UUID,
  p_admin_notes TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Verify admin role
  SELECT role = 'admin' INTO v_is_admin 
  FROM profiles 
  WHERE id = p_admin_id;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can resolve disputes');
  END IF;
  
  -- Update case metadata
  UPDATE cases
  SET metadata = metadata || jsonb_build_object(
    'admin_resolved_at', NOW(),
    'admin_resolved_by', p_admin_id,
    'admin_notes', p_admin_notes,
    'resolution_decision', 'approved'
  )
  WHERE id = p_case_id;
  
  -- Release escrow to investigator
  RETURN release_escrow_to_investigator(p_case_id, p_admin_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Function for admin to resolve dispute (refund to submitter)
CREATE OR REPLACE FUNCTION admin_resolve_dispute_refund(
  p_case_id UUID,
  p_admin_id UUID,
  p_admin_notes TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_case RECORD;
  v_platform_wallet_id UUID := '00000000-0000-0000-0000-000000000001';
  v_refund_amount DECIMAL;
  v_handling_fee DECIMAL;
  v_net_refund DECIMAL;
BEGIN
  -- Verify admin role
  SELECT role = 'admin' INTO v_is_admin 
  FROM profiles 
  WHERE id = p_admin_id;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can resolve disputes');
  END IF;
  
  -- Get case details
  SELECT * INTO v_case FROM cases WHERE id = p_case_id;
  
  -- Calculate refund (5% handling fee)
  v_refund_amount := v_case.reward;
  v_handling_fee := v_refund_amount * 0.05;
  v_net_refund := v_refund_amount - v_handling_fee;
  
  -- Update platform wallet (remove escrow)
  UPDATE wallets 
  SET balance = balance - v_refund_amount + v_handling_fee
  WHERE id = v_platform_wallet_id;
  
  -- Mark donation transactions as refunded
  UPDATE transactions
  SET 
    escrow_status = 'refunded',
    metadata = metadata || jsonb_build_object(
      'refunded_at', NOW(),
      'refund_approved_by', p_admin_id,
      'handling_fee', v_handling_fee,
      'net_refund', v_net_refund
    )
  WHERE case_id = p_case_id 
  AND transaction_type = 'donation' 
  AND escrow_status = 'held';
  
  -- Create refund transaction
  INSERT INTO transactions (
    transaction_type,
    amount,
    currency,
    case_id,
    user_id,
    status,
    metadata
  ) VALUES (
    'refund',
    v_net_refund,
    'EUR',
    p_case_id,
    v_case.submitted_by_id,
    'completed',
    jsonb_build_object(
      'gross_amount', v_refund_amount,
      'handling_fee', v_handling_fee,
      'admin_notes', p_admin_notes,
      'refunded_by', p_admin_id
    )
  );
  
  -- Reduce investigator reputation
  UPDATE profiles
  SET 
    reputation_score = GREATEST(0, reputation_score - 50),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'last_dispute_loss', NOW(),
      'dispute_losses', COALESCE((metadata->>'dispute_losses')::int, 0) + 1
    )
  WHERE id = v_case.assigned_investigator_id;
  
  -- Update case
  UPDATE cases
  SET 
    status = 'CLOSED',
    metadata = metadata || jsonb_build_object(
      'admin_resolved_at', NOW(),
      'admin_resolved_by', p_admin_id,
      'admin_notes', p_admin_notes,
      'resolution_decision', 'refunded',
      'investigator_penalized', true
    )
  WHERE id = p_case_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'refund_amount', v_net_refund,
    'handling_fee', v_handling_fee,
    'investigator_penalized', true,
    'reputation_reduced', 50
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Function to send case to community voting
CREATE OR REPLACE FUNCTION send_case_to_community_vote(
  p_case_id UUID,
  p_admin_id UUID,
  p_voting_duration_days INT DEFAULT 7
)
RETURNS JSONB AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Verify admin role
  SELECT role = 'admin' INTO v_is_admin 
  FROM profiles 
  WHERE id = p_admin_id;
  
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only admins can initiate community vote');
  END IF;
  
  -- Update case status to VOTING
  UPDATE cases
  SET 
    status = 'VOTING',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'voting_started_at', NOW(),
      'voting_ends_at', NOW() + (p_voting_duration_days || ' days')::INTERVAL,
      'voting_initiated_by', p_admin_id,
      'votes_for_investigator', 0,
      'votes_for_refund', 0
    )
  WHERE id = p_case_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'case_status', 'VOTING',
    'voting_ends_at', NOW() + (p_voting_duration_days || ' days')::INTERVAL,
    'escrow_status', 'held'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
CREATE OR REPLACE FUNCTION process_case_resolution_payout(
  p_case_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_case RECORD;
  v_investigator_wallet_id UUID;
  v_platform_fee DECIMAL;
  v_investigator_amount DECIMAL;
BEGIN
  -- Get case details
  SELECT * INTO v_case FROM cases WHERE id = p_case_id;
  
  IF v_case IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Case not found');
  END IF;
  
  IF v_case.status != 'RESOLVED' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Case not resolved');
  END IF;
  
  IF v_case.assigned_investigator_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No investigator assigned');
  END IF;
  
  -- Calculate amounts (15% platform fee)
  v_platform_fee := v_case.reward * 0.15;
  v_investigator_amount := v_case.reward - v_platform_fee;
  
  -- Get or create investigator wallet
  INSERT INTO wallets (user_id, balance)
  VALUES (v_case.assigned_investigator_id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  SELECT id INTO v_investigator_wallet_id 
  FROM wallets 
  WHERE user_id = v_case.assigned_investigator_id;
  
  -- Create payout transaction
  INSERT INTO transactions (
    type,
    amount,
    currency,
    case_id,
    to_wallet_id,
    user_id,
    status,
    metadata
  ) VALUES (
    'case_reward',
    v_investigator_amount,
    'EUR',
    p_case_id,
    v_investigator_wallet_id,
    v_case.assigned_investigator_id,
    'completed',
    jsonb_build_object(
      'platform_fee', v_platform_fee,
      'gross_amount', v_case.reward
    )
  );
  
  -- Update wallet balance
  UPDATE wallets 
  SET 
    balance = balance + v_investigator_amount,
    total_earned = total_earned + v_investigator_amount
  WHERE id = v_investigator_wallet_id;
  
  -- Record platform fee
  INSERT INTO transactions (
    type,
    amount,
    currency,
    case_id,
    status,
    metadata
  ) VALUES (
    'platform_fee',
    v_platform_fee,
    'EUR',
    p_case_id,
    'completed',
    jsonb_build_object(
      'fee_type', 'case_resolution',
      'case_id', p_case_id
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'investigator_amount', v_investigator_amount,
    'platform_fee', v_platform_fee
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Function to cast community vote
CREATE OR REPLACE FUNCTION cast_community_vote(
  p_case_id UUID,
  p_voter_id UUID,
  p_vote_for TEXT -- 'investigator' or 'refund'
)
RETURNS JSONB AS $$
DECLARE
  v_case RECORD;
BEGIN
  -- Get case
  SELECT * INTO v_case FROM cases WHERE id = p_case_id;
  
  IF v_case.status != 'VOTING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Case is not in voting phase');
  END IF;
  
  -- Check if voting period ended
  IF (v_case.metadata->>'voting_ends_at')::TIMESTAMPTZ < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voting period has ended');
  END IF;
  
  -- Check if user already voted
  IF EXISTS (
    SELECT 1 FROM transactions 
    WHERE case_id = p_case_id 
    AND user_id = p_voter_id 
    AND transaction_type = 'vote'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already voted on this case');
  END IF;
  
  -- Record vote
  INSERT INTO transactions (
    transaction_type,
    amount,
    currency,
    case_id,
    user_id,
    status,
    metadata
  ) VALUES (
    'vote',
    0,
    'EUR',
    p_case_id,
    p_voter_id,
    'completed',
    jsonb_build_object(
      'vote', p_vote_for,
      'voted_at', NOW()
    )
  );
  
  -- Update vote count
  IF p_vote_for = 'investigator' THEN
    UPDATE cases
    SET metadata = metadata || jsonb_build_object(
      'votes_for_investigator', COALESCE((metadata->>'votes_for_investigator')::int, 0) + 1
    )
    WHERE id = p_case_id;
  ELSE
    UPDATE cases
    SET metadata = metadata || jsonb_build_object(
      'votes_for_refund', COALESCE((metadata->>'votes_for_refund')::int, 0) + 1
    )
    WHERE id = p_case_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'vote_recorded', p_vote_for
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Function to finalize community vote
CREATE OR REPLACE FUNCTION finalize_community_vote(
  p_case_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_case RECORD;
  v_votes_investigator INT;
  v_votes_refund INT;
  v_decision TEXT;
BEGIN
  -- Get case
  SELECT * INTO v_case FROM cases WHERE id = p_case_id;
  
  IF v_case.status != 'VOTING' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Case is not in voting phase');
  END IF;
  
  -- Check if voting period ended
  IF (v_case.metadata->>'voting_ends_at')::TIMESTAMPTZ > NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voting period has not ended yet');
  END IF;
  
  -- Get vote counts
  v_votes_investigator := COALESCE((v_case.metadata->>'votes_for_investigator')::int, 0);
  v_votes_refund := COALESCE((v_case.metadata->>'votes_for_refund')::int, 0);
  
  -- Determine winner
  IF v_votes_investigator > v_votes_refund THEN
    v_decision := 'investigator_wins';
    -- Release escrow to investigator
    PERFORM release_escrow_to_investigator(p_case_id, v_case.submitted_by_id);
  ELSE
    v_decision := 'refund_wins';
    -- Refund to submitter
    PERFORM admin_resolve_dispute_refund(
      p_case_id, 
      (SELECT id FROM profiles WHERE role = 'admin' LIMIT 1),
      'Community voted for refund'
    );
  END IF;
  
  -- Update case
  UPDATE cases
  SET metadata = metadata || jsonb_build_object(
    'voting_finalized_at', NOW(),
    'final_decision', v_decision,
    'final_votes_investigator', v_votes_investigator,
    'final_votes_refund', v_votes_refund
  )
  WHERE id = p_case_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'decision', v_decision,
    'votes_investigator', v_votes_investigator,
    'votes_refund', v_votes_refund
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Automated job to finalize expired votes (run via cron or scheduled job)
CREATE OR REPLACE FUNCTION auto_finalize_expired_votes()
RETURNS void AS $$
DECLARE
  v_case_record RECORD;
BEGIN
  FOR v_case_record IN 
    SELECT id FROM cases 
    WHERE status = 'VOTING'
    AND (metadata->>'voting_ends_at')::TIMESTAMPTZ < NOW()
  LOOP
    PERFORM finalize_community_vote(v_case_record.id);
  END LOOP;
END;
$$ LANGUAGE plpgsql;
-- 14. Remove old auto-payout trigger (escrow requires manual approval)
DROP TRIGGER IF EXISTS auto_payout_on_resolution ON cases;

-- 15. Add trigger to notify when case is resolved (but don't auto-release escrow)
CREATE OR REPLACE FUNCTION notify_case_resolution()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'RESOLVED' AND OLD.status != 'RESOLVED' THEN
    -- Update case metadata to indicate awaiting approval
    NEW.metadata = COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object(
      'resolved_at', NOW(),
      'awaiting_submitter_approval', true,
      'escrow_status', 'held'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER case_resolution_notification
  BEFORE UPDATE ON cases
  FOR EACH ROW
  WHEN (NEW.status = 'RESOLVED' AND OLD.status != 'RESOLVED')
  EXECUTE FUNCTION notify_case_resolution();

-- 8. Function to handle subscription activation
CREATE OR REPLACE FUNCTION activate_subscription(
  p_user_id UUID,
  p_plan_type TEXT,
  p_stripe_subscription_id TEXT,
  p_stripe_customer_id TEXT,
  p_current_period_start TIMESTAMPTZ,
  p_current_period_end TIMESTAMPTZ
)
RETURNS JSONB AS $$
BEGIN
  INSERT INTO subscriptions (
    user_id,
    plan_type,
    stripe_subscription_id,
    stripe_customer_id,
    status,
    current_period_start,
    current_period_end
  ) VALUES (
    p_user_id,
    p_plan_type,
    p_stripe_subscription_id,
    p_stripe_customer_id,
    'active',
    p_current_period_start,
    p_current_period_end
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_type = EXCLUDED.plan_type,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    status = 'active',
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    updated_at = NOW();
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Function to handle subscription cancellation
CREATE OR REPLACE FUNCTION cancel_subscription(
  p_user_id UUID,
  p_cancel_at_period_end BOOLEAN DEFAULT true
)
RETURNS JSONB AS $$
BEGIN
  IF p_cancel_at_period_end THEN
    -- Schedule cancellation at period end
    UPDATE subscriptions 
    SET 
      cancel_at_period_end = true,
      updated_at = NOW()
    WHERE user_id = p_user_id;
  ELSE
    -- Immediate cancellation
    UPDATE subscriptions 
    SET 
      status = 'canceled',
      updated_at = NOW()
    WHERE user_id = p_user_id;
  END IF;
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Function to check if subscriptions expired
CREATE OR REPLACE FUNCTION expire_past_due_subscriptions()
RETURNS void AS $$
BEGIN
  UPDATE subscriptions
  SET status = 'past_due'
  WHERE status = 'active'
  AND current_period_end < NOW()
  AND NOT cancel_at_period_end;
  
  UPDATE subscriptions
  SET status = 'canceled'
  WHERE status = 'active'
  AND current_period_end < NOW()
  AND cancel_at_period_end = true;
END;
$$ LANGUAGE plpgsql;

-- 11. Create view for platform revenue analytics
-- Drop existing table/view if it exists (table first, then view)
DROP TABLE IF EXISTS platform_revenue CASCADE;
DROP VIEW IF EXISTS platform_revenue CASCADE;

CREATE VIEW platform_revenue AS
SELECT
  DATE_TRUNC('month', created_at) as month,
  transaction_type,
  COUNT(*) as transaction_count,
  SUM(amount) as total_amount,
  AVG(amount) as average_amount
FROM transactions
WHERE transaction_type IN ('platform_fee', 'donation', 'reward', 'subscription')
AND status = 'completed'
GROUP BY DATE_TRUNC('month', created_at), transaction_type
ORDER BY month DESC, transaction_type;

-- 12. Grant permissions (view inherits RLS from underlying transactions table)
GRANT SELECT ON platform_revenue TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Verification queries:
-- SELECT * FROM transactions WHERE type = 'donation' LIMIT 5;
-- SELECT * FROM wallets WHERE balance > 0;
-- SELECT * FROM subscriptions WHERE status = 'active';
-- SELECT * FROM platform_revenue;
