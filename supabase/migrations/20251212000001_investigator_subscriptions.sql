-- =============================================
-- INVESTIGATOR SUBSCRIPTION SYSTEM - Database Schema
-- 3 Plans: Basic (€9.99), Premium (€24.99), Pro (€49.99)
-- =============================================

-- =============================================
-- 1. SUBSCRIPTION PLANS (Static Configuration)
-- =============================================

CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  plan_code TEXT UNIQUE NOT NULL, -- 'basic', 'premium', 'pro'
  plan_name TEXT NOT NULL,
  description TEXT,
  
  -- Pricing
  price_monthly DECIMAL(10, 2) NOT NULL,
  price_yearly DECIMAL(10, 2) NOT NULL,
  price_onetime DECIMAL(10, 2), -- For one-time packs
  
  -- Features
  ai_credits_monthly INTEGER NOT NULL, -- 50 for basic, 9999999 for premium/pro
  processing_speed TEXT DEFAULT 'standard' CHECK (processing_speed IN ('standard', 'fast', 'fastest')),
  boost_discount INTEGER DEFAULT 0, -- Percentage discount (0-100)
  boost_free_monthly INTEGER DEFAULT 0, -- Free boosts per month
  support_level TEXT DEFAULT 'standard' CHECK (support_level IN ('standard', 'priority', 'dedicated')),
  team_members INTEGER DEFAULT 1,
  api_access BOOLEAN DEFAULT FALSE,
  api_requests_monthly INTEGER DEFAULT 0,
  
  -- Feature flags
  features JSONB DEFAULT '{}', -- Additional features
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed subscription plans
INSERT INTO subscription_plans (
  plan_code, plan_name, description,
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
  'Taskukohane juurdepääs AI tööriistadele. Ideaalne algajatele.',
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
  'Piiramatu AI võimsus professionaalidele. Kõige populaarsem!',
  24.99,  -- €24.99/month
  239.90, -- €239.90/year (20% discount)
  59.99,  -- €59.99 one-time (300 credits, 6 months)
  9999999, -- UNLIMITED credits
  'fast',
  75,     -- 75% discount on featured cases
  1,      -- 1 free boost/month
  'priority',
  1,      -- 1 member
  FALSE,  -- API coming soon
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
  'Enterprise lahendus meeskondadele ja agentuuridele.',
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
);

-- =============================================
-- 2. SUBSCRIPTION CREDITS (User Credit Balance)
-- =============================================

CREATE TABLE IF NOT EXISTS subscription_credits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  
  -- Credits
  credits_total INTEGER DEFAULT 0,  -- Total credits for this period
  credits_used INTEGER DEFAULT 0,   -- Credits consumed
  credits_remaining INTEGER GENERATED ALWAYS AS (credits_total - credits_used) STORED,
  
  -- Reset schedule
  billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly', 'onetime')),
  current_period_start TIMESTAMPTZ DEFAULT NOW(),
  current_period_end TIMESTAMPTZ,
  resets_at TIMESTAMPTZ, -- Next credit reset date (monthly on 1st of month)
  
  -- One-time pack expiry
  expires_at TIMESTAMPTZ, -- For one-time packs only
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast credit checks
CREATE INDEX IF NOT EXISTS idx_subscription_credits_user ON subscription_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_credits_active ON subscription_credits(user_id, is_active) WHERE is_active = TRUE;

-- =============================================
-- 3. SUBSCRIPTION USAGE LOG (Track AI Tool Usage)
-- =============================================

CREATE TABLE IF NOT EXISTS subscription_usage_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  
  -- Tool usage
  tool_name TEXT NOT NULL, -- 'ai_analyze_image', 'ai_analyze_text', etc.
  credits_cost INTEGER NOT NULL, -- How many credits this action cost
  
  -- API cost tracking (for internal monitoring)
  api_cost DECIMAL(10, 4) DEFAULT 0.00, -- Actual Gemini API cost
  
  -- Metadata
  metadata JSONB DEFAULT '{}', -- Tool-specific data
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics
CREATE INDEX IF NOT EXISTS idx_usage_log_user ON subscription_usage_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_log_subscription ON subscription_usage_log(subscription_id);
CREATE INDEX IF NOT EXISTS idx_usage_log_tool ON subscription_usage_log(tool_name);

-- =============================================
-- 4. SUBSCRIPTION TRANSACTIONS (Payment History)
-- =============================================

