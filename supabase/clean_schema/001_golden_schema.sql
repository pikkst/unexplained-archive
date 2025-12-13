-- Unexplained Archive - Golden Schema
-- Version: 1.0
-- Date: 2025-12-07
-- Description: This script contains the complete and consolidated schema for the database.
-- It is intended to be run on a clean database to set up the entire structure from scratch.

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "citext";

-- 2. Schemas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS realtime;
CREATE SCHEMA IF NOT EXISTS vault;
CREATE SCHEMA IF NOT EXISTS graphql;
CREATE SCHEMA IF NOT EXISTS graphql_public;

--------------------------------------------------------------------------------
-- Section: Public Tables
-- All application-specific tables reside in the 'public' schema.
--------------------------------------------------------------------------------

-- Profiles (Users)
-- Stores public-facing user information and links to auth.users.
CREATE TABLE public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username text UNIQUE,
    full_name text,
    avatar_url text,
    bio text,
    role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'investigator', 'admin')),
    reputation integer DEFAULT 0,
    location text,
    website text,
    preferred_language text DEFAULT 'en',
    verification_status text DEFAULT 'unverified',
    experience_level text,
    is_pro_member boolean DEFAULT false, -- Pro subscription status
    stripe_customer_id text, -- Stripe customer ID for payment processing
    -- Investigator-specific fields
    investigator_status text DEFAULT 'pending' CHECK (investigator_status IN ('pending', 'approved', 'rejected', 'suspended')),
    investigator_bio text,
    investigator_expertise text[],
    investigator_certifications jsonb DEFAULT '[]'::jsonb,
    investigator_experience text,
    investigator_verification_notes text,
    investigator_approved_at timestamptz,
    investigator_approved_by uuid REFERENCES public.profiles(id),
    cases_solved integer DEFAULT 0,
    success_rate numeric(5,2) DEFAULT 0.00,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.profiles IS 'Stores public user profiles, linked to authentication.';

-- Wallets
-- Manages user balances and Stripe connectivity.
CREATE TABLE public.wallets (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    balance numeric(10, 2) DEFAULT 0.00 CHECK (balance >= 0),
    reserved numeric(10, 2) DEFAULT 0.00, -- For pending withdrawals
    currency text DEFAULT 'EUR',
    stripe_account_id text, -- Simplified model: only for platform accounts
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.wallets IS 'Manages virtual balances for users.';

-- Cases
-- The core table for all user-submitted cases.
CREATE TABLE public.cases (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title text,
    description text,
    category text,
    date_occurred timestamptz,
    location text,
    latitude numeric,
    longitude numeric,
    media_urls text[] DEFAULT '{}',
    ai_generated boolean DEFAULT false,
    status text DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'INVESTIGATING', 'PENDING_REVIEW', 'RESOLVED', 'CLOSED', 'DISPUTED', 'VOTING', 'IN_PROGRESS')),
    investigator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    assigned_investigator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL, -- Alias for investigator_id
    views integer DEFAULT 0,
    is_team_case boolean DEFAULT false,
    reward_amount numeric(10, 2) DEFAULT 0.00, -- Consolidated from other tables
    -- Investigator work fields
    investigation_log jsonb DEFAULT '[]'::jsonb,
    resolution_proposal text,
    documents jsonb DEFAULT '[]'::jsonb,
    investigator_notes text,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.cases IS 'Central table for all user-submitted cases and investigations.';
COMMENT ON COLUMN public.cases.investigation_log IS 'JSONB array of investigator log entries with timestamp, content, and type';
COMMENT ON COLUMN public.cases.resolution_proposal IS 'Investigator final report/resolution text submitted for user review';
COMMENT ON COLUMN public.cases.documents IS 'JSONB array of attached documents with name, type, url, uploadedAt';
COMMENT ON COLUMN public.cases.investigator_notes IS 'Simple text notes from investigator (legacy field)';

