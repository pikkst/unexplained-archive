-- =============================================
-- FIX FUNCTION SEARCH PATHS
-- Addresses database linter errors: "Function Search Path Mutable"
-- Sets search_path to 'public, extensions, pg_temp' for security
-- =============================================

DO $$
DECLARE
    r RECORD;
    -- List of functions identified by the linter
    func_names text[] := ARRAY[
        'track_boost_impression', 
        'validate_wallet_owner', 
        'get_case_team', 
        'track_boost_click', 
        'expire_old_boosts', 
        'donate_from_wallet', 
        'create_user_wallet', 
        'send_message', 
        'mark_message_read', 
        'get_case_messages', 
        'create_notification', 
        'mark_notification_read', 
        'mark_all_notifications_read', 
        'follow_case', 
        'follow_case_guest', 
        'unfollow_case', 
        'notify_case_update', 
        'notify_new_comment', 
        'increment_forum_thread_views', 
        'can_use_translation', 
        'get_user_translation_count', 
        'create_wallet_on_role_change', 
        'increment_article_views', 
        'update_updated_at_column', 
        'increment_case_views', 
        'increment_comment_likes', 
        'flag_suspicious_content', 
        'update_wallet_on_transaction', 
        'add_wallet_balance', 
        'subtract_wallet_balance', 
        'request_background_check', 
        'activate_pro_subscription', 
        'release_escrow_to_investigator', 
        'reject_resolution_escalate_admin', 
        'admin_resolve_dispute_release', 
        'admin_resolve_dispute_refund', 
        'send_case_to_community_vote', 
        'process_case_resolution_payout', 
        'cast_community_vote', 
        'finalize_community_vote', 
        'auto_finalize_expired_votes', 
        'notify_case_resolution', 
        'activate_subscription', 
        'cancel_subscription', 
        'expire_past_due_subscriptions', 
        'claim_case_as_leader', 
        'invite_team_member', 
        'accept_team_invitation', 
        'reject_team_invitation', 
        'remove_team_member', 
        'leave_team', 
        'set_reward_split', 
        'distribute_team_reward', 
        'auto_calculate_reward_split', 
        'trigger_welcome_notification', 
        'process_direct_donation', 
        'send_mass_notification', 
        'send_welcome_notification', 
        'send_user_notification', 
        'create_wallet_on_signup', 
        'increment_case_escrow', 
        'create_wallet_for_user', 
        'ensure_wallet_exists', 
        'process_withdrawal', 
        'reward_investigator_reputation', 
        'penalize_investigator_reputation', 
        'penalize_submitter_trust', 
        'reward_submitter', 
        'update_transaction_limits_on_kyc', 
        'reset_transaction_limits', 
        'process_refund', 
        'admin_resolve_dispute', 
        'release_case_escrow', 
        'refund_case_escrow', 
        'process_case_resolution', 
        'process_voting_outcome', 
        'reject_investigator_application', 
        'check_investigator_application', 
        'get_follower_count', 
        'is_following_case', 
        'submit_investigator_application', 
        'approve_investigator_application_wrapper', 
        'reject_investigator_application_wrapper', 
        'get_pending_investigator_applications', 
        'approve_investigator_application', 
        'process_wallet_donation', 
        'cancel_pro_subscription', 
        'is_case_boosted', 
        'get_verification_status', 
        'purchase_case_boost', 
        'get_active_boosts', 
        'complete_background_check', 
        'get_user_boost_analytics'
    ];
BEGIN
    FOR r IN
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc
        WHERE proname = ANY(func_names)
        AND pronamespace = 'public'::regnamespace
    LOOP
        -- Execute the ALTER FUNCTION statement dynamically
        -- We explicitly set search_path to include public and extensions
        EXECUTE 'ALTER FUNCTION ' || r.func_signature || ' SET search_path = public, extensions, pg_temp';
    END LOOP;
END $$;