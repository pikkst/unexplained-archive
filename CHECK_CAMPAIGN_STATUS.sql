-- Check existing RLS policies
SELECT 
    schemaname,
    tablename, 
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('promotional_campaigns', 'promo_codes', 'campaign_redemptions')
ORDER BY tablename, policyname;

-- Check if there are any active campaigns
SELECT 
    id,
    name,
    status,
    start_date,
    end_date,
    campaign_type,
    free_credits,
    requires_code,
    current_redemptions,
    max_redemptions
FROM promotional_campaigns
WHERE status = 'active';

-- Test the SELECT permission as anonymous user
SELECT * FROM promotional_campaigns 
WHERE status = 'active' 
  AND start_date <= NOW() 
  AND (end_date IS NULL OR end_date >= NOW())
LIMIT 1;
