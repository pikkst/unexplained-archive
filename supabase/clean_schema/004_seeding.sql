-- Unexplained Archive - Seeding Data
-- Version: 1.0
-- Date: 2025-12-07
-- Description: This script contains initial data for development and testing.
-- It should be run after the schema, functions, and RLS policies have been applied.

--------------------------------------------------------------------------------
-- Section: Core System Data
--------------------------------------------------------------------------------

-- Insert platform's Stripe accounts
-- Replace placeholders with your actual Stripe account IDs from .env file
INSERT INTO public.stripe_accounts (account_type, stripe_account_id)
VALUES
  ('operations', 'acct_OPERATIONS_ID_PLACEHOLDER'),
  ('revenue', 'acct_REVENUE_ID_PLACEHOLDER')
ON CONFLICT (account_type) DO UPDATE SET
  stripe_account_id = EXCLUDED.stripe_account_id;

-- Insert a platform wallet for holding escrow funds
INSERT INTO public.wallets (id, user_id, balance, currency)
VALUES ('00000000-0000-0000-0000-000000000001', NULL, 0.00, 'EUR')
ON CONFLICT (id) DO NOTHING;

-- Create media storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media', 
  'media', 
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'application/pdf']
) ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'application/pdf'];
  
-- Insert default boost pricing tiers
INSERT INTO public.boost_pricing (boost_type, display_name, description, duration_hours, price, currency, features)
VALUES
  ('24h', '24 Hour Boost', 'Boost a case to the featured carousel for 24 hours.', 24, 9.99, 'EUR', ARRAY['Priority homepage placement', 'Featured badge']),
  ('7d', '7 Day Boost', 'Keep your case featured for an entire week.', 168, 29.99, 'EUR', ARRAY['Extended homepage visibility', 'Weekly analytics digest']),
  ('30d', '30 Day Boost', 'Maximum exposure for major investigations.', 720, 89.99, 'EUR', ARRAY['Homepage placement', 'Premium badge', 'Performance insights'])
ON CONFLICT (boost_type) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  duration_hours = EXCLUDED.duration_hours,
  price = EXCLUDED.price,
  currency = EXCLUDED.currency,
  features = EXCLUDED.features,
  updated_at = timezone('utc', now()),
  is_active = true;
  
--------------------------------------------------------------------------------
-- Section: Test Data (Optional, for development)
--------------------------------------------------------------------------------

-- SUPERADMIN SETUP
-- This sets the first user as the platform superadmin with full privileges
UPDATE public.profiles
SET
  role = 'admin',
  full_name = COALESCE(full_name, 'Super Admin'),
  verification_status = 'verified'
WHERE id = 'bad181a6-8cc0-4416-945a-04e951a9d9a6';

-- Create wallet for superadmin if not exists
INSERT INTO public.wallets (user_id, balance, currency)
VALUES ('bad181a6-8cc0-4416-945a-04e951a9d9a6', 0.00, 'EUR')
ON CONFLICT (user_id) DO NOTHING;

-- Initialize transaction limits for superadmin (higher limits)
INSERT INTO public.transaction_limits (user_id, daily_limit, monthly_limit)
VALUES ('bad181a6-8cc0-4416-945a-04e951a9d9a6', 10000.00, 100000.00)
ON CONFLICT (user_id) DO UPDATE SET
  daily_limit = 10000.00,
  monthly_limit = 100000.00;

-- Note: To create test users, you must first sign them up through the
-- Supabase authentication system. The following are examples of how you would
-- update their profiles to assign roles AFTER they have been created.

