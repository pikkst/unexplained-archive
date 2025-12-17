-- Promotional Campaign System
-- This migration creates tables for managing promotional campaigns, discount codes, and trial periods

-- 1. Campaigns table - Master table for promotional campaigns
CREATE TABLE IF NOT EXISTS promotional_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    campaign_type VARCHAR(50) NOT NULL, -- 'trial', 'discount', 'free_credits', 'free_ticket'
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'active', 'paused', 'completed', 'expired'
    
    -- Campaign settings
    max_redemptions INTEGER, -- NULL = unlimited
    current_redemptions INTEGER DEFAULT 0,
    
    -- Date ranges
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    
    -- Benefits
    discount_percentage DECIMAL(5,2), -- For discount campaigns
    discount_amount DECIMAL(10,2), -- Fixed amount discount
    free_credits INTEGER, -- Number of free credits
    trial_days INTEGER, -- Number of trial days
    
    -- Targeting
    target_user_segment VARCHAR(50), -- 'new_users', 'all_users', 'investigators', 'first_100'
    requires_code BOOLEAN DEFAULT false,
    
    -- Marketing content
    banner_image_url TEXT,
    banner_text TEXT,
    landing_page_text TEXT,
    cta_button_text VARCHAR(100),
    
    -- AI Generated content
    ai_generated_content JSONB, -- Store Gemini API generated images/texts
    
    -- Tracking
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_campaign_type CHECK (campaign_type IN ('trial', 'discount', 'free_credits', 'free_ticket', 'subscription_discount')),
    CONSTRAINT valid_status CHECK (status IN ('draft', 'active', 'paused', 'completed', 'expired'))
);

-- 2. Promo codes table
CREATE TABLE IF NOT EXISTS promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES promotional_campaigns(id) ON DELETE CASCADE,
    code VARCHAR(50) UNIQUE NOT NULL,
    
    -- Usage limits
    max_uses INTEGER, -- NULL = unlimited
    current_uses INTEGER DEFAULT 0,
    max_uses_per_user INTEGER DEFAULT 1,
    
    -- Validity
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    
    -- Tracking
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- 3. Campaign redemptions table - Track who used what
CREATE TABLE IF NOT EXISTS campaign_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES promotional_campaigns(id) ON DELETE CASCADE,
    promo_code_id UUID REFERENCES promo_codes(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- What they got
    benefit_type VARCHAR(50), -- 'trial', 'discount', 'credits', 'ticket'
    benefit_value JSONB, -- Flexible storage for benefit details
    
    -- Status
    redeemed_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'used', 'expired', 'revoked'
    
    -- Applied to what
    applied_to_order_id VARCHAR(255), -- Stripe payment intent ID or subscription ID
    
    CONSTRAINT valid_benefit_type CHECK (benefit_type IN ('trial', 'discount', 'credits', 'ticket', 'subscription')),
    CONSTRAINT valid_redemption_status CHECK (status IN ('active', 'used', 'expired', 'revoked'))
);

-- 4. Campaign analytics table
CREATE TABLE IF NOT EXISTS campaign_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES promotional_campaigns(id) ON DELETE CASCADE,
    
    -- Metrics by date
    date DATE NOT NULL,
    
    -- Engagement metrics
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    redemptions INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0, -- Users who completed desired action (e.g., purchase)
    
    -- Revenue metrics
    revenue_generated DECIMAL(10,2) DEFAULT 0,
    discount_given DECIMAL(10,2) DEFAULT 0,
    
    -- User segments
    new_users INTEGER DEFAULT 0,
    returning_users INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(campaign_id, date)
);

-- 5. AI content generation log
CREATE TABLE IF NOT EXISTS campaign_ai_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES promotional_campaigns(id) ON DELETE CASCADE,
    
    content_type VARCHAR(50), -- 'banner_image', 'social_media', 'email_text', 'ad_copy'
    prompt TEXT NOT NULL,
    generated_content TEXT,
    image_url TEXT,
    
    -- AI metadata
    ai_model VARCHAR(50) DEFAULT 'gemini-2.0-flash-exp',
    generation_parameters JSONB,
    
    -- Quality tracking
    quality_score INTEGER, -- 1-5 rating by admin
    is_approved BOOLEAN DEFAULT false,
    is_used BOOLEAN DEFAULT false,
    
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    generated_by UUID REFERENCES auth.users(id)
);

