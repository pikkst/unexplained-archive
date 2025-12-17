-- Fix RLS policies for promotional campaigns to allow public access
-- This allows anonymous (not logged in) users to see active campaigns

-- Drop existing policy and recreate with public access
DROP POLICY IF EXISTS "Users can view active campaigns" ON promotional_campaigns;

-- Allow EVERYONE (including anonymous) to view active campaigns
CREATE POLICY "Public can view active campaigns" ON promotional_campaigns
    FOR SELECT USING (
        status = 'active' 
        AND start_date <= NOW() 
        AND (end_date IS NULL OR end_date >= NOW())
    );

-- Also allow anonymous users to check promo codes
DROP POLICY IF EXISTS "Users can check promo codes" ON promo_codes;

CREATE POLICY "Public can check promo codes" ON promo_codes
    FOR SELECT USING (
        is_active = true AND 
        valid_from <= NOW() AND 
        valid_until >= NOW() AND
        EXISTS (
            SELECT 1 FROM promotional_campaigns 
            WHERE promotional_campaigns.id = promo_codes.campaign_id 
            AND promotional_campaigns.status = 'active'
        )
    );

-- Allow authenticated users to redeem campaigns
CREATE POLICY "Authenticated users can redeem campaigns" ON campaign_redemptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Comment for clarity
COMMENT ON POLICY "Public can view active campaigns" ON promotional_campaigns IS 
'Allows anonymous users to see active promotional campaigns on landing page';
