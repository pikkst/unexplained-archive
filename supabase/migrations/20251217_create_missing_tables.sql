-- Create missing tables: case_templates and promotional_campaigns
-- Run this in Supabase SQL Editor

-- ============================================
-- CASE TEMPLATES TABLE
-- ============================================

-- Create case templates table for guided case submission
CREATE TABLE IF NOT EXISTS case_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  form_fields JSONB NOT NULL,
  guidance_text TEXT,
  required_fields TEXT[],
  is_public BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_case_templates_category ON case_templates(category);
CREATE INDEX IF NOT EXISTS idx_case_templates_public ON case_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_case_templates_usage ON case_templates(usage_count DESC);

-- Enable Row Level Security
ALTER TABLE case_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for case_templates
CREATE POLICY "Anyone can view public templates"
  ON case_templates FOR SELECT
  USING (is_public = true OR auth.uid() = created_by);

CREATE POLICY "Authenticated users can create templates"
  ON case_templates FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own templates"
  ON case_templates FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own templates"
  ON case_templates FOR DELETE
  USING (auth.uid() = created_by);

-- ============================================
-- PROMOTIONAL CAMPAIGNS TABLES
-- ============================================

-- Main campaigns table
CREATE TABLE IF NOT EXISTS promotional_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  campaign_type VARCHAR(50) NOT NULL,
  discount_type VARCHAR(50),
  discount_value NUMERIC(10,2),
  credit_bonus INTEGER,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  target_audience JSONB,
  max_redemptions INTEGER,
  current_redemptions INTEGER DEFAULT 0,
  budget NUMERIC(10,2),
  spent NUMERIC(10,2) DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Promo codes table
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES promotional_campaigns(id) ON DELETE CASCADE,
  code VARCHAR(50) UNIQUE NOT NULL,
  usage_limit INTEGER,
  used_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaign redemptions tracking
CREATE TABLE IF NOT EXISTS campaign_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES promotional_campaigns(id) ON DELETE CASCADE,
  promo_code_id UUID REFERENCES promo_codes(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  discount_amount NUMERIC(10,2),
  credits_awarded INTEGER,
  redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaign analytics
CREATE TABLE IF NOT EXISTS campaign_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES promotional_campaigns(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  revenue NUMERIC(10,2) DEFAULT 0,
  cost NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(campaign_id, metric_date)
);

-- AI-generated campaign content
CREATE TABLE IF NOT EXISTS campaign_ai_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES promotional_campaigns(id) ON DELETE CASCADE,
  content_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  language VARCHAR(10) DEFAULT 'en',
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON promotional_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_dates ON promotional_campaigns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_campaign ON promo_codes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_user ON campaign_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_campaign ON campaign_redemptions(campaign_id);

-- Enable Row Level Security
ALTER TABLE promotional_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_ai_content ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage campaigns" ON promotional_campaigns;
DROP POLICY IF EXISTS "Anyone can view active campaigns" ON promotional_campaigns;
DROP POLICY IF EXISTS "Users can view active campaigns" ON promotional_campaigns;
DROP POLICY IF EXISTS "Admins can manage promo codes" ON promo_codes;
DROP POLICY IF EXISTS "Anyone can check promo codes" ON promo_codes;
DROP POLICY IF EXISTS "Users can check promo codes" ON promo_codes;
DROP POLICY IF EXISTS "Users can view their own redemptions" ON campaign_redemptions;
DROP POLICY IF EXISTS "Admins can view all redemptions" ON campaign_redemptions;
DROP POLICY IF EXISTS "System can create redemptions" ON campaign_redemptions;
DROP POLICY IF EXISTS "Admins can manage analytics" ON campaign_analytics;
DROP POLICY IF EXISTS "Admins can manage AI content" ON campaign_ai_content;
DROP POLICY IF EXISTS "Anyone can view campaign AI content" ON campaign_ai_content;

-- RLS Policies for promotional_campaigns
CREATE POLICY "Admins can manage campaigns" ON promotional_campaigns
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Anyone can view active campaigns" ON promotional_campaigns
    FOR SELECT USING (
        status = 'active' 
        AND start_date <= NOW() 
        AND end_date >= NOW()
    );

-- RLS Policies for promo_codes
CREATE POLICY "Admins can manage promo codes" ON promo_codes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Anyone can check promo codes" ON promo_codes
    FOR SELECT USING (
        is_active = true AND 
        valid_from <= NOW() AND 
        valid_until >= NOW()
    );

-- RLS Policies for campaign_redemptions
CREATE POLICY "Users can view their own redemptions" ON campaign_redemptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all redemptions" ON campaign_redemptions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

CREATE POLICY "System can create redemptions" ON campaign_redemptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for campaign_analytics
CREATE POLICY "Admins can manage analytics" ON campaign_analytics
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- RLS Policies for campaign_ai_content
CREATE POLICY "Admins can manage AI content" ON campaign_ai_content
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Anyone can view campaign AI content" ON campaign_ai_content
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM promotional_campaigns 
            WHERE promotional_campaigns.id = campaign_ai_content.campaign_id 
            AND promotional_campaigns.status = 'active'
            AND promotional_campaigns.start_date <= NOW()
            AND promotional_campaigns.end_date >= NOW()
        )
    );