CREATE TABLE IF NOT EXISTS subscription_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  plan_code TEXT NOT NULL,
  
  -- Payment details
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'EUR' NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly', 'onetime')),
  
  -- Payment method
  payment_method TEXT DEFAULT 'stripe' CHECK (payment_method IN ('stripe', 'wallet')),
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  wallet_transaction_id UUID, -- Reference to transactions table
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  
  -- Period
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Index for payment history
CREATE INDEX IF NOT EXISTS idx_subscription_transactions_user ON subscription_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_transactions_stripe ON subscription_transactions(stripe_payment_intent_id);

-- =============================================
-- 5. STRIPE PRODUCTS MAPPING (For Reference)
-- =============================================

COMMENT ON TABLE subscription_plans IS 'Stripe Products to create:
1. Basic Monthly: price_1XXX (€9.99/month recurring)
2. Basic Yearly: price_1XXX (€95.90/year recurring)
3. Basic One-time: price_1XXX (€14.99 one-time)
4. Premium Monthly: price_1XXX (€24.99/month recurring)
5. Premium Yearly: price_1XXX (€239.90/year recurring)
6. Premium One-time: price_1XXX (€59.99 one-time)
7. Pro Monthly: price_1XXX (€49.99/month recurring)
8. Pro Yearly: price_1XXX (€479.90/year recurring)
9. Pro One-time: price_1XXX (€149.99 one-time)';

-- =============================================
-- 6. FUNCTIONS: Credit Management
-- =============================================

-- Function: Initialize credits for new subscription
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
    -- One-time packs expire based on plan type
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

-- Function: Check if user has enough credits
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

-- Function: Deduct credits
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
  -- Check if user has enough credits
  v_has_credits := check_subscription_credits(p_user_id, p_credits_cost);
  
  IF NOT v_has_credits THEN
    RETURN FALSE;
  END IF;
  
  -- Get subscription ID
  SELECT subscription_id INTO v_subscription_id
  FROM subscription_credits
  WHERE user_id = p_user_id;
  
  -- Deduct credits
  UPDATE subscription_credits
  SET 
    credits_used = credits_used + p_credits_cost,
    updated_at = NOW()
  WHERE user_id = p_user_id;
  
  -- Log usage
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

-- Function: Reset monthly credits (called by cron job)
CREATE OR REPLACE FUNCTION reset_monthly_subscription_credits()
RETURNS INTEGER AS $$
DECLARE
  v_reset_count INTEGER := 0;
BEGIN
  -- Reset credits for users whose reset date has passed
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

-- Function: Expire one-time packs
CREATE OR REPLACE FUNCTION expire_onetime_subscriptions()
RETURNS INTEGER AS $$
DECLARE
  v_expired_count INTEGER := 0;
BEGIN
  -- Deactivate expired one-time packs
  UPDATE subscription_credits
  SET 
    is_active = FALSE,
    updated_at = NOW()
  WHERE 
    billing_cycle = 'onetime'
    AND expires_at <= NOW()
    AND is_active = TRUE;
  
  GET DIAGNOSTICS v_expired_count = ROW_COUNT;
  
  -- Also update subscription status
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

-- =============================================
-- 7. RLS POLICIES
-- =============================================

-- Enable RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_transactions ENABLE ROW LEVEL SECURITY;

-- Plans are public (everyone can see)
CREATE POLICY "Plans are public" ON subscription_plans FOR SELECT USING (TRUE);

-- Credits: users can only see their own
CREATE POLICY "Users can view own credits" ON subscription_credits
  FOR SELECT USING (auth.uid() = user_id);

-- Usage log: users can see their own
CREATE POLICY "Users can view own usage" ON subscription_usage_log
  FOR SELECT USING (auth.uid() = user_id);

-- Transactions: users can see their own
CREATE POLICY "Users can view own transactions" ON subscription_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Service role can do everything
CREATE POLICY "Service role full access" ON subscription_credits
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON subscription_usage_log
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON subscription_transactions
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- 8. GRANTS
-- =============================================

GRANT SELECT ON subscription_plans TO authenticated, anon;
GRANT SELECT ON subscription_credits TO authenticated;
GRANT SELECT ON subscription_usage_log TO authenticated;
GRANT SELECT ON subscription_transactions TO authenticated;

GRANT ALL ON subscription_plans TO service_role;
GRANT ALL ON subscription_credits TO service_role;
GRANT ALL ON subscription_usage_log TO service_role;
GRANT ALL ON subscription_transactions TO service_role;

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Check plans
-- SELECT * FROM subscription_plans ORDER BY display_order;

-- Check user credits
-- SELECT * FROM subscription_credits WHERE user_id = 'xxx';

-- Check usage
-- SELECT * FROM subscription_usage_log WHERE user_id = 'xxx' ORDER BY created_at DESC LIMIT 10;

-- Check transactions
-- SELECT * FROM subscription_transactions WHERE user_id = 'xxx' ORDER BY created_at DESC;
