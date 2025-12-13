-- Unexplained Archive - RLS Policies
-- Version: 1.0
-- Date: 2025-12-07
-- Description: This script contains all Row Level Security (RLS) policies for the database.
-- It should be run after the golden schema and functions scripts.

--------------------------------------------------------------------------------
-- Helper function to check for admin role
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER;


--------------------------------------------------------------------------------
-- Table: profiles
--------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile." ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;

CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile." ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
  
CREATE POLICY "Users can insert their own profile." ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

--------------------------------------------------------------------------------
-- Table: cases
--------------------------------------------------------------------------------
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view verified cases." ON public.cases;
DROP POLICY IF EXISTS "Users can view their own unverified cases." ON public.cases;
DROP POLICY IF EXISTS "Authenticated users can create cases." ON public.cases;
DROP POLICY IF EXISTS "Case owner or admin can update." ON public.cases;
DROP POLICY IF EXISTS "Case owner or admin can delete." ON public.cases;

CREATE POLICY "Public can view verified cases." ON public.cases
  FOR SELECT USING (status <> 'pending');

CREATE POLICY "Users can view their own unverified cases." ON public.cases
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create cases." ON public.cases
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Case owner or admin can update." ON public.cases
  FOR UPDATE USING (auth.uid() = user_id OR is_admin(auth.uid()));

CREATE POLICY "Case owner or admin can delete." ON public.cases
  FOR DELETE USING (auth.uid() = user_id OR is_admin(auth.uid()));

--------------------------------------------------------------------------------
-- Table: wallets
--------------------------------------------------------------------------------
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own wallet." ON public.wallets;
DROP POLICY IF EXISTS "Admins can view all wallets." ON public.wallets;

CREATE POLICY "Users can view their own wallet." ON public.wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all wallets." ON public.wallets
  FOR SELECT USING (is_admin(auth.uid()));

--------------------------------------------------------------------------------
-- Table: transactions
--------------------------------------------------------------------------------
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own transactions." ON public.transactions;
DROP POLICY IF EXISTS "Admins can view all transactions." ON public.transactions;

CREATE POLICY "Users can view their own transactions." ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions." ON public.transactions
  FOR SELECT USING (is_admin(auth.uid()));
  
DO $$
DECLARE
  has_storage_admin boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'storage_admin')
    INTO has_storage_admin;

  IF NOT has_storage_admin THEN
    RAISE NOTICE 'storage_admin role missing; skipping storage.objects policy updates.';
    RETURN;
  END IF;

  EXECUTE 'SET LOCAL ROLE storage_admin';

  EXECUTE 'ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS "Public media access" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "Users can upload their own media" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "Users can update their own media" ON storage.objects';
  EXECUTE 'DROP POLICY IF EXISTS "Users can delete their own media" ON storage.objects';

  EXECUTE 'CREATE POLICY "Public media access" ON storage.objects
    FOR SELECT USING (true)';

  EXECUTE 'CREATE POLICY "Users can upload their own media" ON storage.objects
    FOR INSERT WITH CHECK (auth.uid() = owner)';

  EXECUTE 'CREATE POLICY "Users can update their own media" ON storage.objects
    FOR UPDATE USING (auth.uid() = owner)';

  EXECUTE 'CREATE POLICY "Users can delete their own media" ON storage.objects
    FOR DELETE USING (auth.uid() = owner)';
END;
$$ LANGUAGE plpgsql;

--------------------------------------------------------------------------------
-- Table: messages
--------------------------------------------------------------------------------
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Recipients can update read_at" ON public.messages;

CREATE POLICY "Users can read own messages" ON public.messages
    FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send messages" ON public.messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Recipients can update read_at" ON public.messages
    FOR UPDATE USING (auth.uid() = recipient_id);

--------------------------------------------------------------------------------
-- Table: background_checks
--------------------------------------------------------------------------------
ALTER TABLE public.background_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage background checks" ON public.background_checks;
DROP POLICY IF EXISTS "Users can view own background check" ON public.background_checks;

CREATE POLICY "Admins can manage background checks" ON public.background_checks
    FOR ALL USING (is_admin(auth.uid()));

CREATE POLICY "Users can view own background check" ON public.background_checks
    FOR SELECT USING (auth.uid() = investigator_id);

--------------------------------------------------------------------------------
-- Table: platform_revenue
--------------------------------------------------------------------------------
ALTER TABLE public.platform_revenue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Only admins can view platform revenue" ON public.platform_revenue;

CREATE POLICY "Only admins can view platform revenue" ON public.platform_revenue
    FOR SELECT USING (is_admin(auth.uid()));

--------------------------------------------------------------------------------
-- Table: analytics_events
--------------------------------------------------------------------------------
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Only admins can view analytics" ON public.analytics_events;
DROP POLICY IF EXISTS "Anyone can insert analytics events" ON public.analytics_events;

