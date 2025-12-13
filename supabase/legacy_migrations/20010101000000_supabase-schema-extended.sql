-- =============================================
-- UNEXPLAINED ARCHIVE - PRODUCTION READY SCHEMA
-- Critical additions for payments, security, monetization
-- =============================================

-- =============================================
-- WALLETS & PAYMENT SYSTEM
-- =============================================

CREATE TABLE IF NOT EXISTS wallets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  balance DECIMAL(10, 2) DEFAULT 0.00 NOT NULL,
  currency TEXT DEFAULT 'EUR' NOT NULL,
  stripe_customer_id TEXT UNIQUE,
  stripe_account_id TEXT, -- For investigators receiving payouts
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT positive_balance CHECK (balance >= 0)
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  from_wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
  to_wallet_id UUID REFERENCES wallets(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'EUR' NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'donation', 'reward', 'subscription', 'withdrawal', 'platform_fee', 'refund')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'cancelled')),
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_transfer_id TEXT,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT positive_amount CHECK (amount > 0)
);

CREATE TABLE IF NOT EXISTS case_escrow (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE UNIQUE NOT NULL,
  total_amount DECIMAL(10, 2) DEFAULT 0.00 NOT NULL,
  locked_amount DECIMAL(10, 2) DEFAULT 0.00 NOT NULL,
  currency TEXT DEFAULT 'EUR' NOT NULL,
  release_conditions JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT positive_amounts CHECK (total_amount >= 0 AND locked_amount >= 0 AND locked_amount <= total_amount)
);

-- =============================================
-- SUBSCRIPTION SYSTEM
-- =============================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('investigator_basic', 'investigator_pro', 'user_premium')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due', 'trialing')),
  price DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'EUR' NOT NULL,
  billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  stripe_subscription_id TEXT UNIQUE,
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  trial_end TIMESTAMP WITH TIME ZONE,
  features JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  feature TEXT NOT NULL CHECK (feature IN ('image_generation', 'analysis', 'enhancement', 'ocr', 'translation')),
  cost DECIMAL(6, 4) NOT NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================
-- KYC & AML COMPLIANCE
-- =============================================

CREATE TABLE IF NOT EXISTS kyc_verification (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'review_needed')),
  verification_level INTEGER DEFAULT 0 CHECK (verification_level BETWEEN 0 AND 2), -- 0: none, 1: basic, 2: advanced
  stripe_verification_session_id TEXT,
  verified_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS transaction_limits (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  daily_limit DECIMAL(10, 2) DEFAULT 100.00 NOT NULL,
  monthly_limit DECIMAL(10, 2) DEFAULT 500.00 NOT NULL,
  daily_spent DECIMAL(10, 2) DEFAULT 0.00 NOT NULL,
  monthly_spent DECIMAL(10, 2) DEFAULT 0.00 NOT NULL,
  last_reset_daily TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  last_reset_monthly TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT positive_limits CHECK (daily_limit >= 0 AND monthly_limit >= 0)
);

-- =============================================
-- MODERATION & SECURITY
-- =============================================

CREATE TABLE IF NOT EXISTS moderation_flags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type IN ('case', 'comment', 'profile', 'message')),
  content_id UUID NOT NULL,
  reason TEXT NOT NULL,
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  flagged_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  admin_notes TEXT,
  action_taken TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS admin_actions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  admin_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS user_bans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  banned_by UUID REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  reason TEXT NOT NULL,
  ban_type TEXT DEFAULT 'temporary' CHECK (ban_type IN ('temporary', 'permanent')),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================
-- GAMIFICATION
-- =============================================

CREATE TABLE IF NOT EXISTS achievements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  points INTEGER DEFAULT 0,
  rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary')),
  requirements JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS user_achievements (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS referrals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  referrer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  referee_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  referral_code TEXT NOT NULL,
  reward_amount DECIMAL(10, 2) DEFAULT 5.00,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(referrer_id, referee_id)
);

