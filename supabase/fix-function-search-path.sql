-- Fix function_search_path_mutable security warnings
-- Sets explicit search_path for all public functions to prevent security vulnerabilities
-- This ensures functions only search in public and pg_catalog schemas

-- Core messaging and notifications
ALTER FUNCTION public.get_unread_team_message_count(p_case_id uuid, p_user_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.mark_all_notifications_read() SET search_path = public, pg_catalog;
ALTER FUNCTION public.mark_all_notifications_read(p_user_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.mark_notification_read(p_notification_id uuid, p_user_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.notify_case_update() SET search_path = public, pg_catalog;
ALTER FUNCTION public.notify_investigator_assigned() SET search_path = public, pg_catalog;
ALTER FUNCTION public.mark_message_read(p_message_id uuid, p_user_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.send_message(p_case_id uuid, p_sender_id uuid, p_recipient_id uuid, p_content text, p_attachment_url text) SET search_path = public, pg_catalog;
ALTER FUNCTION public.mark_team_messages_read(p_case_id uuid, p_user_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_case_messages(p_case_id uuid, p_user_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.room_messages_broadcast_trigger() SET search_path = public, pg_catalog;
ALTER FUNCTION public.initialize_notification_preferences() SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_notification_prefs_updated_at() SET search_path = public, pg_catalog;

-- Subscription management
ALTER FUNCTION public.get_subscription_group_members(p_group_code text) SET search_path = public, pg_catalog;
ALTER FUNCTION public.reset_monthly_subscription_credits() SET search_path = public, pg_catalog;
ALTER FUNCTION public.deduct_subscription_credits(p_user_id uuid, p_tool_name text, p_credits_cost integer, p_case_id uuid, p_metadata jsonb) SET search_path = public, pg_catalog;
ALTER FUNCTION public.initialize_subscription_credits(p_user_id uuid, p_subscription_id uuid, p_plan_code text, p_billing_cycle text) SET search_path = public, pg_catalog;
ALTER FUNCTION public.check_subscription_credits(p_user_id uuid, p_credits_required integer) SET search_path = public, pg_catalog;
ALTER FUNCTION public.expire_onetime_subscriptions() SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_group_member_counts() SET search_path = public, pg_catalog;

-- Payment and wallet functions
ALTER FUNCTION public.release_escrow_to_investigator(p_case_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.increment_case_escrow(case_id uuid, amount numeric) SET search_path = public, pg_catalog;
ALTER FUNCTION public.process_withdrawal(p_user_id uuid, p_amount numeric, p_fee numeric) SET search_path = public, pg_catalog;
ALTER FUNCTION public.refund_failed_withdrawal(p_user_id uuid, p_amount numeric) SET search_path = public, pg_catalog;
ALTER FUNCTION public.check_withdrawal_rate_limit(p_user_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.donate_from_wallet(p_user_id uuid, p_case_id uuid, p_amount numeric) SET search_path = public, pg_catalog;
ALTER FUNCTION public.process_direct_donation(p_case_id uuid, p_amount numeric, p_stripe_payment_intent_id text, p_user_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.process_platform_donation(p_user_id uuid, p_amount numeric) SET search_path = public, pg_catalog;
ALTER FUNCTION public.unreserve_wallet_balance(p_user_id uuid, p_amount numeric) SET search_path = public, pg_catalog;
ALTER FUNCTION public.record_platform_fee(p_amount numeric, p_type text, p_reference_id text) SET search_path = public, pg_catalog;

-- Investigator management
ALTER FUNCTION public.get_all_investigators() SET search_path = public, pg_catalog;
ALTER FUNCTION public.demote_investigator(action_data jsonb) SET search_path = public, pg_catalog;
ALTER FUNCTION public.check_investigator_application(p_user_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_pending_investigator_applications() SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_my_investigator_application() SET search_path = public, pg_catalog;
ALTER FUNCTION public.submit_investigator_application(application_data jsonb) SET search_path = public, pg_catalog;
ALTER FUNCTION public.reject_investigator_application_wrapper(action_data jsonb) SET search_path = public, pg_catalog;
ALTER FUNCTION public.approve_investigator_application_wrapper(action_data jsonb) SET search_path = public, pg_catalog;
ALTER FUNCTION public.sync_investigator_ids() SET search_path = public, pg_catalog;

-- Case management
ALTER FUNCTION public.auto_follow_own_case() SET search_path = public, pg_catalog;
ALTER FUNCTION public.process_case_resolution(p_case_id uuid, p_investigator_id uuid, p_submitter_id uuid, p_user_rating integer, p_resolution_accepted boolean) SET search_path = public, pg_catalog;
ALTER FUNCTION public.process_case_resolution(p_case_id uuid, p_investigator_id uuid, p_submitter_id uuid, p_user_rating integer, p_resolution_accepted boolean, p_user_feedback text) SET search_path = public, pg_catalog;
ALTER FUNCTION public.distribute_team_reward(p_case_id uuid, p_total_amount numeric) SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_case_team(p_case_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.auto_add_investigator_to_team() SET search_path = public, pg_catalog;
ALTER FUNCTION public.invite_team_member(p_case_id uuid, p_from_investigator_id uuid, p_to_investigator_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.admin_resolve_dispute(p_case_id uuid, p_admin_id uuid, p_resolution text, p_approve_investigator boolean) SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_admin_cases_paginated(p_limit integer, p_offset integer, p_status text, p_from_date timestamp with time zone) SET search_path = public, pg_catalog;

-- Voting and engagement
ALTER FUNCTION public.update_theory_vote_count() SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_comment_vote_count() SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_case_theories_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_case_notes_updated_at() SET search_path = public, pg_catalog;

-- Admin functions
ALTER FUNCTION public.get_admin_user_stats() SET search_path = public, pg_catalog;
ALTER FUNCTION public.is_admin(user_id uuid) SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_admin_transactions_paginated(p_limit integer, p_offset integer, p_from_date timestamp with time zone, p_to_date timestamp with time zone) SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_verification_status(p_user_id uuid) SET search_path = public, pg_catalog;

-- Utility functions
ALTER FUNCTION public.update_timestamp() SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_catalog;
ALTER FUNCTION public.cleanup_old_webhook_events() SET search_path = public, pg_catalog;
ALTER FUNCTION public.process_webhook_event(p_stripe_event_id text, p_event_type text, p_payload jsonb) SET search_path = public, pg_catalog;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Fixed search_path for all functions';
  RAISE NOTICE 'All functions now use explicit search_path = public, pg_catalog';
  RAISE NOTICE 'This prevents search_path injection attacks';
END $$;