CREATE POLICY "Only admins can view analytics" ON public.analytics_events
    FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Anyone can insert analytics events" ON public.analytics_events
    FOR INSERT WITH CHECK (true);

--------------------------------------------------------------------------------
-- Table: blog_articles
--------------------------------------------------------------------------------
ALTER TABLE public.blog_articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read published articles" ON public.blog_articles;
DROP POLICY IF EXISTS "Admins can manage all articles" ON public.blog_articles;

CREATE POLICY "Anyone can read published articles" ON public.blog_articles
    FOR SELECT USING (status = 'published');

CREATE POLICY "Admins can manage all articles" ON public.blog_articles
    FOR ALL USING (is_admin(auth.uid()));

--------------------------------------------------------------------------------
-- Table: notifications
--------------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

--------------------------------------------------------------------------------
-- Table: investigator_applications
--------------------------------------------------------------------------------
ALTER TABLE public.investigator_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own applications" ON public.investigator_applications;
DROP POLICY IF EXISTS "Users can create applications" ON public.investigator_applications;
DROP POLICY IF EXISTS "Users can update own pending applications" ON public.investigator_applications;
DROP POLICY IF EXISTS "Admins can view all applications" ON public.investigator_applications;
DROP POLICY IF EXISTS "Admins can update applications" ON public.investigator_applications;

CREATE POLICY "Users can view own applications" ON public.investigator_applications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create applications" ON public.investigator_applications
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending applications" ON public.investigator_applications
    FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can view all applications" ON public.investigator_applications
    FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update applications" ON public.investigator_applications
    FOR UPDATE USING (is_admin(auth.uid()));

--------------------------------------------------------------------------------
-- Table: comments
--------------------------------------------------------------------------------
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read comments" ON public.comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.comments;
DROP POLICY IF EXISTS "Users can update own comments" ON public.comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.comments;

CREATE POLICY "Anyone can read comments" ON public.comments
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create comments" ON public.comments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments" ON public.comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.comments
    FOR DELETE USING (auth.uid() = user_id OR is_admin(auth.uid()));

--------------------------------------------------------------------------------
-- Table: forum_threads
--------------------------------------------------------------------------------
ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read forum threads" ON public.forum_threads;
DROP POLICY IF EXISTS "Authenticated users can create threads" ON public.forum_threads;
DROP POLICY IF EXISTS "Thread owner can update" ON public.forum_threads;

CREATE POLICY "Anyone can read forum threads" ON public.forum_threads
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create threads" ON public.forum_threads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Thread owner or admin can update" ON public.forum_threads
    FOR UPDATE USING (auth.uid() = user_id OR is_admin(auth.uid()));

--------------------------------------------------------------------------------
-- Table: forum_posts
--------------------------------------------------------------------------------
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read forum posts" ON public.forum_posts;
DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.forum_posts;
DROP POLICY IF EXISTS "Post owner can update" ON public.forum_posts;

CREATE POLICY "Anyone can read forum posts" ON public.forum_posts
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create posts" ON public.forum_posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Post owner or admin can update" ON public.forum_posts
    FOR UPDATE USING (auth.uid() = user_id OR is_admin(auth.uid()));

--------------------------------------------------------------------------------
-- Table: featured_cases
--------------------------------------------------------------------------------
ALTER TABLE public.featured_cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view active featured cases" ON public.featured_cases;
DROP POLICY IF EXISTS "Users can view own featured cases" ON public.featured_cases;
DROP POLICY IF EXISTS "Admins can manage featured cases" ON public.featured_cases;

CREATE POLICY "Anyone can view active featured cases" ON public.featured_cases
    FOR SELECT USING (status = 'active');

CREATE POLICY "Users can view own featured cases" ON public.featured_cases
    FOR SELECT USING (auth.uid() = paid_by);

CREATE POLICY "Admins can manage featured cases" ON public.featured_cases
    FOR ALL USING (is_admin(auth.uid()));

--------------------------------------------------------------------------------
-- Table: subscriptions
--------------------------------------------------------------------------------
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Service role full access subscriptions" ON public.subscriptions;

CREATE POLICY "Users can view own subscription" ON public.subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions" ON public.subscriptions
    FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Service role full access subscriptions" ON public.subscriptions
    FOR ALL USING (auth.role() = 'service_role');

--------------------------------------------------------------------------------
-- Table: subscription_plans
--------------------------------------------------------------------------------
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Plans are public" ON public.subscription_plans;
DROP POLICY IF EXISTS "Service role full access plans" ON public.subscription_plans;

CREATE POLICY "Plans are public" ON public.subscription_plans 
    FOR SELECT USING (TRUE);

CREATE POLICY "Service role full access plans" ON public.subscription_plans
    FOR ALL USING (auth.role() = 'service_role');