CREATE TABLE IF NOT EXISTS challenges (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  challenge_type TEXT NOT NULL,
  target INTEGER NOT NULL,
  reward_amount DECIMAL(10, 2),
  reward_reputation INTEGER,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS user_challenges (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE,
  progress INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (user_id, challenge_id)
);

-- =============================================
-- MONETIZATION
-- =============================================

CREATE TABLE IF NOT EXISTS featured_cases (
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE PRIMARY KEY,
  featured_until TIMESTAMP WITH TIME ZONE NOT NULL,
  price_paid DECIMAL(10, 2) NOT NULL,
  position INTEGER DEFAULT 1,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS platform_revenue (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  revenue_type TEXT NOT NULL CHECK (revenue_type IN ('platform_fee', 'subscription', 'featured_case', 'ad_revenue', 'api_access')),
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'EUR' NOT NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_stripe_customer ON wallets(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_transactions_wallets ON transactions(from_wallet_id, to_wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_stripe_intent ON transactions(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period ON subscriptions(current_period_end);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_subscription ON ai_usage(subscription_id);

CREATE INDEX IF NOT EXISTS idx_kyc_user ON kyc_verification(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_status ON kyc_verification(status);

CREATE INDEX IF NOT EXISTS idx_moderation_status ON moderation_flags(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_content ON moderation_flags(content_type, content_id);

CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON admin_actions(admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON admin_actions(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_user_bans_user ON user_bans(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bans_active ON user_bans(is_active, expires_at);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_escrow ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Wallets: Users see only their own
DROP POLICY IF EXISTS "Users view own wallet" ON wallets;
CREATE POLICY "Users view own wallet" ON wallets FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own wallet" ON wallets;
CREATE POLICY "Users update own wallet" ON wallets FOR UPDATE USING (auth.uid() = user_id);

-- Transactions: Users see their own transactions
DROP POLICY IF EXISTS "Users view own transactions" ON transactions;
CREATE POLICY "Users view own transactions" ON transactions FOR SELECT USING (
  auth.uid() IN (
    SELECT user_id FROM wallets WHERE id IN (from_wallet_id, to_wallet_id)
  )
);

-- Subscriptions: Users see own subscriptions
DROP POLICY IF EXISTS "Users view own subscriptions" ON subscriptions;
CREATE POLICY "Users view own subscriptions" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- AI Usage: Users see own usage
DROP POLICY IF EXISTS "Users view own ai usage" ON ai_usage;
CREATE POLICY "Users view own ai usage" ON ai_usage FOR SELECT USING (auth.uid() = user_id);

-- KYC: Users see only their own verification
DROP POLICY IF EXISTS "Users view own kyc" ON kyc_verification;
CREATE POLICY "Users view own kyc" ON kyc_verification FOR SELECT USING (auth.uid() = user_id);

-- Case Escrow: Public read (to see reward pools)
DROP POLICY IF EXISTS "Public view escrow" ON case_escrow;
CREATE POLICY "Public view escrow" ON case_escrow FOR SELECT USING (true);

-- Achievements: Public read
DROP POLICY IF EXISTS "Public view achievements" ON achievements;
CREATE POLICY "Public view achievements" ON achievements FOR SELECT USING (true);

-- User Achievements: Users see all achievements
DROP POLICY IF EXISTS "Users view all achievements" ON user_achievements;
CREATE POLICY "Users view all achievements" ON user_achievements FOR SELECT USING (true);

-- Referrals: Users see own referrals
DROP POLICY IF EXISTS "Users view own referrals" ON referrals;
CREATE POLICY "Users view own referrals" ON referrals FOR SELECT USING (
  auth.uid() = referrer_id OR auth.uid() = referee_id
);

-- Moderation Flags: Admins only
DROP POLICY IF EXISTS "Admins view moderation flags" ON moderation_flags;
CREATE POLICY "Admins view moderation flags" ON moderation_flags FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Admin Actions: Admins only
DROP POLICY IF EXISTS "Admins view admin actions" ON admin_actions;
CREATE POLICY "Admins view admin actions" ON admin_actions FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- User Bans: Admins only
DROP POLICY IF EXISTS "Admins manage bans" ON user_bans;
CREATE POLICY "Admins manage bans" ON user_bans FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- =============================================
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Create wallet automatically when user signs up
CREATE OR REPLACE FUNCTION create_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO wallets (user_id, balance, currency)
  VALUES (NEW.id, 0.00, 'EUR');
  
  INSERT INTO transaction_limits (user_id, daily_limit, monthly_limit)
  VALUES (NEW.id, 100.00, 500.00);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created ON profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION create_user_wallet();

-- Update wallet balance on transaction completion
CREATE OR REPLACE FUNCTION update_wallet_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Deduct from sender
    IF NEW.from_wallet_id IS NOT NULL THEN
      UPDATE wallets
      SET balance = balance - NEW.amount,
          updated_at = NOW()
      WHERE id = NEW.from_wallet_id;
    END IF;
    
    -- Add to receiver
    IF NEW.to_wallet_id IS NOT NULL THEN
      UPDATE wallets
      SET balance = balance + NEW.amount,
          updated_at = NOW()
      WHERE id = NEW.to_wallet_id;
    END IF;
    
    -- Record platform revenue if applicable
    IF NEW.transaction_type = 'platform_fee' THEN
      INSERT INTO platform_revenue (revenue_type, amount, currency, transaction_id)
      VALUES ('platform_fee', NEW.amount, NEW.currency, NEW.id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_transaction_completed ON transactions;
CREATE TRIGGER on_transaction_completed
  AFTER UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_wallet_on_transaction();

-- Auto-flag suspicious content
CREATE OR REPLACE FUNCTION flag_suspicious_content()
RETURNS TRIGGER AS $$
DECLARE
  content_text TEXT;
BEGIN
  -- Get content based on table
  IF TG_TABLE_NAME = 'comments' THEN
    content_text := NEW.content;
  ELSIF TG_TABLE_NAME = 'cases' THEN
    content_text := NEW.title || ' ' || NEW.description;
  ELSE
    RETURN NEW;
  END IF;
  
  -- Check for spam keywords
  IF content_text ~* '(viagra|casino|binary.?option|forex|cryptocurrency.?investment|click.?here|buy.?now)' THEN
    INSERT INTO moderation_flags (content_type, content_id, reason, severity)
    VALUES (TG_TABLE_NAME, NEW.id, 'Spam keywords detected', 'high');
  END IF;
  
  -- Check for excessive caps (>70% uppercase)
  IF LENGTH(REGEXP_REPLACE(content_text, '[^A-Z]', '', 'g')) > LENGTH(content_text) * 0.7 THEN
    INSERT INTO moderation_flags (content_type, content_id, reason, severity)
    VALUES (TG_TABLE_NAME, NEW.id, 'Excessive caps lock', 'low');
  END IF;
  
  -- Check for suspicious URLs
  IF content_text ~ 'http[s]?://[^/]+\.(xyz|tk|ml|ga|cf|gq)' THEN
    INSERT INTO moderation_flags (content_type, content_id, reason, severity)
    VALUES (TG_TABLE_NAME, NEW.id, 'Suspicious domain detected', 'high');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS flag_suspicious_comments ON comments;
CREATE TRIGGER flag_suspicious_comments
  AFTER INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION flag_suspicious_content();

DROP TRIGGER IF EXISTS flag_suspicious_cases ON cases;
CREATE TRIGGER flag_suspicious_cases
  AFTER INSERT ON cases
  FOR EACH ROW EXECUTE FUNCTION flag_suspicious_content();

-- Reset transaction limits daily/monthly
CREATE OR REPLACE FUNCTION reset_transaction_limits()
RETURNS void AS $$
BEGIN
  -- Reset daily limits
  UPDATE transaction_limits
  SET daily_spent = 0,
      last_reset_daily = NOW()
  WHERE last_reset_daily < NOW() - INTERVAL '1 day';
  
  -- Reset monthly limits
  UPDATE transaction_limits
  SET monthly_spent = 0,
      last_reset_monthly = NOW()
  WHERE last_reset_monthly < NOW() - INTERVAL '1 month';
END;
$$ LANGUAGE plpgsql;

-- Seed default achievements
INSERT INTO achievements (code, name, description, points, rarity) VALUES
('first_case', 'First Case', 'Submit your first unexplained case', 10, 'common'),
('first_comment', 'Conversationalist', 'Post your first comment', 5, 'common'),
('case_solver', 'Truth Seeker', 'Help solve your first case', 50, 'rare'),
('reputation_100', 'Rising Star', 'Reach 100 reputation points', 25, 'rare'),
('reputation_1000', 'Legend', 'Reach 1000 reputation points', 500, 'legendary'),
('investigator', 'Professional Investigator', 'Become a verified investigator', 100, 'epic'),
('donations_5', 'Generous', 'Donate to 5 different cases', 75, 'epic'),
('week_streak', 'Dedicated', 'Log in for 7 days in a row', 30, 'rare')
ON CONFLICT (code) DO NOTHING;
