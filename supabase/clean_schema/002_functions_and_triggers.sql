-- Unexplained Archive - Functions and Triggers
-- Version: 1.0
-- Date: 2025-12-07
-- Description: This script contains all database functions, triggers,
-- and other procedural logic. It should be run after the golden schema.

--------------------------------------------------------------------------------
-- Section: Profile and Wallet Management
--------------------------------------------------------------------------------

-- Function to automatically create a profile and wallet for a new user.
-- Reads username, full_name, and role from signup metadata.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Create a public profile with metadata from signup
  INSERT INTO public.profiles (id, username, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );

  -- Create a wallet for the new profile
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

-- Trigger to execute the function after a new user is created in auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

--------------------------------------------------------------------------------
-- Section: Case and Comment Management (Placeholder)
-- Business logic for cases will be added here from other migrations.
--------------------------------------------------------------------------------

-- Placeholder for a function to update case timestamps
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

CREATE TRIGGER handle_case_update
  BEFORE UPDATE ON public.cases
  FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

--------------------------------------------------------------------------------
-- Section: Realtime Broadcasting (from manual_schema_reset.sql)
-- Supabase-specific trigger for realtime updates on messages.
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.room_messages_broadcast_trigger() 
RETURNS TRIGGER AS $$
BEGIN
    PERFORM realtime.broadcast_changes( 'room:' || COALESCE(NEW.case_id, OLD.case_id)::text, TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Note: The trigger for this is currently commented out as the 'messages' table is not in the golden schema yet.
-- It will be added and enabled in a subsequent step.
/*
CREATE TRIGGER messages_broadcast_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.room_messages_broadcast_trigger();
*/

-- End of functions and triggers script
--------------------------------------------------------------------------------
-- Section: Payment and Escrow Logic
-- Functions for handling donations, escrow, and payouts.
--------------------------------------------------------------------------------

-- Process a direct donation made via Stripe
CREATE OR REPLACE FUNCTION public.process_direct_donation(
  p_case_id UUID,
  p_amount DECIMAL,
  p_stripe_payment_intent_id TEXT,
  p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_transaction_id UUID;
  v_platform_fee DECIMAL;
  v_net_amount DECIMAL;
  v_platform_wallet_id UUID := '00000000-0000-0000-0000-000000000001'; -- Fixed ID for platform wallet
BEGIN
  -- Fee calculation (e.g., 10%)
  v_platform_fee := p_amount * 0.10;
  v_net_amount := p_amount - v_platform_fee;

  -- Create donation transaction, holding funds in escrow
  INSERT INTO public.transactions (
    transaction_type, amount, currency, user_id, case_id, to_wallet_id,
    stripe_payment_intent_id, status, metadata
  ) VALUES (
    'donation', p_amount, 'EUR', p_user_id, p_case_id, v_platform_wallet_id,
    p_stripe_payment_intent_id, 'completed',
    jsonb_build_object(
      'platform_fee', v_platform_fee,
      'net_amount', v_net_amount,
      'escrow_status', 'held'
    )
  ) RETURNING id INTO v_transaction_id;

  -- Update case reward pool (visual representation of funds)
  UPDATE public.cases SET reward_amount = reward_amount + v_net_amount WHERE id = p_case_id;

  -- Update platform wallet balance
  UPDATE public.wallets SET balance = balance + p_amount WHERE id = v_platform_wallet_id;

  RETURN jsonb_build_object('success', true, 'transaction_id', v_transaction_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add balance to user wallet
CREATE OR REPLACE FUNCTION add_user_balance(
  p_user_id UUID,
  p_amount DECIMAL,
  p_description TEXT DEFAULT 'Balance deposit',
  p_stripe_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  -- Get user wallet ID
  SELECT id INTO v_wallet_id
  FROM wallets
  WHERE user_id = p_user_id;

  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  -- Add to wallet balance
  UPDATE wallets
  SET 
    balance = balance + p_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id;

  -- Record transaction
  INSERT INTO transactions (
    user_id, 
    amount, 
    transaction_type, 
    status,
    metadata
  ) VALUES (
    p_user_id, 
    p_amount, 
    'wallet_deposit', 
    'completed',
    jsonb_build_object(
      'description', p_description,
      'stripe_payment_id', p_stripe_id
    )
  );

  RETURN jsonb_build_object(
    'success', true, 
    'new_balance', (SELECT balance FROM wallets WHERE id = v_wallet_id)
  );
END;
$$;

-- Donate from wallet balance
CREATE OR REPLACE FUNCTION donate_from_wallet(
  p_user_id UUID,
  p_case_id UUID,
  p_amount DECIMAL
)
RETURNS JSONB AS $$
DECLARE
  v_wallet RECORD;
  v_platform_fee DECIMAL;
  v_net_donation DECIMAL;
BEGIN
  -- Get user wallet and check balance
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id;
  
  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  IF v_wallet.balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Calculate fees (10% platform fee)
  v_platform_fee := p_amount * 0.10;
  v_net_donation := p_amount - v_platform_fee;

  -- Decrement user's wallet
  UPDATE wallets
  SET balance = balance - p_amount
  WHERE id = v_wallet.id;

  -- Update case reward_amount (visible to users)
  UPDATE cases
  SET reward_amount = COALESCE(reward_amount, 0) + v_net_donation,
      updated_at = NOW()
  WHERE id = p_case_id;

  -- Log transaction
  INSERT INTO transactions (
    user_id, case_id, transaction_type, amount, status, metadata
  ) VALUES (
    p_user_id, p_case_id, 'donation', p_amount, 'completed',
    jsonb_build_object(
      'source', 'wallet',
      'platform_fee', v_platform_fee,
      'net_donation', v_net_donation
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'net_donation', v_net_donation,
    'platform_fee', v_platform_fee
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: Increment case escrow/reward
CREATE OR REPLACE FUNCTION increment_case_escrow(case_id UUID, amount DECIMAL)
RETURNS VOID AS $$
BEGIN
  UPDATE cases 
  SET reward_amount = COALESCE(reward_amount, 0) + amount,
      updated_at = NOW()
  WHERE id = case_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Release escrow funds to investigator(s) upon case resolution
CREATE OR REPLACE FUNCTION public.release_escrow_to_investigator(p_case_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_case RECORD;
  v_platform_wallet_id UUID := '00000000-0000-0000-0000-000000000001';
  v_platform_fee DECIMAL;
  v_net_reward DECIMAL;
  v_total_escrow DECIMAL;
BEGIN
  SELECT * INTO v_case FROM public.cases WHERE id = p_case_id;
  
  IF v_case IS NULL OR v_case.status NOT IN ('verified', 'investigating') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Case not found or not in a releasable state.');
  END IF;

  v_total_escrow := v_case.reward_amount;
  v_platform_fee := v_total_escrow * 0.15; -- 15% fee on resolution
  v_net_reward := v_total_escrow - v_platform_fee;

  -- Deduct total amount from platform wallet
  UPDATE public.wallets SET balance = balance - v_total_escrow WHERE id = v_platform_wallet_id;

  -- Distribute reward to team or single investigator
  -- This is a simplified version; team logic will be more complex
  IF v_case.is_team_case THEN
    -- Placeholder for distribute_team_reward function call
    PERFORM public.distribute_team_reward(p_case_id, v_net_reward);
  ELSE
    UPDATE public.wallets SET balance = balance + v_net_reward WHERE user_id = v_case.investigator_id;
  END IF;

  -- Mark original donation transactions as 'released'
  UPDATE public.transactions 
  SET metadata = metadata || jsonb_build_object('escrow_status', 'released')
  WHERE case_id = p_case_id AND transaction_type = 'donation' AND (metadata->>'escrow_status') = 'held';
  
  -- Update case status
  UPDATE public.cases SET status = 'closed' WHERE id = p_case_id;
  
  RETURN jsonb_build_object('success', true, 'net_reward', v_net_reward);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

--------------------------------------------------------------------------------
-- Section: Boost Management Logic
--------------------------------------------------------------------------------

-- Increment boost impressions for a case when displayed
CREATE OR REPLACE FUNCTION public.track_boost_impression(p_case_id uuid)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.featured_cases
  SET impressions = impressions + 1,
      updated_at = timezone('utc', now())
  WHERE case_id = p_case_id
    AND status = 'active'
    AND featured_until > timezone('utc', now());
END;
$$;

-- Increment boost clicks for a case when user engages
CREATE OR REPLACE FUNCTION public.track_boost_click(p_case_id uuid)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.featured_cases
  SET clicks = clicks + 1,
      updated_at = timezone('utc', now())
  WHERE case_id = p_case_id
    AND status = 'active'
    AND featured_until > timezone('utc', now());
END;
$$;

-- Fetch all currently active boosted cases
CREATE OR REPLACE FUNCTION public.get_active_boosts()
RETURNS TABLE (
  case_id uuid,
  boost_type text,
  featured_until timestamptz,
  status text,
  impressions integer,
  clicks integer,
  price_paid numeric,
  case_title text,
  case_status text
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fc.case_id,
    fc.boost_type,
    fc.featured_until,
    fc.status,
    fc.impressions,
    fc.clicks,
    fc.price_paid,
    c.title AS case_title,
    c.status AS case_status
  FROM public.featured_cases fc
  JOIN public.cases c ON c.id = fc.case_id
  WHERE fc.status = 'active'
    AND fc.featured_until > timezone('utc', now())
  ORDER BY fc.featured_until DESC;
END;
$$;

-- Boost analytics summary for a user's boosted cases
CREATE OR REPLACE FUNCTION public.get_user_boost_analytics(p_user_id uuid)
RETURNS TABLE (
  case_id uuid,
  case_title text,
  boost_type text,
  featured_until timestamptz,
  impressions integer,
  clicks integer,
  price_paid numeric,
  status text,
  ctr numeric,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fc.case_id,
    c.title AS case_title,
    fc.boost_type,
    fc.featured_until,
    fc.impressions,
    fc.clicks,
    fc.price_paid,
    fc.status,
    CASE
      WHEN fc.impressions > 0 THEN ROUND((fc.clicks::numeric / fc.impressions::numeric) * 100, 2)
      ELSE 0
    END AS ctr,
    (fc.status = 'active' AND fc.featured_until > timezone('utc', now())) AS is_active
  FROM public.featured_cases fc
  JOIN public.cases c ON c.id = fc.case_id
  WHERE fc.paid_by = p_user_id
  ORDER BY fc.featured_until DESC;
END;
$$;

-- Purchase a boost using wallet balance (optionally recording Stripe payment id)
CREATE OR REPLACE FUNCTION public.purchase_case_boost(
  p_case_id uuid,
  p_user_id uuid,
  p_boost_type text,
  p_stripe_payment_id text DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pricing RECORD;
  v_now timestamptz := timezone('utc', now());
  v_user_wallet_id uuid;
  v_platform_wallet_id uuid := '00000000-0000-0000-0000-000000000001';
  v_transaction_id uuid;
  v_existing_until timestamptz;
  v_new_until timestamptz;
  v_case_exists boolean;
  v_metadata jsonb := jsonb_build_object('last_purchase_at', v_now, 'boost_type', p_boost_type);
  v_featured_record public.featured_cases%ROWTYPE;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.cases WHERE id = p_case_id) INTO v_case_exists;
  IF NOT v_case_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Case not found');
  END IF;

  SELECT *
  INTO v_pricing
  FROM public.boost_pricing
  WHERE boost_type = p_boost_type
    AND is_active
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid boost type');
  END IF;

  UPDATE public.wallets
  SET balance = balance - v_pricing.price,
      updated_at = v_now
  WHERE user_id = p_user_id
    AND balance >= v_pricing.price
  RETURNING id INTO v_user_wallet_id;

  IF v_user_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient wallet balance');
  END IF;

  UPDATE public.wallets
  SET balance = balance + v_pricing.price,
      updated_at = v_now
  WHERE id = v_platform_wallet_id;

  SELECT featured_until
  INTO v_existing_until
  FROM public.featured_cases
  WHERE case_id = p_case_id;

  IF v_existing_until IS NULL OR v_existing_until < v_now THEN
    v_new_until := v_now + (v_pricing.duration_hours || ' hours')::interval;
  ELSE
    v_new_until := v_existing_until + (v_pricing.duration_hours || ' hours')::interval;
  END IF;

  INSERT INTO public.transactions (
    user_id,
    from_wallet_id,
    to_wallet_id,
    amount,
    currency,
    transaction_type,
    status,
    case_id,
    stripe_payment_intent_id,
    metadata,
    created_at
  ) VALUES (
    p_user_id,
    v_user_wallet_id,
    v_platform_wallet_id,
    v_pricing.price,
    v_pricing.currency,
    'boost_payment',
    'completed',
    p_case_id,
    p_stripe_payment_id,
    jsonb_build_object(
      'boost_type', p_boost_type,
      'duration_hours', v_pricing.duration_hours
    ),
    v_now
  ) RETURNING id INTO v_transaction_id;

  INSERT INTO public.featured_cases (
    case_id,
    paid_by,
    boost_type,
    featured_until,
    status,
    price_paid,
    currency,
    impressions,
    clicks,
    transaction_id,
    stripe_payment_id,
    metadata,
    created_at,
    updated_at
  ) VALUES (
    p_case_id,
    p_user_id,
    p_boost_type,
    v_new_until,
    'active',
    v_pricing.price,
    v_pricing.currency,
    0,
    0,
    v_transaction_id,
    p_stripe_payment_id,
    v_metadata,
    v_now,
    v_now
  )
  ON CONFLICT (case_id) DO UPDATE
  SET paid_by = EXCLUDED.paid_by,
      boost_type = EXCLUDED.boost_type,
      featured_until = EXCLUDED.featured_until,
      status = CASE
        WHEN EXCLUDED.featured_until > v_now THEN 'active'
        ELSE 'expired'
      END,
      price_paid = public.featured_cases.price_paid + EXCLUDED.price_paid,
      currency = EXCLUDED.currency,
      transaction_id = EXCLUDED.transaction_id,
      stripe_payment_id = COALESCE(EXCLUDED.stripe_payment_id, public.featured_cases.stripe_payment_id),
      metadata = COALESCE(public.featured_cases.metadata, '{}'::jsonb) || v_metadata,
      updated_at = EXCLUDED.updated_at
  RETURNING * INTO v_featured_record;

  RETURN jsonb_build_object(
    'success', true,
    'case_id', v_featured_record.case_id,
    'featured_until', v_featured_record.featured_until,
    'status', v_featured_record.status,
    'transaction_id', v_transaction_id
  );
EXCEPTION
  WHEN others THEN
    -- Attempt to refund wallet if transaction failed after debit but before completion
    IF v_user_wallet_id IS NOT NULL THEN
      UPDATE public.wallets
      SET balance = balance + v_pricing.price,
          updated_at = timezone('utc', now())
      WHERE id = v_user_wallet_id;
    END IF;

    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

--------------------------------------------------------------------------------
-- Section: Team Collaboration Logic
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.invite_team_member(
    p_case_id UUID,
    p_from_investigator_id UUID,
    p_to_investigator_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_invitation_id UUID;
BEGIN
  -- Logic to check if inviter is leader, invitee is not already on team, etc.
  -- ... (omitted for brevity, will be added from migration file)

  INSERT INTO public.case_team_members (case_id, user_id, status, invited_by, role)
  VALUES (p_case_id, p_to_investigator_id, 'invited', p_from_investigator_id, 'member')
  RETURNING id INTO v_invitation_id;

  UPDATE public.cases SET is_team_case = true WHERE id = p_case_id;

  RETURN jsonb_build_object('success', true, 'invitation_id', v_invitation_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.distribute_team_reward(p_case_id UUID, p_total_amount DECIMAL)
RETURNS VOID AS $$
DECLARE
    v_team_member RECORD;
    v_member_amount DECIMAL;
BEGIN
    FOR v_team_member IN 
        SELECT user_id, contribution_percentage 
        FROM public.case_team_members 
        WHERE case_id = p_case_id AND status = 'active'
    LOOP
        v_member_amount := p_total_amount * (v_team_member.contribution_percentage / 100.0);
        UPDATE public.wallets SET balance = balance + v_member_amount WHERE user_id = v_team_member.user_id;
        
        -- Log individual transaction for each team member
        INSERT INTO public.transactions (transaction_type, amount, user_id, case_id, status)
        VALUES ('case_reward', v_member_amount, v_team_member.user_id, p_case_id, 'completed');
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

--------------------------------------------------------------------------------
-- Section: Admin Dashboard Functions
--------------------------------------------------------------------------------

-- Function to get pending investigator applications (for admin dashboard)
CREATE OR REPLACE FUNCTION public.get_pending_investigator_applications()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    -- Check if caller is admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    SELECT jsonb_build_object(
        'success', true,
        'applications', COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', ia.id,
                'user_id', ia.user_id,
                'motivation', ia.motivation,
                'expertise', ia.expertise,
                'experience', ia.experience,
                'certifications', ia.certifications,
                'documents', ia.documents,
                'status', ia.status,
                'created_at', ia.created_at,
                'profile', jsonb_build_object(
                    'username', p.username,
                    'full_name', p.full_name,
                    'avatar_url', p.avatar_url,
                    'email', p.username
                )
            )
        ), '[]'::jsonb)
    ) INTO result
    FROM public.investigator_applications ia
    JOIN public.profiles p ON p.id = ia.user_id
    WHERE ia.status = 'pending';
    
    RETURN result;
END;
$$;

-- Function to approve investigator application
CREATE OR REPLACE FUNCTION public.approve_investigator_application(p_application_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Check if caller is admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    -- Get user_id from application
    SELECT user_id INTO v_user_id
    FROM public.investigator_applications
    WHERE id = p_application_id AND status = 'pending';
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Application not found or already processed');
    END IF;
    
    -- Update application status
    UPDATE public.investigator_applications
    SET status = 'approved',
        reviewed_by = auth.uid(),
        reviewed_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    WHERE id = p_application_id;
    
    -- Update user role to investigator
    UPDATE public.profiles
    SET role = 'investigator',
        updated_at = timezone('utc', now())
    WHERE id = v_user_id;
    
    RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
END;
$$;

-- Function to reject investigator application
CREATE OR REPLACE FUNCTION public.reject_investigator_application(p_application_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check if caller is admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    UPDATE public.investigator_applications
    SET status = 'rejected',
        reviewed_by = auth.uid(),
        reviewed_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    WHERE id = p_application_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Application not found or already processed');
    END IF;
    
    RETURN jsonb_build_object('success', true);
END;
$$;

-- Function to reject investigator application (wrapper for frontend)
CREATE OR REPLACE FUNCTION public.reject_investigator_application_wrapper(action_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_application_id uuid;
    v_reason text;
BEGIN
    -- Check if caller is admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    v_application_id := (action_data->>'application_id')::uuid;
    v_reason := action_data->>'reason';
    
    UPDATE public.investigator_applications
    SET status = 'rejected',
        reviewed_by = auth.uid(),
        reviewed_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    WHERE id = v_application_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Application not found or already processed');
    END IF;
    
    -- Notify the applicant
    INSERT INTO public.notifications (user_id, type, title, message)
    SELECT user_id, 'application_rejected', 'Application Rejected', 
           COALESCE('Your investigator application has been rejected. Reason: ' || v_reason, 'Your investigator application has been rejected.')
    FROM public.investigator_applications WHERE id = v_application_id;
    
    RETURN jsonb_build_object('success', true);
END;
$$;

-- Function to approve investigator application (wrapper for frontend)
CREATE OR REPLACE FUNCTION public.approve_investigator_application_wrapper(action_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_application_id uuid;
    v_user_id uuid;
    v_current_status text;
BEGIN
    -- Check if caller is admin
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    v_application_id := (action_data->>'application_id')::uuid;
    
    -- Get user_id and current status from application (no status filter to allow approving rejected apps)
    SELECT user_id, status INTO v_user_id, v_current_status
    FROM public.investigator_applications
    WHERE id = v_application_id;
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Application not found');
    END IF;
    
    IF v_current_status = 'approved' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Application already approved');
    END IF;
    
    -- Update application status
    UPDATE public.investigator_applications
    SET status = 'approved',
        reviewed_by = auth.uid(),
        reviewed_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    WHERE id = v_application_id;
    
    -- Update user role to investigator
    UPDATE public.profiles
    SET role = 'investigator',
        updated_at = timezone('utc', now())
    WHERE id = v_user_id;
    
    -- Notify the applicant
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (v_user_id, 'application_approved', 'Application Approved', 
            'Congratulations! Your investigator application has been approved. You can now take on cases.');
    
    RETURN jsonb_build_object('success', true, 'user_id', v_user_id);
END;
$$;

-- Trigger for messages realtime broadcast
CREATE OR REPLACE FUNCTION public.messages_broadcast_trigger()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM realtime.broadcast_changes(
        'messages:' || COALESCE(NEW.recipient_id, OLD.recipient_id)::text,
        TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create the trigger for messages table (will be enabled after messages table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'messages' AND table_schema = 'public') THEN
        DROP TRIGGER IF EXISTS messages_realtime_broadcast ON public.messages;
        CREATE TRIGGER messages_realtime_broadcast
            AFTER INSERT OR UPDATE OR DELETE ON public.messages
            FOR EACH ROW EXECUTE FUNCTION public.messages_broadcast_trigger();
    END IF;
END $$;

--------------------------------------------------------------------------------
-- Section: Investigator Application Functions
--------------------------------------------------------------------------------

-- Function to check investigator application status for any user
CREATE OR REPLACE FUNCTION public.check_investigator_application(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_application RECORD;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    SELECT * INTO v_application
    FROM public.investigator_applications
    WHERE user_id = v_user_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_application IS NULL THEN
        RETURN jsonb_build_object('exists', false, 'status', null);
    END IF;
    
    RETURN jsonb_build_object(
        'exists', true,
        'status', v_application.status,
        'id', v_application.id,
        'created_at', v_application.created_at
    );
END;
$$;

-- Function to submit investigator application
CREATE OR REPLACE FUNCTION public.submit_investigator_application(application_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_application_id uuid;
    v_existing_id uuid;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Check if user already has a pending or approved application
    SELECT id INTO v_existing_id
    FROM public.investigator_applications
    WHERE user_id = v_user_id AND status IN ('pending', 'approved');
    
    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'You already have an active application');
    END IF;
    
    -- Insert the application with all fields
    INSERT INTO public.investigator_applications (
        user_id,
        motivation,
        expertise,
        experience,
        certifications,
        documents,
        status,
        created_at
    ) VALUES (
        v_user_id,
        application_data->>'motivation',
        CASE 
            WHEN application_data->'expertise' IS NOT NULL 
            THEN ARRAY(SELECT jsonb_array_elements_text(application_data->'expertise'))
            ELSE '{}'::text[]
        END,
        application_data->>'experience',
        COALESCE(application_data->'certifications', '[]'::jsonb),
        COALESCE(application_data->'documents', '[]'::jsonb),
        COALESCE(application_data->>'status', 'pending'),
        timezone('utc', now())
    )
    RETURNING id INTO v_application_id;
    
    -- Create notification for admins
    INSERT INTO public.notifications (user_id, type, title, message)
    SELECT id, 'investigator_application', 'New Investigator Application', 
           'A new investigator application has been submitted for review.'
    FROM public.profiles WHERE role = 'admin';
    
    RETURN jsonb_build_object(
        'success', true, 
        'application_id', v_application_id,
        'message', 'Application submitted successfully'
    );
END;
$$;

--------------------------------------------------------------------------------
-- Section: Notification Functions
--------------------------------------------------------------------------------

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id uuid, p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    UPDATE public.notifications
    SET read_at = timezone('utc', now())
    WHERE id = p_notification_id 
      AND user_id = v_user_id
      AND read_at IS NULL;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Notification not found or already read');
    END IF;
    
    RETURN jsonb_build_object('success', true);
END;
$$;

-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.notifications
    SET read_at = timezone('utc', now())
    WHERE user_id = auth.uid()
      AND read_at IS NULL;
    
    RETURN jsonb_build_object('success', true);
END;
$$;

--------------------------------------------------------------------------------
-- Section: Admin Investigator Management Functions
--------------------------------------------------------------------------------

-- Get all pending investigator applications (for admin dashboard)
CREATE OR REPLACE FUNCTION public.get_pending_investigator_applications()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_applications jsonb;
BEGIN
    -- Check admin permission
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access denied');
    END IF;

    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'id', a.id,
            'user_id', a.user_id,
            'motivation', a.motivation,
            'expertise', a.expertise,
            'experience', a.experience,
            'certifications', a.certifications,
            'documents', a.documents,
            'status', a.status,
            'created_at', a.created_at,
            'applicant', jsonb_build_object(
                'username', p.username,
                'full_name', p.full_name,
                'avatar_url', p.avatar_url,
                'reputation', p.reputation
            )
        ) ORDER BY a.created_at DESC
    ), '[]'::jsonb)
    INTO v_applications
    FROM investigator_applications a
    JOIN profiles p ON a.user_id = p.id
    WHERE a.status = 'pending';

    RETURN jsonb_build_object('success', true, 'applications', v_applications);
END;
$$;

-- Approve investigator application (wrapper for frontend jsonb input)
CREATE OR REPLACE FUNCTION public.approve_investigator_application_wrapper(action_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_application_id uuid;
    v_admin_id uuid;
    v_user_id uuid;
BEGIN
    v_application_id := (action_data->>'application_id')::uuid;
    v_admin_id := (action_data->>'admin_id')::uuid;
    
    -- Verify admin
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_admin_id AND role = 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
    END IF;
    
    -- Get user_id from application
    SELECT user_id INTO v_user_id
    FROM investigator_applications
    WHERE id = v_application_id;
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Application not found');
    END IF;
    
    -- Update application status
    UPDATE investigator_applications
    SET status = 'approved',
        reviewed_by = v_admin_id,
        reviewed_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    WHERE id = v_application_id;
    
    -- Update user role to investigator
    UPDATE profiles SET role = 'investigator' WHERE id = v_user_id;
    
    -- Notify user
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (v_user_id, 'Application Approved', 'Congratulations! Your investigator application has been approved.', 'system');
    
    RETURN jsonb_build_object('success', true);
END;
$$;

-- Reject investigator application (wrapper for frontend jsonb input)
CREATE OR REPLACE FUNCTION public.reject_investigator_application_wrapper(action_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_application_id uuid;
    v_admin_id uuid;
    v_reason text;
    v_user_id uuid;
BEGIN
    v_application_id := (action_data->>'application_id')::uuid;
    v_admin_id := (action_data->>'admin_id')::uuid;
    v_reason := action_data->>'reason';
    
    -- Verify admin
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_admin_id AND role = 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
    END IF;
    
    -- Get user_id from application
    SELECT user_id INTO v_user_id
    FROM investigator_applications
    WHERE id = v_application_id;
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Application not found');
    END IF;
    
    -- Update application status
    UPDATE investigator_applications
    SET status = 'rejected',
        reviewed_by = v_admin_id,
        reviewed_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    WHERE id = v_application_id;
    
    -- Notify user
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (v_user_id, 'Application Rejected', 'Your investigator application was not approved. Reason: ' || COALESCE(v_reason, 'Not specified'), 'system');
    
    RETURN jsonb_build_object('success', true);
END;
$$;

-- Get all active investigators (for admin dashboard)
CREATE OR REPLACE FUNCTION public.get_all_investigators()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_investigators jsonb;
BEGIN
    -- Only admins can get full list
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Access denied');
    END IF;

    SELECT COALESCE(jsonb_agg(row_to_json(p)), '[]'::jsonb)
    INTO v_investigators
    FROM (
        SELECT id, username, full_name, avatar_url, role, reputation, verification_status
        FROM profiles 
        WHERE role = 'investigator' 
        ORDER BY username
    ) p;

    RETURN jsonb_build_object('success', true, 'investigators', v_investigators);
END;
$$;

-- Demote investigator to regular user
CREATE OR REPLACE FUNCTION public.demote_investigator(action_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_reason text;
    v_admin_id uuid;
BEGIN
    v_user_id := (action_data->>'user_id')::uuid;
    v_reason := action_data->>'reason';
    v_admin_id := auth.uid();
    
    -- Check admin permission
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_admin_id AND role = 'admin') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
    END IF;
    
    -- Check user exists and is investigator
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id AND role = 'investigator') THEN
        RETURN jsonb_build_object('success', false, 'error', 'User is not an investigator');
    END IF;
    
    -- Demote to user
    UPDATE profiles SET role = 'user' WHERE id = v_user_id;
    
    -- Notify the demoted user
    INSERT INTO notifications (user_id, title, message, type, metadata)
    VALUES (
        v_user_id,
        'Investigator Status Removed',
        'Your investigator status has been removed. Reason: ' || COALESCE(v_reason, 'No reason provided'),
        'system',
        jsonb_build_object('action', 'demoted', 'admin_id', v_admin_id, 'reason', v_reason)
    );
    
    RETURN jsonb_build_object('success', true);
END;
$$;

--------------------------------------------------------------------------------
-- Section: Withdrawal Functions
--------------------------------------------------------------------------------

-- Refund failed withdrawal back to user's wallet
CREATE OR REPLACE FUNCTION public.refund_failed_withdrawal(p_user_id uuid, p_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_wallet_id uuid;
BEGIN
    -- Get wallet
    SELECT id INTO v_wallet_id FROM wallets WHERE user_id = p_user_id;
    
    IF v_wallet_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
    END IF;
    
    -- Add back to balance
    UPDATE wallets SET balance = balance + p_amount WHERE id = v_wallet_id;
    
    -- Create refund transaction
    INSERT INTO transactions (to_wallet_id, transaction_type, amount, status, description)
    VALUES (v_wallet_id, 'refund', p_amount, 'completed', 'Withdrawal refund - payout failed');
    
    RETURN jsonb_build_object('success', true);
END;
$$;

-- Process withdrawal (deduct from wallet, add fee to platform)
CREATE OR REPLACE FUNCTION public.process_withdrawal(p_user_id uuid, p_amount numeric, p_fee numeric)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_wallet_id uuid;
    v_new_balance numeric;
BEGIN
    -- Get wallet ID
    SELECT id INTO v_wallet_id FROM wallets WHERE user_id = p_user_id;
    
    IF v_wallet_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
    END IF;
    
    -- Atomic balance deduction with race condition protection
    -- This UPDATE will fail if balance becomes negative
    UPDATE wallets 
    SET balance = balance - p_amount 
    WHERE id = v_wallet_id 
    AND balance >= p_amount  -- Atomic check prevents race conditions
    RETURNING balance INTO v_new_balance;
    
    -- If update affected 0 rows, balance was insufficient
    IF v_new_balance IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
    END IF;
    
    -- Record platform fee
    IF p_fee > 0 THEN
        INSERT INTO platform_revenue (amount, source, description)
        VALUES (p_fee, 'platform_fee', 'Withdrawal fee');
    END IF;
    
    RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;

-- Unreserve wallet balance (for failed withdrawal attempts)
CREATE OR REPLACE FUNCTION public.unreserve_wallet_balance(p_user_id uuid, p_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_wallet_id uuid;
BEGIN
    SELECT id INTO v_wallet_id FROM wallets WHERE user_id = p_user_id;
    
    IF v_wallet_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
    END IF;
    
    -- Restore balance from reserved
    UPDATE wallets 
    SET balance = balance + p_amount,
        pending_withdrawals = GREATEST(0, COALESCE(pending_withdrawals, 0) - p_amount)
    WHERE id = v_wallet_id;
    
    RETURN jsonb_build_object('success', true);
END;
$$;

--------------------------------------------------------------------------------
-- Section: Subscription Management Functions
--------------------------------------------------------------------------------

-- Initialize credits for new subscription
CREATE OR REPLACE FUNCTION initialize_subscription_credits(
  p_user_id UUID,
  p_subscription_id UUID,
  p_plan_code TEXT,
  p_billing_cycle TEXT
)
RETURNS VOID AS $$
DECLARE
  v_credits INTEGER;
  v_period_end TIMESTAMPTZ;
BEGIN
  -- Get credits from plan
  SELECT ai_credits_monthly INTO v_credits
  FROM subscription_plans
  WHERE plan_code = p_plan_code;
  
  -- Calculate period end
  IF p_billing_cycle = 'monthly' THEN
    v_period_end := (DATE_TRUNC('month', NOW()) + INTERVAL '1 month')::TIMESTAMPTZ;
  ELSIF p_billing_cycle = 'yearly' THEN
    v_period_end := (NOW() + INTERVAL '1 year')::TIMESTAMPTZ;
  ELSIF p_billing_cycle = 'onetime' THEN
    v_period_end := CASE 
      WHEN p_plan_code = 'basic' THEN NOW() + INTERVAL '3 months'
      WHEN p_plan_code = 'premium' THEN NOW() + INTERVAL '6 months'
      WHEN p_plan_code = 'pro' THEN NOW() + INTERVAL '3 months'
    END;
  END IF;
  
  -- Insert or update credits
  INSERT INTO subscription_credits (
    user_id, subscription_id, credits_total, credits_used,
    billing_cycle, current_period_start, current_period_end,
    resets_at, expires_at
  ) VALUES (
    p_user_id, p_subscription_id, v_credits, 0,
    p_billing_cycle, NOW(), v_period_end,
    CASE WHEN p_billing_cycle = 'monthly' THEN v_period_end ELSE NULL END,
    CASE WHEN p_billing_cycle = 'onetime' THEN v_period_end ELSE NULL END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    subscription_id = p_subscription_id,
    credits_total = v_credits,
    credits_used = 0,
    billing_cycle = p_billing_cycle,
    current_period_start = NOW(),
    current_period_end = v_period_end,
    resets_at = CASE WHEN p_billing_cycle = 'monthly' THEN v_period_end ELSE NULL END,
    expires_at = CASE WHEN p_billing_cycle = 'onetime' THEN v_period_end ELSE NULL END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user has enough credits
CREATE OR REPLACE FUNCTION check_subscription_credits(
  p_user_id UUID,
  p_credits_required INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_remaining INTEGER;
BEGIN
  SELECT credits_remaining INTO v_remaining
  FROM subscription_credits
  WHERE user_id = p_user_id AND is_active = TRUE;
  
  RETURN COALESCE(v_remaining, 0) >= p_credits_required;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Deduct credits
CREATE OR REPLACE FUNCTION deduct_subscription_credits(
  p_user_id UUID,
  p_tool_name TEXT,
  p_credits_cost INTEGER,
  p_case_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_subscription_id UUID;
  v_has_credits BOOLEAN;
BEGIN
  v_has_credits := check_subscription_credits(p_user_id, p_credits_cost);
  
  IF NOT v_has_credits THEN
    RETURN FALSE;
  END IF;
  
  SELECT subscription_id INTO v_subscription_id
  FROM subscription_credits
  WHERE user_id = p_user_id;
  
  UPDATE subscription_credits
  SET 
    credits_used = credits_used + p_credits_cost,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  INSERT INTO subscription_usage_log (
    user_id, subscription_id, case_id,
    tool_name, credits_cost, metadata
  ) VALUES (
    p_user_id, v_subscription_id, p_case_id,
    p_tool_name, p_credits_cost, p_metadata
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reset monthly credits (called by cron job)
CREATE OR REPLACE FUNCTION reset_monthly_subscription_credits()
RETURNS INTEGER AS $$
DECLARE
  v_reset_count INTEGER := 0;
BEGIN
  UPDATE subscription_credits sc
  SET 
    credits_used = 0,
    current_period_start = NOW(),
    current_period_end = DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
    resets_at = DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
    updated_at = NOW()
  WHERE 
    billing_cycle = 'monthly'
    AND is_active = TRUE
    AND resets_at <= NOW();
  
  GET DIAGNOSTICS v_reset_count = ROW_COUNT;
  RETURN v_reset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Expire one-time packs
CREATE OR REPLACE FUNCTION expire_onetime_subscriptions()
RETURNS INTEGER AS $$
DECLARE
  v_expired_count INTEGER := 0;
BEGIN
  UPDATE subscription_credits
  SET 
    is_active = FALSE,
    updated_at = NOW()
  WHERE 
    billing_cycle = 'onetime'
    AND expires_at <= NOW()
    AND is_active = TRUE;
  
  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  
  UPDATE subscriptions s
  SET status = 'expired'
  FROM subscription_credits sc
  WHERE 
    s.id = sc.subscription_id
    AND sc.billing_cycle = 'onetime'
    AND sc.expires_at <= NOW()
    AND s.status = 'active';
  
  RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

--------------------------------------------------------------------------------
-- Section: Team Collaboration Functions
--------------------------------------------------------------------------------

-- Get team members for a case
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

-- Auto-add assigned investigator as team leader
CREATE OR REPLACE FUNCTION auto_add_investigator_to_team()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.assigned_investigator_id IS NOT NULL THEN
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

-- Get unread team message count
CREATE OR REPLACE FUNCTION get_unread_team_message_count(p_case_id UUID, p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM case_team_messages
        WHERE case_id = p_case_id
        AND sender_id != p_user_id
        AND NOT (read_by @> jsonb_build_array(p_user_id::text))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark team messages as read
CREATE OR REPLACE FUNCTION mark_team_messages_read(p_case_id UUID, p_user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE case_team_messages
    SET read_by = CASE 
        WHEN read_by @> jsonb_build_array(p_user_id::text) 
        THEN read_by
        ELSE read_by || jsonb_build_array(p_user_id::text)
    END,
    updated_at = timezone('utc', now())
    WHERE case_id = p_case_id
    AND sender_id != p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

--------------------------------------------------------------------------------
-- Section: Notification Group Functions
--------------------------------------------------------------------------------

-- Get subscription group members
CREATE OR REPLACE FUNCTION get_subscription_group_members(p_group_code TEXT)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  plan_type TEXT,
  subscription_status TEXT,
  credits_remaining INTEGER
) AS $$
DECLARE
  v_criteria JSONB;
BEGIN
  SELECT criteria INTO v_criteria
  FROM subscription_notification_groups
  WHERE group_code = p_group_code;

  IF p_group_code = 'all_subscribers' THEN
    RETURN QUERY
    SELECT 
      s.user_id,
      au.email::TEXT as email,
      COALESCE(p.full_name, p.username, 'Unknown') as full_name,
      s.plan_type,
      s.status as subscription_status,
      COALESCE(sc.credits_remaining, 0) as credits_remaining
    FROM subscriptions s
    JOIN profiles p ON p.id = s.user_id
    JOIN auth.users au ON au.id = s.user_id
    LEFT JOIN subscription_credits sc ON sc.user_id = s.user_id
    WHERE s.status IN ('active', 'trialing');
    
  ELSIF p_group_code IN ('basic_subscribers', 'premium_subscribers', 'pro_subscribers') THEN
    RETURN QUERY
    SELECT 
      s.user_id,
      au.email::TEXT as email,
      COALESCE(p.full_name, p.username, 'Unknown') as full_name,
      s.plan_type,
      s.status as subscription_status,
      COALESCE(sc.credits_remaining, 0) as credits_remaining
    FROM subscriptions s
    JOIN profiles p ON p.id = s.user_id
    JOIN auth.users au ON au.id = s.user_id
    LEFT JOIN subscription_credits sc ON sc.user_id = s.user_id
    WHERE s.plan_type = REPLACE(p_group_code, '_subscribers', '')
      AND s.status IN ('active', 'trialing');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update group member counts
CREATE OR REPLACE FUNCTION update_group_member_counts()
RETURNS VOID AS $$
DECLARE
  v_group RECORD;
  v_count INTEGER;
BEGIN
  FOR v_group IN SELECT group_code FROM subscription_notification_groups LOOP
    SELECT COUNT(*) INTO v_count
    FROM get_subscription_group_members(v_group.group_code);
    
    UPDATE subscription_notification_groups
    SET 
      member_count = v_count,
      updated_at = NOW()
    WHERE group_code = v_group.group_code;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

--------------------------------------------------------------------------------
-- Section: Case Functions (Views, Resolution, Disputes)
--------------------------------------------------------------------------------

-- Increment case views counter
CREATE OR REPLACE FUNCTION increment_case_views(case_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE cases 
  SET views = views + 1,
      updated_at = NOW()
  WHERE id = case_id;
END;
$$;

-- Process case resolution
CREATE OR REPLACE FUNCTION process_case_resolution(
  p_case_id UUID,
  p_resolution_notes TEXT,
  p_resolved_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_case RECORD;
BEGIN
  SELECT * INTO v_case FROM cases WHERE id = p_case_id;
  
  IF v_case IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Case not found');
  END IF;
  
  UPDATE cases
  SET 
    status = 'RESOLVED',
    updated_at = NOW()
  WHERE id = p_case_id;
  
  IF v_case.reward_amount > 0 THEN
    PERFORM release_escrow_to_investigator(p_case_id);
  END IF;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Process voting outcome
CREATE OR REPLACE FUNCTION process_voting_outcome(
  p_case_id UUID,
  p_outcome TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE cases
  SET 
    status = CASE 
      WHEN p_outcome = 'accepted' THEN 'RESOLVED'
      ELSE 'DISPUTED'
    END,
    updated_at = NOW()
  WHERE id = p_case_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Admin resolve dispute
CREATE OR REPLACE FUNCTION admin_resolve_dispute(
  p_case_id UUID,
  p_resolution TEXT,
  p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin(p_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  UPDATE cases
  SET 
    status = 'RESOLVED',
    updated_at = NOW()
  WHERE id = p_case_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

--------------------------------------------------------------------------------
-- Section: Extended Team Collaboration Functions
--------------------------------------------------------------------------------

-- Claim case as team leader
CREATE OR REPLACE FUNCTION claim_case_as_leader(
  p_case_id UUID,
  p_investigator_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM cases 
    WHERE id = p_case_id 
    AND (assigned_investigator_id IS NOT NULL OR investigator_id IS NOT NULL)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Case already assigned');
  END IF;
  
  UPDATE cases
  SET 
    assigned_investigator_id = p_investigator_id,
    investigator_id = p_investigator_id,
    status = 'INVESTIGATING',
    updated_at = NOW()
  WHERE id = p_case_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Accept team invitation
CREATE OR REPLACE FUNCTION accept_team_invitation(
  p_invitation_id UUID,
  p_investigator_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  SELECT * INTO v_invitation 
  FROM team_invitations 
  WHERE id = p_invitation_id 
  AND to_investigator_id = p_investigator_id
  AND status = 'pending';
  
  IF v_invitation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found');
  END IF;
  
  UPDATE team_invitations
  SET 
    status = 'accepted',
    responded_at = NOW()
  WHERE id = p_invitation_id;
  
  INSERT INTO case_team_members (
    case_id,
    investigator_id,
    role,
    status,
    joined_at
  ) VALUES (
    v_invitation.case_id,
    p_investigator_id,
    'member',
    'active',
    NOW()
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Reject team invitation
CREATE OR REPLACE FUNCTION reject_team_invitation(
  p_invitation_id UUID,
  p_investigator_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE team_invitations
  SET 
    status = 'rejected',
    responded_at = NOW()
  WHERE id = p_invitation_id
  AND to_investigator_id = p_investigator_id
  AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found');
  END IF;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Remove team member
CREATE OR REPLACE FUNCTION remove_team_member(
  p_case_id UUID,
  p_investigator_id UUID,
  p_removed_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM case_team_members
    WHERE case_id = p_case_id
    AND investigator_id = p_removed_by
    AND role = 'leader'
    AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only team leader can remove members');
  END IF;
  
  UPDATE case_team_members
  SET 
    status = 'removed',
    left_at = NOW()
  WHERE case_id = p_case_id
  AND investigator_id = p_investigator_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Leave team
CREATE OR REPLACE FUNCTION leave_team(
  p_case_id UUID,
  p_investigator_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE case_team_members
  SET 
    status = 'left',
    left_at = NOW()
  WHERE case_id = p_case_id
  AND investigator_id = p_investigator_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a team member');
  END IF;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Set reward split
CREATE OR REPLACE FUNCTION set_reward_split(
  p_case_id UUID,
  p_splits JSONB,
  p_set_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_split RECORD;
  v_total INTEGER := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM case_team_members
    WHERE case_id = p_case_id
    AND investigator_id = p_set_by
    AND role = 'leader'
    AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only team leader can set splits');
  END IF;
  
  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits) LOOP
    v_total := v_total + (v_split.value->>'percentage')::INTEGER;
  END LOOP;
  
  IF v_total != 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Splits must total 100%');
  END IF;
  
  FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits) LOOP
    UPDATE case_team_members
    SET contribution_percentage = (v_split.value->>'percentage')::INTEGER
    WHERE case_id = p_case_id
    AND investigator_id = (v_split.value->>'investigator_id')::UUID;
  END LOOP;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

--------------------------------------------------------------------------------
-- Section: Case Following & Notification Functions
--------------------------------------------------------------------------------

-- Follow case (authenticated users)
CREATE OR REPLACE FUNCTION follow_case(
  p_case_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO case_followers (case_id, user_id, notify_on_update)
  VALUES (p_case_id, p_user_id, true)
  ON CONFLICT (case_id, user_id) DO NOTHING;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Follow case for guest (email notification)
CREATE OR REPLACE FUNCTION follow_case_guest(
  p_case_id UUID,
  p_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Placeholder for guest following
  RETURN jsonb_build_object('success', true, 'message', 'Guest following registered');
END;
$$;

-- Unfollow case
CREATE OR REPLACE FUNCTION unfollow_case(
  p_case_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM case_followers
  WHERE case_id = p_case_id
  AND user_id = p_user_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Send direct message
CREATE OR REPLACE FUNCTION send_message(
  p_sender_id UUID,
  p_recipient_id UUID,
  p_subject TEXT,
  p_content TEXT,
  p_case_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message_id UUID;
BEGIN
  INSERT INTO messages (sender_id, recipient_id, subject, content, case_id)
  VALUES (p_sender_id, p_recipient_id, p_subject, p_content, p_case_id)
  RETURNING id INTO v_message_id;
  
  RETURN jsonb_build_object('success', true, 'message_id', v_message_id);
END;
$$;

-- Get case messages
CREATE OR REPLACE FUNCTION get_case_messages(
  p_case_id UUID,
  p_user_id UUID
)
RETURNS SETOF messages
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM messages
  WHERE case_id = p_case_id
  AND (sender_id = p_user_id OR recipient_id = p_user_id)
  ORDER BY created_at DESC;
END;
$$;

-- Mark message as read
CREATE OR REPLACE FUNCTION mark_message_read(
  p_message_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE messages
  SET read_at = NOW()
  WHERE id = p_message_id
  AND recipient_id = p_user_id
  AND read_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Message not found');
  END IF;
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Create notification (helper)
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_case_id UUID DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, case_id, action_url, metadata)
  VALUES (p_user_id, p_type, p_title, p_message, p_case_id, p_action_url, p_metadata)
  RETURNING id INTO v_notification_id;
  
  RETURN jsonb_build_object('success', true, 'notification_id', v_notification_id);
END;
$$;

--------------------------------------------------------------------------------
-- Section: Comment & Forum Functions
--------------------------------------------------------------------------------

-- Increment comment likes
CREATE OR REPLACE FUNCTION increment_comment_likes(
  p_comment_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE comments
  SET likes = likes + 1
  WHERE id = p_comment_id;
END;
$$;

-- Increment forum thread views
CREATE OR REPLACE FUNCTION increment_forum_thread_views(
  p_thread_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE forum_threads
  SET views = COALESCE(views, 0) + 1
  WHERE id = p_thread_id;
END;
$$;

--------------------------------------------------------------------------------
-- Section: Verification Functions
--------------------------------------------------------------------------------

-- Get verification status
CREATE OR REPLACE FUNCTION get_verification_status(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_kyc RECORD;
BEGIN
  SELECT * INTO v_kyc FROM kyc_verification WHERE user_id = p_user_id;
  
  IF v_kyc IS NULL THEN
    RETURN jsonb_build_object(
      'verified', false,
      'status', 'not_started',
      'level', 0
    );
  END IF;
  
  RETURN jsonb_build_object(
    'verified', v_kyc.status = 'approved',
    'status', v_kyc.status,
    'level', v_kyc.verification_level,
    'verified_at', v_kyc.verified_at
  );
END;
$$;

-- Request background check
CREATE OR REPLACE FUNCTION request_background_check(
  p_user_id UUID,
  p_documents JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_check_id UUID;
BEGIN
  INSERT INTO background_checks (
    investigator_id,
    status,
    documents
  ) VALUES (
    p_user_id,
    'pending',
    p_documents
  )
  RETURNING id INTO v_check_id;
  
  RETURN jsonb_build_object('success', true, 'check_id', v_check_id);
END;
$$;

--------------------------------------------------------------------------------
-- Section: GRANT Permissions for All Functions
--------------------------------------------------------------------------------

-- Case functions
GRANT EXECUTE ON FUNCTION increment_case_views(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION process_case_resolution(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_voting_outcome(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_resolve_dispute(UUID, TEXT, UUID) TO authenticated;

-- Team collaboration functions
GRANT EXECUTE ON FUNCTION claim_case_as_leader(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_team_invitation(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_team_invitation(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_team_member(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION leave_team(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION set_reward_split(UUID, JSONB, UUID) TO authenticated;

-- Following & notification functions
GRANT EXECUTE ON FUNCTION follow_case(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION follow_case_guest(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION unfollow_case(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION send_message(UUID, UUID, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_case_messages(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_message_read(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification(UUID, TEXT, TEXT, TEXT, UUID, TEXT, JSONB) TO authenticated;

-- Comment & forum functions
GRANT EXECUTE ON FUNCTION increment_comment_likes(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION increment_forum_thread_views(UUID) TO authenticated, anon;

-- Verification functions
GRANT EXECUTE ON FUNCTION get_verification_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION request_background_check(UUID, JSONB) TO authenticated;

-- Wallet deposit function
GRANT EXECUTE ON FUNCTION add_user_balance(UUID, DECIMAL, TEXT, TEXT) TO service_role;

--------------------------------------------------------------------------------
-- Section: Case Update Notifications
-- Functions and triggers for notifying users when cases are updated
--------------------------------------------------------------------------------

-- Function to send notifications when case is updated by investigator
CREATE OR REPLACE FUNCTION notify_case_update()
RETURNS TRIGGER AS $$
DECLARE
  v_case_owner_id UUID;
  v_case_title TEXT;
  v_investigator_name TEXT;
  v_follower RECORD;
  v_update_type TEXT;
BEGIN
  -- Get case owner ID and title
  SELECT user_id, title INTO v_case_owner_id, v_case_title
  FROM cases WHERE id = NEW.id;

  -- Get investigator name
  SELECT username INTO v_investigator_name
  FROM profiles WHERE id = NEW.investigator_id OR id = NEW.assigned_investigator_id;

  -- Set update type
  v_update_type := 'case_update';
  
  -- If status changed to INVESTIGATING, notify that investigator started work
  IF OLD.status != NEW.status AND NEW.status = 'INVESTIGATING' THEN
    v_update_type := 'investigation_started';
    
    -- Send notification to case owner
    INSERT INTO notifications (user_id, case_id, type, title, message, action_url)
    VALUES (
      v_case_owner_id,
      NEW.id,
      v_update_type,
      'Investigator started working on your case! 🔍',
      'Investigator ' || COALESCE(v_investigator_name, 'Unknown') || ' started investigating your case: "' || v_case_title || '"',
      '/cases/' || NEW.id
    );
  END IF;

  -- If investigation_log changed (new notes added)
  IF OLD.investigation_log IS DISTINCT FROM NEW.investigation_log THEN
    -- Send notification to case owner
    INSERT INTO notifications (user_id, case_id, type, title, message, action_url)
    VALUES (
      v_case_owner_id,
      NEW.id,
      'case_update',
      'Investigator added new information to your case 📝',
      'Investigator ' || COALESCE(v_investigator_name, 'Unknown') || ' updated case: "' || v_case_title || '"',
      '/cases/' || NEW.id
    );

    -- Send notification to all followers
    FOR v_follower IN 
      SELECT user_id, guest_email 
      FROM case_followers 
      WHERE case_id = NEW.id 
        AND notify_on_update = TRUE
        AND user_id != v_case_owner_id -- Don't send duplicate to owner
    LOOP
      IF v_follower.user_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, case_id, type, title, message, action_url)
        VALUES (
          v_follower.user_id,
          NEW.id,
          'case_update',
          'Case updated 🔔',
          'Case "' || v_case_title || '" received an update from investigator',
          '/cases/' || NEW.id
        );
      END IF;
      -- TODO: Email sending for guests (can be done later)
    END LOOP;
  END IF;

  -- If documents changed (new documents added)
  IF OLD.documents IS DISTINCT FROM NEW.documents THEN
    -- Send notification to case owner
    INSERT INTO notifications (user_id, case_id, type, title, message, action_url)
    VALUES (
      v_case_owner_id,
      NEW.id,
      'case_update',
      'Investigator added new documents 📎',
      'New documents were added to case "' || v_case_title || '"',
      '/cases/' || NEW.id
    );

    -- Send notification to followers
    FOR v_follower IN 
      SELECT user_id 
      FROM case_followers 
      WHERE case_id = NEW.id 
        AND notify_on_update = TRUE
        AND user_id != v_case_owner_id
    LOOP
      IF v_follower.user_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, case_id, type, title, message, action_url)
        VALUES (
          v_follower.user_id,
          NEW.id,
          'case_update',
          'New documents added 📎',
          'New documents were added to case "' || v_case_title || '"',
          '/cases/' || NEW.id
        );
      END IF;
    END LOOP;
  END IF;

  -- If resolution_proposal changed (investigator submitted report)
  IF OLD.resolution_proposal IS DISTINCT FROM NEW.resolution_proposal AND NEW.resolution_proposal IS NOT NULL THEN
    -- Send notification to case owner
    INSERT INTO notifications (user_id, case_id, type, title, message, action_url)
    VALUES (
      v_case_owner_id,
      NEW.id,
      'resolution_submitted',
      'Investigator submitted final report! ✅',
      'Investigator ' || COALESCE(v_investigator_name, 'Unknown') || ' submitted resolution for case: "' || v_case_title || '". Please review and confirm.',
      '/cases/' || NEW.id
    );

    -- Send notification to followers
    FOR v_follower IN 
      SELECT user_id 
      FROM case_followers 
      WHERE case_id = NEW.id 
        AND notify_on_resolution = TRUE
        AND user_id != v_case_owner_id
    LOOP
      IF v_follower.user_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, case_id, type, title, message, action_url)
        VALUES (
          v_follower.user_id,
          NEW.id,
          'resolution_submitted',
          'Final report submitted ✅',
          'Final report for case "' || v_case_title || '" is ready',
          '/cases/' || NEW.id
        );
      END IF;
    END LOOP;
  END IF;

  -- If status changed to PENDING_REVIEW
  IF OLD.status != NEW.status AND NEW.status = 'PENDING_REVIEW' THEN
    -- Send notification to case owner
    INSERT INTO notifications (user_id, case_id, type, title, message, action_url)
    VALUES (
      v_case_owner_id,
      NEW.id,
      'resolution_submitted',
      'Case awaits your review! 👀',
      'Investigator completed investigation for case: "' || v_case_title || '". Please review the results and decide.',
      '/cases/' || NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION notify_case_update() IS 
  'Sends notifications when investigator updates case - logs, documents, or proposal';

-- Trigger to detect case updates
DROP TRIGGER IF EXISTS trigger_notify_case_update ON cases;

CREATE TRIGGER trigger_notify_case_update
  AFTER UPDATE ON cases
  FOR EACH ROW
  WHEN (
    OLD.investigation_log IS DISTINCT FROM NEW.investigation_log OR
    OLD.documents IS DISTINCT FROM NEW.documents OR
    OLD.resolution_proposal IS DISTINCT FROM NEW.resolution_proposal OR
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.investigator_notes IS DISTINCT FROM NEW.investigator_notes
  )
  EXECUTE FUNCTION notify_case_update();

COMMENT ON TRIGGER trigger_notify_case_update ON cases IS 
  'Sends notifications to case owner and followers when investigator updates the case';

-- Function to send notification when investigator is assigned
CREATE OR REPLACE FUNCTION notify_investigator_assigned()
RETURNS TRIGGER AS $$
DECLARE
  v_case_title TEXT;
  v_case_owner_id UUID;
  v_investigator_name TEXT;
BEGIN
  -- If investigator was assigned for the first time
  IF OLD.investigator_id IS NULL AND NEW.investigator_id IS NOT NULL 
     OR OLD.assigned_investigator_id IS NULL AND NEW.assigned_investigator_id IS NOT NULL THEN
    
    -- Get case data
    SELECT title, user_id INTO v_case_title, v_case_owner_id
    FROM cases WHERE id = NEW.id;

    -- Get investigator name
    SELECT username INTO v_investigator_name
    FROM profiles WHERE id = COALESCE(NEW.investigator_id, NEW.assigned_investigator_id);

    -- Send notification to case owner
    INSERT INTO notifications (user_id, case_id, type, title, message, action_url)
    VALUES (
      v_case_owner_id,
      NEW.id,
      'investigator_assigned',
      'Investigator assigned to your case! 🎯',
      'Investigator ' || COALESCE(v_investigator_name, 'Unknown') || ' accepted your case: "' || v_case_title || '"',
      '/cases/' || NEW.id
    );

    -- Automatically add case owner as follower (if not already)
    INSERT INTO case_followers (case_id, user_id, notify_on_update, notify_on_comments, notify_on_resolution)
    VALUES (NEW.id, v_case_owner_id, TRUE, TRUE, TRUE)
    ON CONFLICT DO NOTHING;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION notify_investigator_assigned() IS 
  'Sends notification to case owner when investigator is assigned to case';

-- Trigger for investigator assignment
DROP TRIGGER IF EXISTS trigger_notify_investigator_assigned ON cases;

CREATE TRIGGER trigger_notify_investigator_assigned
  AFTER UPDATE ON cases
  FOR EACH ROW
  WHEN (
    (OLD.investigator_id IS DISTINCT FROM NEW.investigator_id AND NEW.investigator_id IS NOT NULL) OR
    (OLD.assigned_investigator_id IS DISTINCT FROM NEW.assigned_investigator_id AND NEW.assigned_investigator_id IS NOT NULL)
  )
  EXECUTE FUNCTION notify_investigator_assigned();