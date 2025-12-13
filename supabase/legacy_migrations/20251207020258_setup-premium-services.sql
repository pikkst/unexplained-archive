-- =============================================
-- PREMIUM SERVICES IMPLEMENTATION
-- Investigator Pro, Case Boosts, Background Checks
-- =============================================

-- =============================================
-- 1. INVESTIGATOR PRO SUBSCRIPTION
-- =============================================

-- Update subscription plans with correct pricing
-- Note: subscriptions table already exists in supabase-schema-extended.sql

-- Add Pro features tracking
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_pro_member BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pro_since TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS pro_badge_color TEXT DEFAULT 'gold', -- gold, platinum, diamond
ADD COLUMN IF NOT EXISTS custom_profile_theme JSONB DEFAULT '{}'::jsonb; -- {primaryColor, secondaryColor, logoUrl}

-- Function to activate Pro subscription
CREATE OR REPLACE FUNCTION activate_pro_subscription(
  p_user_id UUID,
  p_plan_type TEXT,
  p_stripe_subscription_id TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Update subscription record
  UPDATE subscriptions
  SET 
    status = 'active',
    stripe_subscription_id = p_stripe_subscription_id,
    current_period_start = NOW(),
    current_period_end = NOW() + INTERVAL '1 month'
  WHERE user_id = p_user_id;
  
  -- Update profile Pro status
  UPDATE profiles
  SET 
    is_pro_member = TRUE,
    pro_since = NOW()
  WHERE id = p_user_id;
  
  -- Log transaction
  INSERT INTO transactions (
    user_id,
    transaction_type,
    amount,
    status,
    description,
    metadata
  ) VALUES (
    p_user_id,
    'subscription',
    CASE 
      WHEN p_plan_type = 'investigator_pro' THEN 15.00
      WHEN p_plan_type = 'investigator_basic' THEN 10.00
      ELSE 5.00
    END,
    'completed',
    'Subscription activated: ' || p_plan_type,
    jsonb_build_object(
      'plan_type', p_plan_type,
      'stripe_subscription_id', p_stripe_subscription_id
    )
  );
  
  v_result := jsonb_build_object(
    'success', true,
    'message', 'Pro subscription activated',
    'plan_type', p_plan_type
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cancel Pro subscription
CREATE OR REPLACE FUNCTION cancel_pro_subscription(
  p_user_id UUID
)
RETURNS JSONB AS $$
BEGIN
  -- Mark subscription as cancelled
  UPDATE subscriptions
  SET 
    cancel_at_period_end = TRUE
  WHERE user_id = p_user_id
    AND status = 'active';
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Subscription will be cancelled at period end'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 2. FEATURED CASE BOOST
-- =============================================

-- Case boosts table (featured_cases already exists, enhance it)
ALTER TABLE featured_cases
ADD COLUMN IF NOT EXISTS boost_type TEXT DEFAULT '24h' CHECK (boost_type IN ('24h', '7d', '30d')),
ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS stripe_payment_id TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled'));

-- Create boost pricing
CREATE TABLE IF NOT EXISTS boost_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  boost_type TEXT UNIQUE NOT NULL,
  duration_hours INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  display_name TEXT NOT NULL,
  features JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert boost pricing
INSERT INTO boost_pricing (boost_type, duration_hours, price, display_name, features) VALUES
  ('24h', 24, 5.00, '24 Hour Boost', '["Pin to top", "Homepage highlight"]'),
  ('7d', 168, 15.00, '7 Day Boost', '["Pin to top", "Homepage highlight", "Newsletter feature"]'),
  ('30d', 720, 50.00, '30 Day Premium Boost', '["Pin to top", "Homepage banner", "Newsletter feature", "Social media promotion"]')
ON CONFLICT (boost_type) DO NOTHING;

-- Function to purchase case boost
CREATE OR REPLACE FUNCTION purchase_case_boost(
  p_case_id UUID,
  p_user_id UUID,
  p_boost_type TEXT,
  p_stripe_payment_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_price DECIMAL(10,2);
  v_duration_hours INT;
  v_case_owner UUID;
  v_wallet_balance DECIMAL(10,2);
BEGIN
  -- Get boost pricing
  SELECT price, duration_hours INTO v_price, v_duration_hours
  FROM boost_pricing
  WHERE boost_type = p_boost_type;
  
  IF v_price IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid boost type'
    );
  END IF;
  
  -- Verify case ownership
  SELECT user_id INTO v_case_owner
  FROM cases
  WHERE id = p_case_id;
  
  IF v_case_owner != p_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You can only boost your own cases'
    );
  END IF;
  
  -- Check if paying with wallet
  IF p_stripe_payment_id IS NULL THEN
    SELECT balance INTO v_wallet_balance
    FROM wallets
    WHERE user_id = p_user_id;
    
    IF v_wallet_balance < v_price THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Insufficient wallet balance'
      );
    END IF;
    
    -- Deduct from wallet
    UPDATE wallets
    SET balance = balance - v_price
    WHERE user_id = p_user_id;
  END IF;
  
  -- Create or update boost
  INSERT INTO featured_cases (
    case_id,
    featured_until,
    price_paid,
    boost_type,
    paid_by,
    stripe_payment_id,
    status
  ) VALUES (
    p_case_id,
    NOW() + (v_duration_hours || ' hours')::INTERVAL,
    v_price,
    p_boost_type,
    p_user_id,
    p_stripe_payment_id,
    'active'
  )
  ON CONFLICT (case_id) 
  DO UPDATE SET
    featured_until = GREATEST(featured_cases.featured_until, NOW()) + (v_duration_hours || ' hours')::INTERVAL,
    price_paid = featured_cases.price_paid + v_price,
    boost_type = EXCLUDED.boost_type,
    status = 'active';
  
  -- Log transaction
  INSERT INTO transactions (
    user_id,
    transaction_type,
    amount,
    status,
    description,
    stripe_payment_id,
    metadata
  ) VALUES (
    p_user_id,
    'case_boost',
    v_price,
    'completed',
    'Featured case boost: ' || p_boost_type,
    p_stripe_payment_id,
    jsonb_build_object(
      'case_id', p_case_id,
      'boost_type', p_boost_type,
      'duration_hours', v_duration_hours
    )
  );
  
  -- Log platform revenue
  INSERT INTO platform_revenue (
    revenue_type,
    amount,
    metadata
  ) VALUES (
    'featured_case',
    v_price,
    jsonb_build_object(
      'case_id', p_case_id,
      'boost_type', p_boost_type,
      'paid_by', p_user_id
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Case boost activated',
    'featured_until', (NOW() + (v_duration_hours || ' hours')::INTERVAL)::text,
    'price_paid', v_price
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if case is boosted
CREATE OR REPLACE FUNCTION is_case_boosted(p_case_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM featured_cases
    WHERE case_id = p_case_id
      AND status = 'active'
      AND featured_until > NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- Function to expire old boosts (run via cron)
CREATE OR REPLACE FUNCTION expire_old_boosts()
RETURNS VOID AS $$
BEGIN
  UPDATE featured_cases
  SET status = 'expired'
  WHERE status = 'active'
    AND featured_until < NOW();
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 3. BACKGROUND CHECK / VERIFICATION
-- =============================================

CREATE TABLE IF NOT EXISTS background_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investigator_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Check details
  check_type TEXT DEFAULT 'standard' CHECK (check_type IN ('standard', 'premium')),
  price_paid DECIMAL(10,2) NOT NULL DEFAULT 25.00,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  
  -- Results
  verified BOOLEAN DEFAULT FALSE,
  verification_level TEXT, -- 'basic', 'enhanced', 'premium'
  badge_color TEXT DEFAULT 'blue', -- blue, gold, diamond
  
  -- Documents submitted
  documents JSONB DEFAULT '[]'::jsonb, -- [{type, url, verified}]
  
  -- Verification results
  identity_verified BOOLEAN DEFAULT FALSE,
  credentials_verified BOOLEAN DEFAULT FALSE,
  background_clear BOOLEAN DEFAULT FALSE,
  
  -- Admin review
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- Payment
  stripe_payment_id TEXT,
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ -- Verification expires after 1 year
);

-- Request background check
CREATE OR REPLACE FUNCTION request_background_check(
  p_investigator_id UUID,
  p_check_type TEXT DEFAULT 'standard',
  p_stripe_payment_id TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_price DECIMAL(10,2);
  v_wallet_balance DECIMAL(10,2);
  v_check_id UUID;
BEGIN
  -- Check if already has active verification
  IF EXISTS (
    SELECT 1 FROM background_checks
    WHERE investigator_id = p_investigator_id
      AND status IN ('pending', 'in_progress', 'completed')
      AND (expires_at IS NULL OR expires_at > NOW())
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You already have an active verification'
    );
  END IF;
  
  -- Set price
  v_price := CASE 
    WHEN p_check_type = 'premium' THEN 50.00
    ELSE 25.00
  END;
  
  -- Check payment
  IF p_stripe_payment_id IS NULL THEN
    SELECT balance INTO v_wallet_balance
    FROM wallets
    WHERE user_id = p_investigator_id;
    
    IF v_wallet_balance < v_price THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Insufficient wallet balance'
      );
    END IF;
    
    -- Deduct from wallet
    UPDATE wallets
    SET balance = balance - v_price
    WHERE user_id = p_investigator_id;
  END IF;
  
  -- Create background check request
  INSERT INTO background_checks (
    investigator_id,
    check_type,
    price_paid,
    status,
    stripe_payment_id,
    expires_at
  ) VALUES (
    p_investigator_id,
    p_check_type,
    v_price,
    'pending',
    p_stripe_payment_id,
    NOW() + INTERVAL '1 year'
  )
  RETURNING id INTO v_check_id;
  
  -- Log transaction
  INSERT INTO transactions (
    user_id,
    transaction_type,
    amount,
    status,
    description,
    stripe_payment_id,
    metadata
  ) VALUES (
    p_investigator_id,
    'background_check',
    v_price,
    'completed',
    'Background check: ' || p_check_type,
    p_stripe_payment_id,
    jsonb_build_object(
      'check_id', v_check_id,
      'check_type', p_check_type
    )
  );
  
  -- Log platform revenue
  INSERT INTO platform_revenue (
    revenue_type,
    amount,
    metadata
  ) VALUES (
    'background_check',
    v_price,
    jsonb_build_object(
      'investigator_id', p_investigator_id,
      'check_type', p_check_type
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Background check request submitted',
    'check_id', v_check_id,
    'price_paid', v_price,
    'status', 'pending'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin: Complete background check
CREATE OR REPLACE FUNCTION complete_background_check(
  p_check_id UUID,
  p_admin_id UUID,
  p_verified BOOLEAN,
  p_identity_verified BOOLEAN,
  p_credentials_verified BOOLEAN,
  p_background_clear BOOLEAN,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_investigator_id UUID;
  v_badge_color TEXT;
  v_verification_level TEXT;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_admin_id AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Admin only'
    );
  END IF;
  
  -- Determine verification level
  IF p_identity_verified AND p_credentials_verified AND p_background_clear THEN
    v_verification_level := 'premium';
    v_badge_color := 'gold';
  ELSIF p_identity_verified AND p_credentials_verified THEN
    v_verification_level := 'enhanced';
    v_badge_color := 'blue';
  ELSE
    v_verification_level := 'basic';
    v_badge_color := 'gray';
  END IF;
  
  -- Update background check
  UPDATE background_checks
  SET 
    status = CASE WHEN p_verified THEN 'completed' ELSE 'failed' END,
    verified = p_verified,
    verification_level = v_verification_level,
    badge_color = v_badge_color,
    identity_verified = p_identity_verified,
    credentials_verified = p_credentials_verified,
    background_clear = p_background_clear,
    reviewed_by = p_admin_id,
    reviewed_at = NOW(),
    review_notes = p_review_notes,
    completed_at = NOW()
  WHERE id = p_check_id
  RETURNING investigator_id INTO v_investigator_id;
  
  -- Update investigator profile
  IF p_verified THEN
    UPDATE profiles
    SET 
      is_verified = TRUE,
      verified_at = NOW()
    WHERE id = v_investigator_id;
  END IF;
  
  -- Send notification to investigator
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    metadata
  ) VALUES (
    v_investigator_id,
    'verification_completed',
    CASE WHEN p_verified THEN 'Verification Complete! ✅' ELSE 'Verification Failed' END,
    CASE 
      WHEN p_verified THEN 'Your background check has been approved. You now have a verified badge on your profile!'
      ELSE 'Your background check could not be completed. Please contact support for more information.'
    END,
    jsonb_build_object(
      'check_id', p_check_id,
      'verified', p_verified,
      'verification_level', v_verification_level
    )
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Background check completed',
    'verified', p_verified,
    'verification_level', v_verification_level
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Get investigator's verification status
CREATE OR REPLACE FUNCTION get_verification_status(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_check RECORD;
BEGIN
  SELECT * INTO v_check
  FROM background_checks
  WHERE investigator_id = p_user_id
    AND status = 'completed'
    AND verified = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY completed_at DESC
  LIMIT 1;
  
  IF v_check IS NULL THEN
    RETURN jsonb_build_object(
      'verified', false,
      'badge_color', null,
      'verification_level', null
    );
  END IF;
  
  RETURN jsonb_build_object(
    'verified', true,
    'badge_color', v_check.badge_color,
    'verification_level', v_check.verification_level,
    'verified_at', v_check.completed_at,
    'expires_at', v_check.expires_at
  );
END;
$$ LANGUAGE plpgsql;

-- Get all active boosts
CREATE OR REPLACE FUNCTION get_active_boosts()
RETURNS TABLE(
  case_id UUID,
  title TEXT,
  featured_until TIMESTAMPTZ,
  boost_type TEXT,
  impressions INT,
  clicks INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fc.case_id,
    c.title,
    fc.featured_until,
    fc.boost_type,
    fc.impressions,
    fc.clicks
  FROM featured_cases fc
  JOIN cases c ON c.id = fc.case_id
  WHERE fc.status = 'active'
    AND fc.featured_until > NOW()
  ORDER BY fc.position ASC, fc.featured_until DESC;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- RLS POLICIES
-- =============================================

-- Background checks: Users can view their own, admins can view all
ALTER TABLE background_checks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own checks" ON background_checks;
DROP POLICY IF EXISTS "Admins can view all checks" ON background_checks;
DROP POLICY IF EXISTS "Users can request checks" ON background_checks;
DROP POLICY IF EXISTS "Admins can update checks" ON background_checks;

CREATE POLICY "Users can view own checks"
  ON background_checks FOR SELECT
  USING (investigator_id = auth.uid());

CREATE POLICY "Admins can view all checks"
  ON background_checks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Users can request checks"
  ON background_checks FOR INSERT
  WITH CHECK (investigator_id = auth.uid());

CREATE POLICY "Admins can update checks"
  ON background_checks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Featured cases: Public read, owners can insert
ALTER TABLE featured_cases ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view featured cases" ON featured_cases;
DROP POLICY IF EXISTS "Case owners can boost" ON featured_cases;

CREATE POLICY "Anyone can view featured cases"
  ON featured_cases FOR SELECT
  USING (true);

CREATE POLICY "Case owners can boost"
  ON featured_cases FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cases
      WHERE id = case_id AND user_id = auth.uid()
    )
  );

-- Boost pricing: Public read
ALTER TABLE boost_pricing ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Anyone can view boost pricing" ON boost_pricing;

CREATE POLICY "Anyone can view boost pricing"
  ON boost_pricing FOR SELECT
  USING (true);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_background_checks_investigator 
  ON background_checks(investigator_id);

CREATE INDEX IF NOT EXISTS idx_background_checks_status 
  ON background_checks(status);

CREATE INDEX IF NOT EXISTS idx_featured_cases_status 
  ON featured_cases(status, featured_until);

CREATE INDEX IF NOT EXISTS idx_featured_cases_expires 
  ON featured_cases(featured_until) 
  WHERE status = 'active';

-- =============================================
-- INITIAL DATA
-- =============================================

COMMENT ON TABLE background_checks IS 'Investigator background verification requests and results';
COMMENT ON TABLE boost_pricing IS 'Pricing tiers for featured case boosts';
COMMENT ON FUNCTION purchase_case_boost IS 'Purchase a featured boost for a case';
COMMENT ON FUNCTION request_background_check IS 'Request investigator background verification';
COMMENT ON FUNCTION complete_background_check IS 'Admin function to complete verification';

-- Done!
SELECT 'Premium services setup complete!' AS status;