/*
-- Example: Create a test admin user
-- 1. Sign up a new user via Supabase Auth UI or client library.
-- 2. Get the user's ID from the auth.users table.
-- 3. Run the following update statement:

UPDATE public.profiles
SET
  role = 'admin',
  full_name = 'Test Admin'
WHERE id = '...'; -- Replace with the new user's ID

-- Example: Create a test investigator user
UPDATE public.profiles
SET
  role = 'investigator',
  full_name = 'Test Investigator'
WHERE id = '...'; -- Replace with the new user's ID

-- After creating test users, you can create test cases, comments, etc.
-- Example: Insert a test case
INSERT INTO public.cases (user_id, title, description, category, date_occurred, location, status)
VALUES
  (
    (SELECT id FROM public.profiles WHERE role = 'user' LIMIT 1),
    'Mysterious Lights Over Tallinn',
    'Multiple witnesses reported strange lights in a triangular formation over the city last night.',
    'UFO',
    '2025-12-06T22:00:00Z',
    'Tallinn, Estonia',
    'verified'
  );
*/

--------------------------------------------------------------------------------
-- Section: Subscription Plans (New investigator subscription system)
--------------------------------------------------------------------------------

-- Seed subscription plans
INSERT INTO public.subscription_plans (
  plan_code, plan_name, plan_name_et, plan_name_ru,
  description, description_et, description_ru,
  price_monthly, price_yearly, price_onetime,
  ai_credits_monthly, processing_speed,
  boost_discount, boost_free_monthly,
  support_level, team_members, api_access, api_requests_monthly,
  display_order, features
) VALUES
-- Basic Plan
(
  'basic',
  'Investigator Basic',
  'Uurija Põhipakett',
  'Исследователь Базовый',
  'Affordable access to AI tools. Perfect for beginners.',
  'Taskukohane juurdepääs AI tööriistadele. Ideaalne algajatele.',
  'Доступный доступ к инструментам AI. Идеально для начинающих.',
  9.99,   -- €9.99/month
  95.90,  -- €95.90/year (20% discount)
  14.99,  -- €14.99 one-time (60 credits, 3 months)
  50,     -- 50 AI credits/month
  'standard',
  50,     -- 50% discount on boosts
  0,      -- No free boosts
  'standard',
  1,      -- 1 member
  FALSE,
  0,
  1,
  jsonb_build_object(
    'badge_color', 'silver',
    'badge_icon', '🥉',
    'ad_free', true,
    'priority_support_hours', 24,
    'max_file_size_mb', 10,
    'trial_days', 7
  )
),
-- Premium Plan
(
  'premium',
  'Investigator Premium',
  'Uurija Premium',
  'Исследователь Премиум',
  'Unlimited AI power for professionals. Most popular!',
  'Piiramatu AI võimsus professionaalidele. Kõige populaarsem!',
  'Неограниченная мощность AI для профессионалов. Самый популярный!',
  24.99,  -- €24.99/month
  239.90, -- €239.90/year (20% discount)
  59.99,  -- €59.99 one-time (300 credits, 6 months)
  9999999, -- UNLIMITED credits
  'fast',
  75,     -- 75% discount on featured cases
  1,      -- 1 free boost/month
  'priority',
  1,      -- 1 member
  FALSE,
  0,
  2,
  jsonb_build_object(
    'badge_color', 'gold',
    'badge_icon', '🥈',
    'ad_free', true,
    'priority_support_hours', 12,
    'max_file_size_mb', 20,
    'trial_days', 14,
    'batch_analysis', true,
    'pdf_export', true,
    'custom_prompts', true,
    'hidden_cases_access', true,
    'analytics_dashboard', true,
    'most_popular', true
  )
),
-- Pro Plan
(
  'pro',
  'Investigator Pro',
  'Uurija Pro',
  'Исследователь Про',
  'Enterprise solution for teams and agencies.',
  'Enterprise lahendus meeskondadele ja agentuuridele.',
  'Корпоративное решение для команд и агентств.',
  49.99,  -- €49.99/month
  479.90, -- €479.90/year (20% discount)
  149.99, -- €149.99 one-time (unlimited 3 months)
  9999999, -- UNLIMITED credits
  'fastest',
  100,    -- Free featured cases
  4,      -- 4 free boosts/month
  'dedicated',
  5,      -- 5 team members
  TRUE,
  10000,  -- 10k API requests/month
  3,
  jsonb_build_object(
    'badge_color', 'platinum',
    'badge_icon', '🥇',
    'ad_free', true,
    'priority_support_hours', 1,
    'max_file_size_mb', 50,
    'trial_days', 30,
    'batch_analysis', true,
    'pdf_export', true,
    'custom_prompts', true,
    'hidden_cases_access', true,
    'analytics_dashboard', true,
    'white_label', true,
    'custom_domain', true,
    'team_workspace', true,
    'role_based_access', true,
    'custom_integrations', true,
    'early_access', true,
    'best_value', true
  )
)
ON CONFLICT (plan_code) 
DO UPDATE SET 
  plan_name = EXCLUDED.plan_name,
  plan_name_et = EXCLUDED.plan_name_et,
  plan_name_ru = EXCLUDED.plan_name_ru,
  description = EXCLUDED.description,
  description_et = EXCLUDED.description_et,
  description_ru = EXCLUDED.description_ru,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  price_onetime = EXCLUDED.price_onetime,
  ai_credits_monthly = EXCLUDED.ai_credits_monthly,
  processing_speed = EXCLUDED.processing_speed,
  boost_discount = EXCLUDED.boost_discount,
  boost_free_monthly = EXCLUDED.boost_free_monthly,
  support_level = EXCLUDED.support_level,
  team_members = EXCLUDED.team_members,
  api_access = EXCLUDED.api_access,
  api_requests_monthly = EXCLUDED.api_requests_monthly,
  display_order = EXCLUDED.display_order,
  features = EXCLUDED.features,
  updated_at = NOW();

