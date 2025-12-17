-- Additional SQL functions for campaign tracking

-- Function to track campaign impressions
CREATE OR REPLACE FUNCTION track_campaign_impression(p_campaign_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO campaign_analytics (campaign_id, date, impressions)
    VALUES (p_campaign_id, CURRENT_DATE, 1)
    ON CONFLICT (campaign_id, date)
    DO UPDATE SET impressions = campaign_analytics.impressions + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track campaign clicks
CREATE OR REPLACE FUNCTION track_campaign_click(p_campaign_id UUID)
RETURNS void AS $$
BEGIN
    INSERT INTO campaign_analytics (campaign_id, date, clicks)
    VALUES (p_campaign_id, CURRENT_DATE, 1)
    ON CONFLICT (campaign_id, date)
    DO UPDATE SET clicks = campaign_analytics.clicks + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track campaign conversions (when user makes purchase)
CREATE OR REPLACE FUNCTION track_campaign_conversion(
    p_campaign_id UUID,
    p_revenue DECIMAL(10,2),
    p_discount DECIMAL(10,2)
)
RETURNS void AS $$
BEGIN
    INSERT INTO campaign_analytics (campaign_id, date, conversions, revenue_generated, discount_given)
    VALUES (p_campaign_id, CURRENT_DATE, 1, p_revenue, p_discount)
    ON CONFLICT (campaign_id, date)
    DO UPDATE SET 
        conversions = campaign_analytics.conversions + 1,
        revenue_generated = campaign_analytics.revenue_generated + p_revenue,
        discount_given = campaign_analytics.discount_given + p_discount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get campaign dashboard stats
CREATE OR REPLACE FUNCTION get_campaign_dashboard_stats()
RETURNS JSON AS $$
DECLARE
    v_stats JSON;
BEGIN
    SELECT json_build_object(
        'total_campaigns', (SELECT COUNT(*) FROM promotional_campaigns),
        'active_campaigns', (SELECT COUNT(*) FROM promotional_campaigns WHERE status = 'active'),
        'total_redemptions', (SELECT COUNT(*) FROM campaign_redemptions),
        'total_revenue', (SELECT COALESCE(SUM(revenue_generated), 0) FROM campaign_analytics),
        'total_discount_given', (SELECT COALESCE(SUM(discount_given), 0) FROM campaign_analytics),
        'average_conversion_rate', (
            SELECT CASE 
                WHEN SUM(clicks) > 0 
                THEN (SUM(conversions)::FLOAT / SUM(clicks)::FLOAT * 100)
                ELSE 0 
            END
            FROM campaign_analytics
        ),
        'top_campaigns', (
            SELECT json_agg(row_to_json(t))
            FROM (
                SELECT 
                    pc.name,
                    pc.campaign_type,
                    SUM(ca.redemptions) as total_redemptions,
                    SUM(ca.conversions) as total_conversions,
                    SUM(ca.revenue_generated) as total_revenue
                FROM promotional_campaigns pc
                LEFT JOIN campaign_analytics ca ON ca.campaign_id = pc.id
                GROUP BY pc.id, pc.name, pc.campaign_type
                ORDER BY total_redemptions DESC
                LIMIT 5
            ) t
        )
    ) INTO v_stats;
    
    RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION track_campaign_impression TO authenticated;
GRANT EXECUTE ON FUNCTION track_campaign_click TO authenticated;
GRANT EXECUTE ON FUNCTION track_campaign_conversion TO authenticated;
GRANT EXECUTE ON FUNCTION get_campaign_dashboard_stats TO authenticated;