-- Comments
-- Threaded comments for cases.
CREATE TABLE public.comments (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text,
    parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
    likes integer DEFAULT 0,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.comments IS 'Stores user comments on cases.';

-- Transactions
-- Logs all financial movements within the system.
CREATE TABLE public.transactions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL, -- Who initiated it
    from_wallet_id uuid REFERENCES public.wallets(id),
    to_wallet_id uuid REFERENCES public.wallets(id),
    amount numeric(10, 2) NOT NULL CHECK (amount > 0),
    currency text DEFAULT 'EUR',
    transaction_type text NOT NULL CHECK (transaction_type IN ('deposit', 'donation', 'case_reward', 'subscription_fee', 'withdrawal', 'platform_fee', 'refund', 'boost_payment', 'verification_fee')),
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'cancelled')),
    case_id uuid REFERENCES public.cases(id),
    stripe_payment_intent_id text UNIQUE,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT timezone('utc', now()),
    completed_at timestamptz
);
COMMENT ON TABLE public.transactions IS 'Records every financial transaction in the system.';

-- Subscriptions
-- Manages user subscriptions to premium plans (updated for new subscription system).
CREATE TABLE public.subscriptions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    plan_type text NOT NULL CHECK (plan_type IN ('basic', 'premium', 'pro', 'investigator_pro', 'user_premium')),
    status text DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'canceled', 'expired', 'past_due', 'trialing')),
    billing_cycle text CHECK (billing_cycle IN ('monthly', 'yearly', 'onetime')),
    stripe_subscription_id text UNIQUE,
    stripe_customer_id text,
    stripe_price_id text,
    cancel_at_period_end boolean DEFAULT false,
    canceled_at timestamptz,
    current_period_start timestamptz,
    current_period_end timestamptz,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.subscriptions IS 'Manages recurring user subscriptions.';