--------------------------------------------------------------------------------
-- Table: subscription_credits
--------------------------------------------------------------------------------
ALTER TABLE public.subscription_credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own credits" ON public.subscription_credits;
DROP POLICY IF EXISTS "Service role full access credits" ON public.subscription_credits;

CREATE POLICY "Users can view own credits" ON public.subscription_credits
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access credits" ON public.subscription_credits
    FOR ALL USING (auth.role() = 'service_role');

--------------------------------------------------------------------------------
-- Table: subscription_usage_log
--------------------------------------------------------------------------------
ALTER TABLE public.subscription_usage_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own usage" ON public.subscription_usage_log;
DROP POLICY IF EXISTS "Service role full access usage" ON public.subscription_usage_log;

CREATE POLICY "Users can view own usage" ON public.subscription_usage_log
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access usage" ON public.subscription_usage_log
    FOR ALL USING (auth.role() = 'service_role');

--------------------------------------------------------------------------------
-- Table: subscription_transactions
--------------------------------------------------------------------------------
ALTER TABLE public.subscription_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own transactions" ON public.subscription_transactions;
DROP POLICY IF EXISTS "Service role full access sub_trans" ON public.subscription_transactions;

CREATE POLICY "Users can view own transactions" ON public.subscription_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access sub_trans" ON public.subscription_transactions
    FOR ALL USING (auth.role() = 'service_role');

--------------------------------------------------------------------------------
-- Table: subscription_notification_groups
--------------------------------------------------------------------------------
ALTER TABLE public.subscription_notification_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view groups" ON public.subscription_notification_groups;
DROP POLICY IF EXISTS "Admins can update groups" ON public.subscription_notification_groups;
DROP POLICY IF EXISTS "Service role full access groups" ON public.subscription_notification_groups;

CREATE POLICY "Admins can view groups" ON public.subscription_notification_groups
    FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update groups" ON public.subscription_notification_groups
    FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Service role full access groups" ON public.subscription_notification_groups
    FOR ALL USING (auth.role() = 'service_role');

--------------------------------------------------------------------------------
-- Table: mass_notifications
--------------------------------------------------------------------------------
ALTER TABLE public.mass_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view notifications" ON public.mass_notifications;
DROP POLICY IF EXISTS "Admins can create notifications" ON public.mass_notifications;
DROP POLICY IF EXISTS "Admins can update notifications" ON public.mass_notifications;
DROP POLICY IF EXISTS "Service role full access mass_notif" ON public.mass_notifications;

CREATE POLICY "Admins can view notifications" ON public.mass_notifications
    FOR SELECT USING (is_admin(auth.uid()));

CREATE POLICY "Admins can create notifications" ON public.mass_notifications
    FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update notifications" ON public.mass_notifications
    FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Service role full access mass_notif" ON public.mass_notifications
    FOR ALL USING (auth.role() = 'service_role');

--------------------------------------------------------------------------------
-- Table: case_team_members
--------------------------------------------------------------------------------
ALTER TABLE public.case_team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Team members viewable by case participants" ON public.case_team_members;
DROP POLICY IF EXISTS "Team leaders can manage members" ON public.case_team_members;

CREATE POLICY "Team members viewable by case participants" ON public.case_team_members
    FOR SELECT USING (true);

CREATE POLICY "Team leaders can manage members" ON public.case_team_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.case_team_members ctm
            WHERE ctm.case_id = case_team_members.case_id
            AND ctm.investigator_id = auth.uid()
            AND ctm.role = 'leader'
            AND ctm.status = 'active'
        )
    );

--------------------------------------------------------------------------------
-- Table: case_team_messages
--------------------------------------------------------------------------------
ALTER TABLE public.case_team_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Team members can view team messages" ON public.case_team_messages;
DROP POLICY IF EXISTS "Team members can send messages" ON public.case_team_messages;
DROP POLICY IF EXISTS "Sender can update own messages" ON public.case_team_messages;
DROP POLICY IF EXISTS "Sender can delete own messages" ON public.case_team_messages;

CREATE POLICY "Team members can view team messages" ON public.case_team_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.case_team_members ctm
            WHERE ctm.case_id = case_team_messages.case_id
            AND ctm.investigator_id = auth.uid()
            AND ctm.status = 'active'
        )
    );

CREATE POLICY "Team members can send messages" ON public.case_team_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.case_team_members ctm
            WHERE ctm.case_id = case_team_messages.case_id
            AND ctm.investigator_id = auth.uid()
            AND ctm.status = 'active'
        )
        AND sender_id = auth.uid()
    );

CREATE POLICY "Sender can update own messages" ON public.case_team_messages
    FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY "Sender can delete own messages" ON public.case_team_messages
    FOR DELETE USING (sender_id = auth.uid());

--------------------------------------------------------------------------------
-- End of RLS Policies
-- Version: 2.0 (Updated 2025-12-12)
-- All subscription, team collaboration, and notification policies added
--------------------------------------------------------------------------------