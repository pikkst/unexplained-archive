-- =============================================
-- ADMIN: SUBSCRIPTION GROUPS FOR MASS NOTIFICATIONS
-- Add to existing migration or run separately
-- =============================================

-- =============================================
-- 1. SUBSCRIPTION NOTIFICATION GROUPS
-- =============================================

CREATE TABLE IF NOT EXISTS subscription_notification_groups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_code TEXT UNIQUE NOT NULL, -- 'basic_active', 'premium_active', etc.
  group_name TEXT NOT NULL,
  description TEXT,
  
  -- Group criteria (for automatic filtering)
  criteria JSONB DEFAULT '{}', -- { plan_type: 'basic', status: 'active' }
  
  -- Stats
  member_count INTEGER DEFAULT 0,
  last_notification_sent_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed notification groups
INSERT INTO subscription_notification_groups (group_code, group_name, description, criteria) VALUES
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

-- =============================================
-- 2. MASS NOTIFICATION LOG
-- =============================================

CREATE TABLE IF NOT EXISTS mass_notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  
  -- Notification details
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  notification_type TEXT DEFAULT 'announcement' CHECK (notification_type IN ('announcement', 'update', 'promotion', 'warning', 'reminder')),
  
  -- Target group
  target_group_code TEXT REFERENCES subscription_notification_groups(group_code),
  target_user_ids UUID[], -- Specific user IDs (if not using group)
  
  -- Delivery
  delivery_method TEXT DEFAULT 'email' CHECK (delivery_method IN ('email', 'in_app', 'both')),
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'completed', 'failed')),
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  
  -- Sender
  sent_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Index for notifications
CREATE INDEX IF NOT EXISTS idx_mass_notifications_status ON mass_notifications(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mass_notifications_group ON mass_notifications(target_group_code);

-- =============================================
-- 3. FUNCTION: Get Group Members
-- =============================================

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
  -- Get group criteria
  SELECT criteria INTO v_criteria
  FROM subscription_notification_groups
  WHERE group_code = p_group_code;

  -- Return matching users based on criteria
  -- This is a simplified version - expand based on actual criteria needs
  
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
      
  ELSIF p_group_code = 'trial_users' THEN
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
    WHERE s.status = 'trialing';
    
  ELSIF p_group_code = 'canceled_subscribers' THEN
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
    WHERE s.status = 'canceled';
    
  ELSIF p_group_code = 'expired_subscribers' THEN
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
    WHERE s.status = 'expired'
      AND s.updated_at >= NOW() - INTERVAL '30 days';
      
  ELSIF p_group_code = 'high_usage' THEN
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
    JOIN subscription_credits sc ON sc.user_id = s.user_id
    WHERE s.plan_type = 'basic'
      AND s.status = 'active'
      AND sc.credits_total > 0
      AND (sc.credits_used::FLOAT / sc.credits_total::FLOAT) > 0.8;
      
  ELSIF p_group_code = 'low_usage' THEN
    RETURN QUERY
    SELECT DISTINCT
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
    LEFT JOIN subscription_usage_log sul ON sul.user_id = s.user_id
      AND sul.created_at >= NOW() - INTERVAL '30 days'
    WHERE s.status = 'active'
      AND sul.id IS NULL; -- No usage in last 30 days
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 4. FUNCTION: Update Group Member Count
-- =============================================

CREATE OR REPLACE FUNCTION update_group_member_counts()
RETURNS VOID AS $$
DECLARE
  v_group RECORD;
  v_count INTEGER;
BEGIN
  -- Loop through each group and update count
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

-- =============================================
-- 5. RLS POLICIES
-- =============================================

ALTER TABLE subscription_notification_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view groups" ON subscription_notification_groups;
DROP POLICY IF EXISTS "Admins can update groups" ON subscription_notification_groups;
DROP POLICY IF EXISTS "Service role full access groups" ON subscription_notification_groups;
DROP POLICY IF EXISTS "Admins can view notifications" ON mass_notifications;
DROP POLICY IF EXISTS "Admins can create notifications" ON mass_notifications;
DROP POLICY IF EXISTS "Admins can update notifications" ON mass_notifications;
DROP POLICY IF EXISTS "Service role full access notifications" ON mass_notifications;

-- Only admins can see groups
CREATE POLICY "Admins can view groups" ON subscription_notification_groups
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can update groups
CREATE POLICY "Admins can update groups" ON subscription_notification_groups
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can see mass notifications
CREATE POLICY "Admins can view notifications" ON mass_notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can create mass notifications
CREATE POLICY "Admins can create notifications" ON mass_notifications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can update mass notifications
CREATE POLICY "Admins can update notifications" ON mass_notifications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Service role full access
CREATE POLICY "Service role full access groups" ON subscription_notification_groups
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access notifications" ON mass_notifications
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- 6. GRANTS
-- =============================================

GRANT SELECT ON subscription_notification_groups TO authenticated;
GRANT SELECT ON mass_notifications TO authenticated;
GRANT ALL ON subscription_notification_groups TO service_role;
GRANT ALL ON mass_notifications TO service_role;

-- =============================================
-- VERIFICATION
-- =============================================

-- Check groups
-- SELECT * FROM subscription_notification_groups ORDER BY group_code;

-- Get members of a group
-- SELECT * FROM get_subscription_group_members('basic_subscribers');

-- Update member counts
-- SELECT update_group_member_counts();
-- SELECT group_code, group_name, member_count FROM subscription_notification_groups ORDER BY member_count DESC;
