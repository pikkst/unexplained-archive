-- BEGIN restore_all.sql
-- 0) Basic settings
SET session_replication_role = DEFAULT;

-- 1) Extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "citext";

-- 2) Schemas (ensure standard Supabase schemas exist)
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS realtime;
CREATE SCHEMA IF NOT EXISTS vault;
CREATE SCHEMA IF NOT EXISTS graphql;
CREATE SCHEMA IF NOT EXISTS graphql_public;

-- 3) Public profiles table (basic profile mapping to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY,
    username text UNIQUE,
    full_name text,
    avatar_url text,
    bio text,
    role text NOT NULL DEFAULT 'user' CHECK (role = ANY (ARRAY['user','investigator','admin'])),
    reputation integer DEFAULT 0,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now()),
    location text,
    website text
);

-- 4) Core public tables
CREATE TABLE IF NOT EXISTS public.cases (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid,
    title text,
    description text,
    category text,
    date_occurred timestamptz,
    location text,
    latitude numeric,
    longitude numeric,
    media_urls text[] DEFAULT '{}',
    ai_generated boolean DEFAULT false,
    status text DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending','verified','investigating','closed'])),
    investigator_id uuid,
    views integer DEFAULT 0,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now()),
    team_leader_id uuid,
    is_team_case boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.comments (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id uuid,
    user_id uuid,
    content text,
    parent_id uuid,
    likes integer DEFAULT 0,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.investigators (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid UNIQUE,
    credentials text,
    specialization text[],
    verified boolean DEFAULT false,
    cases_solved integer DEFAULT 0,
    rating numeric DEFAULT 0.00,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.donations (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_user_id uuid,
    to_investigator_id uuid,
    amount numeric,
    currency text DEFAULT 'USD',
    message text,
    created_at timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.follows (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id uuid,
    following_id uuid,
    created_at timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.wallets (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid UNIQUE,
    balance numeric DEFAULT 0.00 CHECK (balance >= 0),
    currency text DEFAULT 'EUR',
    stripe_customer_id text UNIQUE,
    stripe_account_id text,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.transactions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_wallet_id uuid,
    to_wallet_id uuid,
    amount numeric CHECK (amount > 0),
    currency text DEFAULT 'EUR',
    transaction_type text CHECK (transaction_type = ANY (ARRAY['deposit','donation','reward','subscription','withdrawal','platform_fee','refund'])),
    status text DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending','completed','failed','refunded','cancelled'])),
    case_id uuid,
    stripe_payment_intent_id text UNIQUE,
    stripe_transfer_id text,
    description text,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT timezone('utc', now()),
    completed_at timestamptz,
    stripe_charge_id text,
    stripe_refund_id text,
    stripe_session_id text,
    escrow_status text
);

CREATE TABLE IF NOT EXISTS public.case_escrow (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id uuid UNIQUE,
    total_amount numeric DEFAULT 0.00,
    locked_amount numeric DEFAULT 0.00,
    currency text DEFAULT 'EUR',
    release_conditions jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid,
    plan_type text CHECK (plan_type = ANY (ARRAY['investigator_basic','investigator_pro','user_premium'])),
    status text DEFAULT 'active' CHECK (status = ANY (ARRAY['active','cancelled','expired','past_due','trialing'])),
    price numeric,
    currency text DEFAULT 'EUR',
    billing_cycle text DEFAULT 'monthly' CHECK (billing_cycle = ANY (ARRAY['monthly','yearly'])),
    stripe_subscription_id text UNIQUE,
    current_period_start timestamptz,
    current_period_end timestamptz,
    cancel_at_period_end boolean DEFAULT false,
    trial_end timestamptz,
    features jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now()),
    stripe_customer_id text,
    stripe_price_id text
);

CREATE TABLE IF NOT EXISTS public.ai_usage (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid,
    feature text CHECK (feature = ANY (ARRAY['image_generation','analysis','enhancement','ocr','translation'])),
    cost numeric,
    subscription_id uuid,
    case_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.kyc_verification (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid UNIQUE,
    status text DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending','approved','rejected','review_needed'])),
    verification_level integer DEFAULT 0 CHECK (verification_level >= 0 AND verification_level <= 2),
    stripe_verification_session_id text,
    verified_at timestamptz,
    expires_at timestamptz,
    rejection_reason text,
    admin_notes text,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.transaction_limits (
    user_id uuid PRIMARY KEY,
    daily_limit numeric DEFAULT 100.00,
    monthly_limit numeric DEFAULT 500.00,
    daily_spent numeric DEFAULT 0.00,
    monthly_spent numeric DEFAULT 0.00,
    last_reset_daily timestamptz DEFAULT timezone('utc', now()),
    last_reset_monthly timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.moderation_flags (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_type text CHECK (content_type = ANY (ARRAY['case','comment','profile','message'])),
    content_id uuid,
    reason text,
    severity text DEFAULT 'medium' CHECK (severity = ANY (ARRAY['low','medium','high','critical'])),
    flagged_by uuid,
    status text DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending','reviewed','actioned','dismissed'])),
    admin_id uuid,
    admin_notes text,
    action_taken text,
    created_at timestamptz DEFAULT timezone('utc', now()),
    reviewed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.admin_actions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id uuid,
    action_type text,
    target_type text,
    target_id uuid,
    reason text,
    metadata jsonb DEFAULT '{}',
    ip_address inet,
    created_at timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.user_bans (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid,
    banned_by uuid,
    reason text,
    ban_type text DEFAULT 'temporary' CHECK (ban_type = ANY (ARRAY['temporary','permanent'])),
    expires_at timestamptz,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.achievements (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    code text UNIQUE,
    name text,
    description text,
    icon_url text,
    points integer DEFAULT 0,
    rarity text DEFAULT 'common' CHECK (rarity = ANY (ARRAY['common','rare','epic','legendary'])),
    requirements jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.user_achievements (
    user_id uuid,
    achievement_id uuid,
    unlocked_at timestamptz DEFAULT timezone('utc', now()),
    PRIMARY KEY (user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS public.referrals (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id uuid,
    referee_id uuid,
    referral_code text,
    reward_amount numeric DEFAULT 5.00,
    status text DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending','completed','expired'])),
    completed_at timestamptz,
    created_at timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.challenges (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    title text,
    description text,
    challenge_type text,
    target integer,
    reward_amount numeric,
    reward_reputation integer,
    start_date timestamptz,
    end_date timestamptz,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.user_challenges (
    user_id uuid,
    challenge_id uuid,
    progress integer DEFAULT 0,
    completed boolean DEFAULT false,
    completed_at timestamptz,
    PRIMARY KEY (user_id, challenge_id)
);

CREATE TABLE IF NOT EXISTS public.featured_cases (
    case_id uuid PRIMARY KEY,
    featured_until timestamptz,
    price_paid numeric,
    position integer DEFAULT 1,
    impressions integer DEFAULT 0,
    clicks integer DEFAULT 0,
    created_at timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.messages (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id uuid,
    sender_id uuid,
    recipient_id uuid,
    content text,
    attachment_url text,
    read_at timestamp,
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid,
    case_id uuid,
    type text,
    title text,
    message text,
    action_url text,
    read_at timestamp,
    created_at timestamp DEFAULT now(),
    guest_email text
);

CREATE TABLE IF NOT EXISTS public.case_followers (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id uuid,
    user_id uuid,
    guest_email text,
    notify_on_update boolean DEFAULT true,
    notify_on_comments boolean DEFAULT true,
    notify_on_resolution boolean DEFAULT true,
    followed_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.case_team_members (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id uuid,
    investigator_id uuid,
    role text CHECK (role = ANY (ARRAY['leader','member'])),
    joined_at timestamp DEFAULT now(),
    invited_by uuid,
    contribution_percentage integer CHECK (contribution_percentage >=0 AND contribution_percentage <=100),
    status text DEFAULT 'active' CHECK (status = ANY (ARRAY['invited','active','left','removed'])),
    created_at timestamp DEFAULT now(),
    updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_invitations (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id uuid,
    from_investigator_id uuid,
    to_investigator_id uuid,
    message text,
    status text DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending','accepted','rejected','cancelled'])),
    created_at timestamp DEFAULT now(),
    responded_at timestamp
);

-- 5) Storage schema core tables
CREATE TYPE storage.buckettype AS ENUM ('STANDARD','ANALYTICS','VECTOR');
CREATE TABLE IF NOT EXISTS storage.buckets (
    id text PRIMARY KEY,
    name text,
    owner uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'
);

CREATE TABLE IF NOT EXISTS storage.objects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    last_accessed_at timestamptz DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/')) STORED,
    version text,
    owner_id text,
    user_metadata jsonb,
    "level" integer
);

CREATE TABLE IF NOT EXISTS storage.migrations (
    id integer PRIMARY KEY,
    name character varying UNIQUE,
    hash character varying,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS storage.prefixes (
    bucket_id text,
    name text,
    "level" integer GENERATED ALWAYS AS (storage.get_level(name)) STORED,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY (bucket_id, name, level)
);

CREATE TABLE IF NOT EXISTS storage.s3_multipart_uploads (
    id text PRIMARY KEY,
    in_progress_size bigint DEFAULT 0,
    upload_signature text,
    bucket_id text,
    key text,
    version text,
    owner_id text,
    created_at timestamptz DEFAULT now(),
    user_metadata jsonb
);

CREATE TABLE IF NOT EXISTS storage.s3_multipart_uploads_parts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id text,
    size bigint DEFAULT 0,
    part_number integer,
    bucket_id text,
    key text,
    etag text,
    owner_id text,
    version text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage.buckets_analytics (
    name text,
    type storage.buckettype DEFAULT 'ANALYTICS',
    format text DEFAULT 'ICEBERG',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS storage.buckets_vectors (
    id text PRIMARY KEY,
    type storage.buckettype DEFAULT 'VECTOR',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage.vector_indexes (
    id text DEFAULT gen_random_uuid() PRIMARY KEY,
    name text,
    bucket_id text,
    data_type text,
    dimension integer,
    distance_metric text,
    metadata_configuration jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 6) Realtime schema core tables
CREATE TABLE IF NOT EXISTS realtime.schema_migrations (
    version bigint PRIMARY KEY,
    inserted_at timestamp(0) without time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS realtime.subscription (
    id bigserial PRIMARY KEY,
    subscription_id uuid,
    entity regclass,
    filters jsonb[],
    claims jsonb,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED,
    created_at timestamp(0) without time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS realtime.messages (
    topic text,
    extension text,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now(),
    inserted_at timestamp without time zone DEFAULT now(),
    id uuid DEFAULT gen_random_uuid(),
    PRIMARY KEY (inserted_at, id)
);

-- 7) Vault schema simplified table
CREATE TABLE IF NOT EXISTS vault.secrets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text,
    description text DEFAULT ''::text,
    secret text,
    key_id uuid,
    nonce bytea DEFAULT vault.crypto_aead_det_noncegen(),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

-- 8) Auth schema: core tables
CREATE TABLE IF NOT EXISTS auth.users (
    id uuid PRIMARY KEY,
    instance_id uuid,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT '',
    phone_change_token character varying(255) DEFAULT '',
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT '',
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT '',
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    id bigserial PRIMARY KEY,
    instance_id uuid,
    token character varying(255) UNIQUE,
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);

CREATE TABLE IF NOT EXISTS auth.identities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id text,
    user_id uuid,
    identity_data jsonb,
    provider text,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED
);

CREATE TYPE auth.aal_level AS ENUM ('aal1','aal2','aal3');
CREATE TYPE auth.factor_type AS ENUM ('totp','webauthn','phone');
CREATE TYPE auth.factor_status AS ENUM ('unverified','verified');
CREATE TABLE IF NOT EXISTS auth.sessions (
    id uuid PRIMARY KEY,
    user_id uuid,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text
);

CREATE TYPE auth.one_time_token_type AS ENUM ('confirmation_token','reauthentication_token','recovery_token','email_change_token_new','email_change_token_current','phone_change_token');
CREATE TABLE IF NOT EXISTS auth.one_time_tokens (
    id uuid PRIMARY KEY,
    user_id uuid,
    token_type auth.one_time_token_type,
    token_hash text,
    relates_to text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);

CREATE TYPE auth.oauth_registration_type AS ENUM ('dynamic','manual');
CREATE TYPE auth.oauth_client_type AS ENUM ('public','confidential');
CREATE TYPE auth.oauth_response_type AS ENUM ('code');
CREATE TYPE auth.oauth_authorization_status AS ENUM ('pending','approved','denied','expired');
CREATE TABLE IF NOT EXISTS auth.oauth_clients (
    id uuid PRIMARY KEY,
    client_secret_hash text,
    registration_type auth.oauth_registration_type,
    redirect_uris text,
    grant_types text,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    deleted_at timestamptz,
    client_type auth.oauth_client_type DEFAULT 'confidential'
);

CREATE TABLE IF NOT EXISTS auth.oauth_authorizations (
    id uuid PRIMARY KEY,
    authorization_id text UNIQUE,
    client_id uuid,
    user_id uuid,
    redirect_uri text,
    scope text,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method text,
    response_type auth.oauth_response_type DEFAULT 'code',
    status auth.oauth_authorization_status DEFAULT 'pending',
    authorization_code text UNIQUE,
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz DEFAULT (now() + interval '3 minutes'),
    approved_at timestamptz,
    nonce text
);

CREATE TABLE IF NOT EXISTS auth.oauth_consents (
    id uuid PRIMARY KEY,
    user_id uuid,
    client_id uuid,
    scopes text,
    granted_at timestamptz DEFAULT now(),
    revoked_at timestamptz
);

-- 9) Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles USING btree(username);
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON public.profiles USING gin (to_tsvector('english', coalesce(full_name, '')));
CREATE INDEX IF NOT EXISTS idx_cases_user_id ON public.cases(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_case_id ON public.comments(case_id);
CREATE INDEX IF NOT EXISTS idx_storage_objects_bucket ON storage.objects(bucket_id);
CREATE INDEX IF NOT EXISTS idx_realtime_messages_topic ON realtime.messages(topic);
CREATE INDEX IF NOT EXISTS idx_transactions_from_wallet ON public.transactions(from_wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to_wallet ON public.transactions(to_wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);

-- 10) Foreign keys
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'profiles' AND n.nspname = 'public') AND
       EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'users' AND n.nspname = 'auth') THEN
    BEGIN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id);
    EXCEPTION WHEN duplicate_object THEN
        -- already exists
        NULL;
    END;
    END IF;
END;
$$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'cases' AND n.nspname = 'public') THEN
    BEGIN
        ALTER TABLE public.cases ADD CONSTRAINT cases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
    END IF;
END;
$$;

DO $$
BEGIN
    BEGIN
        ALTER TABLE public.comments ADD CONSTRAINT comments_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.cases(id);
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
    BEGIN
        ALTER TABLE public.comments ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
    BEGIN
        ALTER TABLE public.comments ADD CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.comments(id);
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;
END;
$$;

-- 11) RLS policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles - select own" ON public.profiles FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id);
CREATE POLICY "Profiles - update own" ON public.profiles FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id);

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cases - owner or investigator read" ON public.cases FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()) OR investigator_id = (SELECT auth.uid()));
CREATE POLICY "Cases - insert by owner" ON public.cases FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Cases - update owner or investigator" ON public.cases FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid()) OR investigator_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()) OR investigator_id = (SELECT auth.uid()));
CREATE POLICY "Cases - delete owner only" ON public.cases FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Messages - participant select" ON public.messages FOR SELECT TO authenticated USING (sender_id = (SELECT auth.uid()) OR recipient_id = (SELECT auth.uid()));
CREATE POLICY "Messages - participant insert" ON public.messages FOR INSERT TO authenticated WITH CHECK (sender_id = (SELECT auth.uid()));

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Storage objects - user access" ON storage.objects FOR SELECT TO authenticated USING (true);

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Realtime messages - select" ON realtime.messages FOR SELECT TO authenticated USING (true);

ALTER TABLE vault.secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Vault secrets - service" ON vault.secrets FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 12) Trigger helpers for realtime.broadcast_changes
CREATE OR REPLACE FUNCTION public.room_messages_broadcast_trigger() RETURNS TRIGGER AS $$
BEGIN
    PERFORM realtime.broadcast_changes( 'room:' || COALESCE(NEW.case_id, OLD.case_id)::text, TG_OP, TG_OP, TG_TABLE_NAME, TG_TABLE_SCHEMA, NEW, OLD );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'messages' AND n.nspname = 'public') THEN
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid WHERE t.tgname = 'messages_broadcast_trigger') THEN
            CREATE TRIGGER messages_broadcast_trigger
            AFTER INSERT OR UPDATE OR DELETE ON public.messages
            FOR EACH ROW EXECUTE FUNCTION public.room_messages_broadcast_trigger();
        END IF;
    EXCEPTION WHEN others THEN
        NULL;
    END;
    END IF;
END;
$$;

-- 13) Maintenance functions & safety
CREATE OR REPLACE FUNCTION public.get_user_tenant() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT NULL::uuid;
$$;
REVOKE EXECUTE ON FUNCTION public.get_user_tenant() FROM anon, authenticated;

-- END restore_all.sql