-- Indexes for performance
CREATE INDEX idx_campaigns_status ON promotional_campaigns(status);
CREATE INDEX idx_campaigns_dates ON promotional_campaigns(start_date, end_date);
CREATE INDEX idx_promo_codes_code ON promo_codes(code);
CREATE INDEX idx_promo_codes_campaign ON promo_codes(campaign_id);
CREATE INDEX idx_redemptions_user ON campaign_redemptions(user_id);
CREATE INDEX idx_redemptions_campaign ON campaign_redemptions(campaign_id);
CREATE INDEX idx_analytics_campaign_date ON campaign_analytics(campaign_id, date);

-- Enable Row Level Security
ALTER TABLE promotional_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_ai_content ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Campaigns: Admins can do everything, users can view active campaigns
CREATE POLICY "Admins can manage campaigns" ON promotional_campaigns
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Users can view active campaigns" ON promotional_campaigns
    FOR SELECT USING (status = 'active' AND NOW() BETWEEN start_date AND end_date);

-- Promo codes: Admins can manage, users can view if campaign is active
CREATE POLICY "Admins can manage promo codes" ON promo_codes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Users can check promo codes" ON promo_codes
    FOR SELECT USING (
        is_active = true AND 
        NOW() BETWEEN valid_from AND valid_until AND
        EXISTS (
            SELECT 1 FROM promotional_campaigns 
            WHERE promotional_campaigns.id = promo_codes.campaign_id 
            AND promotional_campaigns.status = 'active'
        )
    );

-- Redemptions: Users can view their own, admins can view all
CREATE POLICY "Users can view own redemptions" ON campaign_redemptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all redemptions" ON campaign_redemptions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Users can redeem campaigns" ON campaign_redemptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Analytics: Admin only
CREATE POLICY "Admins can manage analytics" ON campaign_analytics
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- AI Content: Admin only
CREATE POLICY "Admins can manage AI content" ON campaign_ai_content
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Functions for campaign management