-- Subscription Plans (Static Configuration)
CREATE TABLE public.subscription_plans (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_code text UNIQUE NOT NULL,
    plan_name text NOT NULL,
    plan_name_et text,
    plan_name_ru text,
    description text,
    description_et text,
    description_ru text,
    price_monthly numeric(10, 2) NOT NULL,
    price_yearly numeric(10, 2) NOT NULL,
    price_onetime numeric(10, 2),
    ai_credits_monthly integer NOT NULL,
    processing_speed text DEFAULT 'standard' CHECK (processing_speed IN ('standard', 'fast', 'fastest')),
    boost_discount integer DEFAULT 0,
    boost_free_monthly integer DEFAULT 0,
    support_level text DEFAULT 'standard' CHECK (support_level IN ('standard', 'priority', 'dedicated')),
    team_members integer DEFAULT 1,
    api_access boolean DEFAULT false,
    api_requests_monthly integer DEFAULT 0,
    features jsonb DEFAULT '{}',
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.subscription_plans IS 'Investigator subscription plan configurations (Basic, Premium, Pro).';

-- Subscription Credits (User Credit Balance)
CREATE TABLE public.subscription_credits (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    credits_total integer DEFAULT 0,
    credits_used integer DEFAULT 0,
    credits_remaining integer GENERATED ALWAYS AS (credits_total - credits_used) STORED,
    billing_cycle text DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly', 'onetime')),
    current_period_start timestamptz DEFAULT timezone('utc', now()),
    current_period_end timestamptz,
    resets_at timestamptz,
    expires_at timestamptz,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.subscription_credits IS 'Tracks AI credit balances for subscribed users.';

-- Subscription Usage Log (Track AI Tool Usage)
CREATE TABLE public.subscription_usage_log (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
    tool_name text NOT NULL,
    credits_cost integer NOT NULL,
    api_cost numeric(10, 4) DEFAULT 0.00,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.subscription_usage_log IS 'Logs AI tool usage and credit consumption.';

-- Subscription Transactions (Payment History)
CREATE TABLE public.subscription_transactions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    plan_code text NOT NULL,
    amount numeric(10, 2) NOT NULL,
    currency text DEFAULT 'EUR' NOT NULL,
    billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly', 'onetime')),
    payment_method text DEFAULT 'stripe' CHECK (payment_method IN ('stripe', 'wallet')),
    stripe_payment_intent_id text,
    stripe_invoice_id text,
    wallet_transaction_id uuid,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    period_start timestamptz,
    period_end timestamptz,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT timezone('utc', now()),
    completed_at timestamptz
);
COMMENT ON TABLE public.subscription_transactions IS 'Payment history for subscriptions.';

-- Subscription Notification Groups (For mass notifications)
CREATE TABLE public.subscription_notification_groups (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_code text UNIQUE NOT NULL,
    group_name text NOT NULL,
    description text,
    criteria jsonb DEFAULT '{}',
    member_count integer DEFAULT 0,
    last_notification_sent_at timestamptz,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.subscription_notification_groups IS 'Groups for targeted mass notifications to subscribers.';

-- Mass Notifications Log
CREATE TABLE public.mass_notifications (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject text NOT NULL,
    message text NOT NULL,
    notification_type text DEFAULT 'announcement' CHECK (notification_type IN ('announcement', 'update', 'promotion', 'warning', 'reminder')),
    target_group_code text REFERENCES public.subscription_notification_groups(group_code),
    target_user_ids uuid[],
    delivery_method text DEFAULT 'email' CHECK (delivery_method IN ('email', 'in_app', 'both')),
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'completed', 'failed')),
    total_recipients integer DEFAULT 0,
    sent_count integer DEFAULT 0,
    failed_count integer DEFAULT 0,
    sent_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT timezone('utc', now()),
    scheduled_at timestamptz,
    started_at timestamptz,
    completed_at timestamptz
);
COMMENT ON TABLE public.mass_notifications IS 'Mass notification campaigns to user groups.';

-- Notifications
-- Stores notifications for users.
CREATE TABLE public.notifications (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    case_id uuid REFERENCES public.cases(id),
    type text,
    title text,
    message text,
    action_url text,
    read_at timestamptz,
    metadata jsonb, -- Added from migration
    created_at timestamptz DEFAULT now()
);
COMMENT ON TABLE public.notifications IS 'Stores user notifications for various events.';

-- Forum Threads and Posts (from migration)
CREATE TABLE public.forum_threads (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    case_id uuid REFERENCES public.cases(id),
    title text NOT NULL,
    body text,
    is_pinned boolean DEFAULT false,
    is_locked boolean DEFAULT false,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.forum_threads IS 'Threads for forum discussions.';

CREATE TABLE public.forum_posts (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    thread_id uuid NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body text NOT NULL,
    parent_post_id uuid REFERENCES public.forum_posts(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.forum_posts IS 'Posts within a forum thread.';

-- Stripe Accounts (Platform Internal)
CREATE TABLE public.stripe_accounts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_type text UNIQUE NOT NULL CHECK (account_type IN ('operations', 'revenue')),
  stripe_account_id text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.stripe_accounts IS 'Stores the two primary Stripe account IDs for the platform.';

-- Withdrawal Requests
CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(10, 2) NOT NULL,
  fee numeric(10, 2) NOT NULL,
  net_amount numeric(10, 2) NOT NULL,
  bank_name text,
  iban text,
  account_holder text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  stripe_payout_id text UNIQUE,
  failure_reason text,
  requested_at timestamptz DEFAULT timezone('utc', now()),
  processed_at timestamptz,
  completed_at timestamptz
);
COMMENT ON TABLE public.withdrawal_requests IS 'Queue for processing investigator withdrawal requests.';

-- Add other tables from manual_schema_reset and other migrations here after consolidation...

-- Final indexes
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles USING btree(username);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON public.profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_investigator_status ON public.profiles(investigator_status) WHERE role = 'investigator';
CREATE INDEX IF NOT EXISTS idx_cases_user_id ON public.cases(user_id);
CREATE INDEX IF NOT EXISTS idx_cases_investigation_log ON public.cases USING GIN (investigation_log);
CREATE INDEX IF NOT EXISTS idx_cases_documents ON public.cases USING GIN (documents);
CREATE INDEX IF NOT EXISTS idx_comments_case_id ON public.comments(case_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_case_id ON public.transactions(case_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_case ON public.notifications(user_id, case_id, read_at);

-- Subscription indexes
CREATE INDEX IF NOT EXISTS idx_subscription_credits_user ON public.subscription_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_credits_active ON public.subscription_credits(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_usage_log_user ON public.subscription_usage_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_log_subscription ON public.subscription_usage_log(subscription_id);
CREATE INDEX IF NOT EXISTS idx_usage_log_tool ON public.subscription_usage_log(tool_name);
CREATE INDEX IF NOT EXISTS idx_subscription_transactions_user ON public.subscription_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_transactions_stripe ON public.subscription_transactions(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_mass_notifications_status ON public.mass_notifications(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mass_notifications_group ON public.mass_notifications(target_group_code);

-- Team collaboration indexes
CREATE INDEX IF NOT EXISTS idx_team_members_case ON public.case_team_members(case_id);
CREATE INDEX IF NOT EXISTS idx_team_members_investigator ON public.case_team_members(investigator_id);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON public.case_team_members(case_id, status);
CREATE INDEX IF NOT EXISTS idx_team_messages_case ON public.case_team_messages(case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_messages_sender ON public.case_team_messages(sender_id);

-- End of schema definition
-- Investigator Applications & Verification
-- This table replaces the old 'investigators' table and links to the kyc_verification process.
CREATE TABLE public.investigator_applications (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    motivation text,
    expertise text[] DEFAULT '{}',
    experience text,
    certifications jsonb DEFAULT '[]',
    documents jsonb DEFAULT '[]',
    credentials text, -- Legacy field
    specialization text[], -- Legacy field
    status text DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
    reviewed_by uuid REFERENCES public.profiles(id),
    reviewed_at timestamptz,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.investigator_applications IS 'Handles applications for users to become investigators.';

CREATE INDEX IF NOT EXISTS idx_investigator_applications_user ON public.investigator_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_investigator_applications_status ON public.investigator_applications(status);

-- KYC (Know Your Customer) Verification
CREATE TABLE public.kyc_verification (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'review_needed')),
    verification_level integer DEFAULT 0,
    stripe_verification_session_id text,
    verified_at timestamptz,
    rejection_reason text,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.kyc_verification IS 'Tracks user KYC status for withdrawals and higher limits.';

-- Transaction Limits based on KYC
CREATE TABLE public.transaction_limits (
    user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    daily_limit numeric(10, 2) DEFAULT 100.00,
    monthly_limit numeric(10, 2) DEFAULT 500.00,
    daily_spent numeric(10, 2) DEFAULT 0.00,
    monthly_spent numeric(10, 2) DEFAULT 0.00,
    last_reset_daily timestamptz DEFAULT timezone('utc', now()),
    last_reset_monthly timestamptz DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.transaction_limits IS 'Manages per-user transaction limits, adjustable by KYC level.';

-- AI Usage Tracking
CREATE TABLE public.ai_usage (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    feature text NOT NULL CHECK (feature IN ('image_generation', 'analysis', 'enhancement', 'ocr', 'translation')),
    cost numeric(10, 4) DEFAULT 0.00,
    case_id uuid REFERENCES public.cases(id),
    metadata jsonb,
    created_at timestamptz DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.ai_usage IS 'Logs usage of AI-powered tools and associated costs.';

-- Boost Pricing Catalog
CREATE TABLE public.boost_pricing (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    boost_type text UNIQUE NOT NULL,
    display_name text NOT NULL,
    description text,
    duration_hours integer NOT NULL CHECK (duration_hours > 0),
    price numeric(10, 2) NOT NULL CHECK (price >= 0),
    currency text NOT NULL DEFAULT 'EUR',
    features text[] DEFAULT '{}',
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.boost_pricing IS 'Defines purchasable boost packages for featuring cases.';

-- Featured Cases (Premium Service)
CREATE TABLE public.featured_cases (
    case_id uuid PRIMARY KEY REFERENCES public.cases(id) ON DELETE CASCADE,
    paid_by uuid NOT NULL REFERENCES public.profiles(id),
    boost_type text NOT NULL REFERENCES public.boost_pricing(boost_type),
    featured_until timestamptz NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'expired', 'cancelled')),
    price_paid numeric(10, 2) NOT NULL CHECK (price_paid >= 0),
    currency text NOT NULL DEFAULT 'EUR',
    impressions integer NOT NULL DEFAULT 0,
    clicks integer NOT NULL DEFAULT 0,
    transaction_id uuid REFERENCES public.transactions(id),
    stripe_payment_id text,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.featured_cases IS 'Tracks currently and previously boosted cases along with performance metrics.';

CREATE INDEX IF NOT EXISTS idx_featured_cases_status_until ON public.featured_cases (status, featured_until DESC);
CREATE INDEX IF NOT EXISTS idx_featured_cases_paid_by ON public.featured_cases (paid_by);

-- Case Followers
CREATE TABLE public.case_followers (
    case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    notify_on_update boolean DEFAULT true,
    followed_at timestamptz DEFAULT timezone('utc', now()),
    PRIMARY KEY (case_id, user_id)
);
COMMENT ON TABLE public.case_followers IS 'Tracks which users are following which cases.';

-- Team Collaboration
CREATE TABLE public.case_team_members (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    investigator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role text DEFAULT 'member' CHECK (role IN ('leader', 'member')),
    contribution_percentage integer DEFAULT 0 CHECK (contribution_percentage >= 0 AND contribution_percentage <= 100),
    status text DEFAULT 'active' CHECK (status IN ('invited', 'active', 'inactive', 'left', 'removed')),
    invited_by uuid REFERENCES public.profiles(id),
    joined_at timestamptz,
    left_at timestamptz,
    notes text,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now()),
    CONSTRAINT unique_case_investigator UNIQUE(case_id, investigator_id, status)
);
COMMENT ON TABLE public.case_team_members IS 'Manages members of an investigation team for a specific case.';

-- Case Team Messages (Internal team communication)
CREATE TABLE public.case_team_messages (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message text NOT NULL,
    is_system_message boolean DEFAULT false,
    attachments jsonb DEFAULT '[]'::jsonb,
    read_by jsonb DEFAULT '[]'::jsonb,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.case_team_messages IS 'Internal chat messages between team members working on a case.';

-- Moderation & Admin
CREATE TABLE public.moderation_flags (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_type text NOT NULL CHECK (content_type IN ('case', 'comment', 'profile', 'message')),
    content_id uuid NOT NULL,
    reason text,
    flagged_by uuid NOT NULL REFERENCES public.profiles(id),
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
    reviewed_by uuid REFERENCES public.profiles(id),
    admin_notes text,
    created_at timestamptz DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.moderation_flags IS 'Stores user-submitted flags for content moderation.';

CREATE TABLE public.admin_actions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id uuid NOT NULL REFERENCES public.profiles(id),
    action_type text NOT NULL,
    target_type text,
    target_id uuid,
    reason text,
    metadata jsonb,
    created_at timestamptz DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.admin_actions IS 'Logs actions performed by administrators for auditing.';

-- Old/Redundant table notes:
-- 'investigators' table is replaced by 'investigator_applications' and 'profiles.role'.
-- 'donations' table is absorbed into the 'transactions' table with type 'donation'.
-- 'follows' table can be added later if social features are prioritized.
-- 'case_escrow' logic is handled by wallet balances and transaction statuses.

--------------------------------------------------------------------------------
-- Section: Admin Dashboard Support Tables
--------------------------------------------------------------------------------

-- Messages (Direct Messaging between users)
CREATE TABLE IF NOT EXISTS public.messages (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject text,
    content text NOT NULL,
    read_at timestamptz,
    case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.messages IS 'Direct messages between users.';

CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_read ON public.messages(recipient_id, read_at);

-- Background Checks (Investigator verification)
CREATE TABLE IF NOT EXISTS public.background_checks (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    investigator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'review_needed', 'completed')),
    documents jsonb DEFAULT '{}',
    notes text,
    reviewed_by uuid REFERENCES public.profiles(id),
    reviewed_at timestamptz,
    verified boolean DEFAULT false,
    badge_color text,
    verification_level text,
    completed_at timestamptz,
    expires_at timestamptz,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.background_checks IS 'Background verification checks for investigators.';

CREATE INDEX IF NOT EXISTS idx_background_checks_status ON public.background_checks(status);
CREATE INDEX IF NOT EXISTS idx_background_checks_investigator ON public.background_checks(investigator_id);

-- Platform Revenue (Track platform earnings)
CREATE TABLE IF NOT EXISTS public.platform_revenue (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    amount numeric(10, 2) NOT NULL,
    source text NOT NULL CHECK (source IN ('subscription', 'boost', 'verification_fee', 'platform_fee', 'other')),
    transaction_id uuid REFERENCES public.transactions(id),
    description text,
    created_at timestamptz DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.platform_revenue IS 'Tracks platform revenue from various sources.';

-- Analytics Events (Website analytics)
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    visitor_id text,
    user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    event_type text NOT NULL,
    page_path text,
    referrer text,
    country text,
    device_type text,
    session_duration integer,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.analytics_events IS 'Tracks website analytics and user behavior.';

CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON public.analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor ON public.analytics_events(visitor_id);

-- Blog Articles (Content management)
CREATE TABLE IF NOT EXISTS public.blog_articles (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    title text NOT NULL,
    slug text UNIQUE NOT NULL,
    content text NOT NULL,
    excerpt text,
    featured_image text,
    seo_keywords text[],
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    views integer DEFAULT 0,
    published_at timestamptz,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.blog_articles IS 'Blog articles for the platform.';

CREATE INDEX IF NOT EXISTS idx_blog_articles_status ON public.blog_articles(status);
CREATE INDEX IF NOT EXISTS idx_blog_articles_slug ON public.blog_articles(slug);

-- Team Invitations (Investigator team collaboration)
CREATE TABLE IF NOT EXISTS public.team_invitations (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    from_investigator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    to_investigator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message text,
    status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    created_at timestamptz DEFAULT timezone('utc', now()),
    responded_at timestamptz,
    CONSTRAINT unique_team_invitation UNIQUE(case_id, to_investigator_id, status)
);
COMMENT ON TABLE public.team_invitations IS 'Pending invitations for investigators to join case teams.';

CREATE INDEX IF NOT EXISTS idx_team_invitations_to ON public.team_invitations(to_investigator_id, status);
CREATE INDEX IF NOT EXISTS idx_team_invitations_case ON public.team_invitations(case_id);

--------------------------------------------------------------------------------
-- End of Golden Schema
-- Version: 2.0 (Updated 2025-12-12)
-- 
-- Note: This schema has been updated to include:
-- - Investigator subscription system (Basic, Premium, Pro plans)
-- - Team collaboration features (case_team_members, case_team_messages)
-- - Mass notification system for admins
-- - Updated subscription tracking and credits
-- 
-- Next steps:
-- 1. Run 002_functions_and_triggers.sql
-- 2. Run 003_rls_policies.sql
-- 3. Run 004_seeding.sql
--------------------------------------------------------------------------------