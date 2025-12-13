-- ========================================
-- MASS NOTIFICATION AND WELCOME MESSAGE SYSTEM
-- Admin functionality for sending bulk notifications
-- ========================================

-- Function to send mass notifications to specific user groups
CREATE OR REPLACE FUNCTION send_mass_notification(
    p_admin_id UUID,
    p_recipient_groups TEXT[],
    p_title TEXT,
    p_message TEXT,
    p_action_url TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_recipient_ids UUID[];
    v_recipient_id UUID;
    v_sent_count INTEGER := 0;
    v_is_admin BOOLEAN;
BEGIN
    -- Verify admin privileges
    SELECT role = 'admin' INTO v_is_admin
    FROM profiles
    WHERE id = p_admin_id;
    
    IF NOT v_is_admin THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Unauthorized: Admin privileges required',
            'sent_count', 0
        );
    END IF;

    -- Build recipient list based on selected groups
    IF 'all_users' = ANY(p_recipient_groups) THEN
        -- Send to all users
        SELECT ARRAY_AGG(DISTINCT id) INTO v_recipient_ids
        FROM profiles;
    ELSE
        -- Build list based on specific groups
        WITH recipient_list AS (
            -- Investigators
            SELECT id FROM profiles 
            WHERE 'investigators' = ANY(p_recipient_groups) AND role = 'investigator'
            
            UNION
            
            -- Free tier users (users without active subscription)
            SELECT p.id FROM profiles p
            WHERE 'free_tier' = ANY(p_recipient_groups)
            AND NOT EXISTS (
                SELECT 1 FROM subscriptions s 
                WHERE s.user_id = p.id 
                AND s.status = 'active'
            )
            
            UNION
            
            -- Pro tier users (investigator_basic or investigator_pro)
            SELECT DISTINCT p.id FROM profiles p
            JOIN subscriptions s ON s.user_id = p.id
            WHERE 'pro_tier' = ANY(p_recipient_groups)
            AND s.status = 'active'
            AND s.plan_type IN ('investigator_basic', 'investigator_pro')
            
            UNION
            
            -- Premium tier users (user_premium)
            SELECT DISTINCT p.id FROM profiles p
            JOIN subscriptions s ON s.user_id = p.id
            WHERE 'premium_tier' = ANY(p_recipient_groups)
            AND s.status = 'active'
            AND s.plan_type = 'user_premium'
        )
        SELECT ARRAY_AGG(DISTINCT id) INTO v_recipient_ids FROM recipient_list;
    END IF;

    -- Send notification to each recipient
    IF v_recipient_ids IS NOT NULL THEN
        FOREACH v_recipient_id IN ARRAY v_recipient_ids
        LOOP
            INSERT INTO notifications (user_id, type, title, message, action_url)
            VALUES (v_recipient_id, 'case_update', p_title, p_message, p_action_url);
            
            v_sent_count := v_sent_count + 1;
        END LOOP;
    END IF;

    RETURN json_build_object(
        'success', true,
        'sent_count', v_sent_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- WELCOME MESSAGE FOR NEW USERS
-- Automatically send welcome notification when user signs up
-- ========================================

-- Function to send welcome message to new user
CREATE OR REPLACE FUNCTION send_welcome_notification(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        action_url
    )
    VALUES (
        p_user_id,
        'case_follow_confirm',
        'Welcome to Unexplained Archive!',
        'Welcome to Unexplained Archive - your gateway to investigating the world''s most mysterious phenomena! 

Here''s what you can do on our platform:

🔍 EXPLORE MYSTERIES: Browse thousands of unexplained cases from UFO sightings to cryptid encounters, paranormal activities, and unsolved mysteries.

💼 BECOME AN INVESTIGATOR: Apply to become a verified investigator and earn rewards by researching and solving cases submitted by the community.

🗺️ INTERACTIVE MAP: Explore cases geographically on our interactive world map and discover patterns in mysterious phenomena.

💬 COMMUNITY FORUM: Discuss theories, share insights, and collaborate with other truth-seekers in our vibrant community.

🏆 LEADERBOARD: Compete for the top spot by contributing quality research and solving cases.

💰 CASE REWARDS: Submit cases with bounties or work on existing cases to earn rewards through our secure escrow system.

🎯 AI-POWERED TOOLS: Use advanced AI analysis tools to examine evidence, generate theories, and uncover hidden patterns.

💎 PREMIUM FEATURES: Upgrade to Pro or Premium for unlimited AI credits, priority case access, and exclusive investigator tools.

Get started by exploring our case library or submitting your own mysterious encounter. The truth is out there - let''s find it together!',
        NULL  -- No redirect, user stays in inbox to read the message
    );
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically send welcome message when new user is created
CREATE OR REPLACE FUNCTION trigger_welcome_notification()
RETURNS TRIGGER AS $$
BEGIN
    -- Send welcome notification (async, don't fail if it errors)
    PERFORM send_welcome_notification(NEW.id);
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the user creation
    RAISE WARNING 'Failed to send welcome notification to user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_user_created_welcome ON profiles;

-- Create trigger for new user welcome messages
CREATE TRIGGER on_user_created_welcome
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION trigger_welcome_notification();

-- ========================================
-- HELPER: Send notification to specific user (for other features)
-- ========================================

CREATE OR REPLACE FUNCTION send_user_notification(
    p_user_id UUID,
    p_title TEXT,
    p_message TEXT,
    p_type TEXT DEFAULT 'case_update',
    p_action_url TEXT DEFAULT NULL,
    p_case_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO notifications (user_id, case_id, type, title, message, action_url)
    VALUES (p_user_id, p_case_id, p_type, p_title, p_message, p_action_url);
    
    RETURN true;
EXCEPTION WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION send_mass_notification TO authenticated;
GRANT EXECUTE ON FUNCTION send_welcome_notification TO authenticated;
GRANT EXECUTE ON FUNCTION send_user_notification TO authenticated;