--------------------------------------------------------------------------------
-- Section: Subscription Notification Groups
--------------------------------------------------------------------------------

-- Seed notification groups for mass notifications
INSERT INTO public.subscription_notification_groups (group_code, group_name, description, criteria) VALUES
('all_subscribers', 'All Subscribers', 'All active subscriptions (Basic, Premium, Pro)', 
  '{"status": ["active", "trialing"]}'::jsonb),
  
('basic_subscribers', 'Basic Subscribers', 'Basic plan subscribers only',
  '{"plan_type": "basic", "status": ["active", "trialing"]}'::jsonb),
  
('premium_subscribers', 'Premium Subscribers', 'Premium plan subscribers only',
  '{"plan_type": "premium", "status": ["active", "trialing"]}'::jsonb),
  
('pro_subscribers', 'Pro Subscribers', 'Pro plan subscribers only',
  '{"plan_type": "pro", "status": ["active", "trialing"]}'::jsonb),
  
('trial_users', 'Trial Users', 'Users on trial period',
  '{"status": "trialing"}'::jsonb),
  
('canceled_subscribers', 'Canceled Subscriptions', 'Subscriptions ending at period end',
  '{"cancel_at_period_end": true, "status": "active"}'::jsonb),
  
('expired_subscribers', 'Expired Subscriptions', 'Recently expired subscriptions (last 30 days)',
  '{"status": "expired"}'::jsonb),
  
('high_usage', 'High Usage', 'Basic users who used >80% of their credits',
  '{"plan_type": "basic", "credits_usage_percent": ">80"}'::jsonb),
  
('low_usage', 'Low Usage', 'Subscribers who haven''t used AI tools in 30 days',
  '{"last_tool_usage": "<30_days"}'::jsonb)
ON CONFLICT (group_code) 
DO UPDATE SET 
  group_name = EXCLUDED.group_name,
  description = EXCLUDED.description,
  criteria = EXCLUDED.criteria,
  updated_at = NOW();

--------------------------------------------------------------------------------
-- End of seeding script
-- Version: 2.0 (Updated 2025-12-12)
-- Added subscription plans and notification groups seeding
--------------------------------------------------------------------------------