-- Function to validate and redeem a promo code
CREATE OR REPLACE FUNCTION redeem_promo_code(
    p_code VARCHAR(50),
    p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_promo_code promo_codes%ROWTYPE;
    v_campaign promotional_campaigns%ROWTYPE;
    v_user_redemptions INTEGER;
    v_redemption_id UUID;
BEGIN
    -- Get promo code
    SELECT * INTO v_promo_code
    FROM promo_codes
    WHERE code = p_code AND is_active = true
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'Invalid or inactive promo code');
    END IF;
    
    -- Check validity period
    IF NOW() < v_promo_code.valid_from OR NOW() > v_promo_code.valid_until THEN
        RETURN json_build_object('success', false, 'error', 'Promo code expired or not yet valid');
    END IF;
    
    -- Check max uses
    IF v_promo_code.max_uses IS NOT NULL AND v_promo_code.current_uses >= v_promo_code.max_uses THEN
        RETURN json_build_object('success', false, 'error', 'Promo code usage limit reached');
    END IF;
    
    -- Check per-user limit
    SELECT COUNT(*) INTO v_user_redemptions
    FROM campaign_redemptions
    WHERE promo_code_id = v_promo_code.id AND user_id = p_user_id;
    
    IF v_promo_code.max_uses_per_user IS NOT NULL AND v_user_redemptions >= v_promo_code.max_uses_per_user THEN
        RETURN json_build_object('success', false, 'error', 'You have already used this promo code');
    END IF;
    
    -- Get campaign
    SELECT * INTO v_campaign
    FROM promotional_campaigns
    WHERE id = v_promo_code.campaign_id
    FOR UPDATE;
    
    IF v_campaign.status != 'active' THEN
        RETURN json_build_object('success', false, 'error', 'Campaign is not active');
    END IF;
    
    -- Check campaign redemption limit
    IF v_campaign.max_redemptions IS NOT NULL AND v_campaign.current_redemptions >= v_campaign.max_redemptions THEN
        RETURN json_build_object('success', false, 'error', 'Campaign usage limit reached');
    END IF;
    
    -- Create redemption record
    INSERT INTO campaign_redemptions (
        campaign_id, promo_code_id, user_id, benefit_type, benefit_value, expires_at
    ) VALUES (
        v_campaign.id,
        v_promo_code.id,
        p_user_id,
        v_campaign.campaign_type,
        json_build_object(
            'discount_percentage', v_campaign.discount_percentage,
            'discount_amount', v_campaign.discount_amount,
            'free_credits', v_campaign.free_credits,
            'trial_days', v_campaign.trial_days
        ),
        CASE 
            WHEN v_campaign.trial_days IS NOT NULL THEN NOW() + (v_campaign.trial_days || ' days')::INTERVAL
            WHEN v_campaign.end_date IS NOT NULL THEN v_campaign.end_date
            ELSE NULL
        END
    ) RETURNING id INTO v_redemption_id;
    
    -- Update counters
    UPDATE promo_codes SET current_uses = current_uses + 1 WHERE id = v_promo_code.id;
    UPDATE promotional_campaigns SET current_redemptions = current_redemptions + 1 WHERE id = v_campaign.id;
    
    -- Return success with benefit details
    RETURN json_build_object(
        'success', true,
        'redemption_id', v_redemption_id,
        'campaign', json_build_object(
            'name', v_campaign.name,
            'type', v_campaign.campaign_type,
            'discount_percentage', v_campaign.discount_percentage,
            'discount_amount', v_campaign.discount_amount,
            'free_credits', v_campaign.free_credits,
            'trial_days', v_campaign.trial_days
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has active campaign benefits
CREATE OR REPLACE FUNCTION get_user_active_benefits(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_benefits JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'id', cr.id,
            'campaign_name', pc.name,
            'benefit_type', cr.benefit_type,
            'benefit_value', cr.benefit_value,
            'expires_at', cr.expires_at,
            'status', cr.status
        )
    ) INTO v_benefits
    FROM campaign_redemptions cr
    JOIN promotional_campaigns pc ON pc.id = cr.campaign_id
    WHERE cr.user_id = p_user_id
        AND cr.status = 'active'
        AND (cr.expires_at IS NULL OR cr.expires_at > NOW());
    
    RETURN COALESCE(v_benefits, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update campaign analytics
CREATE OR REPLACE FUNCTION update_campaign_analytics()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO campaign_analytics (campaign_id, date, redemptions, new_users)
    VALUES (
        NEW.campaign_id,
        CURRENT_DATE,
        1,
        CASE WHEN EXISTS (
            SELECT 1 FROM profiles WHERE id = NEW.user_id AND created_at::DATE = CURRENT_DATE
        ) THEN 1 ELSE 0 END
    )
    ON CONFLICT (campaign_id, date) 
    DO UPDATE SET 
        redemptions = campaign_analytics.redemptions + 1,
        new_users = campaign_analytics.new_users + EXCLUDED.new_users;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER campaign_redemption_analytics
    AFTER INSERT ON campaign_redemptions
    FOR EACH ROW
    EXECUTE FUNCTION update_campaign_analytics();

-- Insert some default campaign templates for admins
INSERT INTO promotional_campaigns (
    name, 
    description, 
    campaign_type, 
    status,
    max_redemptions,
    free_credits,
    target_user_segment,
    requires_code,
    banner_text,
    cta_button_text
) VALUES (
    'First 100 Users Special',
    'Welcome promotion for the first 100 users to join our platform',
    'free_credits',
    'draft',
    100,
    10,
    'first_100',
    false,
    '🎉 Be one of the first 100 users and get 10 free investigation credits!',
    'Claim Your Free Credits'
) ON CONFLICT DO NOTHING;
