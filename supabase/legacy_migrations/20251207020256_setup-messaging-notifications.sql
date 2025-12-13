-- ========================================
-- MESSAGING & NOTIFICATION SYSTEM
-- Privaatne sõnumisüsteem ja juhtumi jälgimine
-- ========================================

-- 1. PRIVATE MESSAGES (Privaatne sõnumivahetus)
-- Uurija ↔ Kasutaja suhtlus juhtumi kohta
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    attachment_url TEXT,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes for performance
    CONSTRAINT messages_different_users CHECK (sender_id != recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_messages_case ON messages(case_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id, read_at);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

-- 2. NOTIFICATIONS (Platvormi teatised)
-- Kasutajate teavitamine juhtumi uuendustest
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'case_update', 'new_message', 'dispute_created', 'resolution_submitted', 'vote_started', 'escrow_released'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    action_url TEXT, -- Link to case or message
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- For guest notifications (email-only, no user_id)
    guest_email TEXT,
    
    CONSTRAINT notification_has_recipient CHECK (
        (user_id IS NOT NULL) OR (guest_email IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_guest_email ON notifications(guest_email);

-- 3. CASE FOLLOWERS (Juhtumi jälgijad)
-- Kasutajad ja külalised saavad juhtumit "jälgida"
CREATE TABLE IF NOT EXISTS case_followers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    guest_email TEXT,
    notify_on_update BOOLEAN DEFAULT TRUE,
    notify_on_comments BOOLEAN DEFAULT TRUE,
    notify_on_resolution BOOLEAN DEFAULT TRUE,
    followed_at TIMESTAMP DEFAULT NOW(),
    
    -- Either authenticated user OR guest email
    CONSTRAINT follower_has_identity CHECK (
        (user_id IS NOT NULL) OR (guest_email IS NOT NULL)
    ),
    
    -- Prevent duplicate follows
    CONSTRAINT unique_case_follower UNIQUE(case_id, user_id, guest_email)
);

CREATE INDEX IF NOT EXISTS idx_followers_case ON case_followers(case_id);
CREATE INDEX IF NOT EXISTS idx_followers_user ON case_followers(user_id);
CREATE INDEX IF NOT EXISTS idx_followers_email ON case_followers(guest_email);

-- ========================================
-- FUNCTIONS FOR MESSAGING
-- ========================================

-- Send a private message
CREATE OR REPLACE FUNCTION send_message(
    p_case_id UUID,
    p_sender_id UUID,
    p_recipient_id UUID,
    p_content TEXT,
    p_attachment_url TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_message_id UUID;
    v_sender_name TEXT;
    v_case_title TEXT;
BEGIN
    -- Validate case exists and sender is involved (submitter OR investigator)
    IF NOT EXISTS (
        SELECT 1 FROM cases 
        WHERE id = p_case_id 
        AND (submitted_by = p_sender_id OR assigned_investigator_id = p_sender_id)
    ) THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized to message on this case');
    END IF;
    
    -- Insert message
    INSERT INTO messages (case_id, sender_id, recipient_id, content, attachment_url)
    VALUES (p_case_id, p_sender_id, p_recipient_id, p_content, p_attachment_url)
    RETURNING id INTO v_message_id;
    
    -- Get sender name and case title for notification
    SELECT username INTO v_sender_name FROM profiles WHERE id = p_sender_id;
    SELECT title INTO v_case_title FROM cases WHERE id = p_case_id;
    
    -- Create notification for recipient
    INSERT INTO notifications (user_id, case_id, type, title, message, action_url)
    VALUES (
        p_recipient_id,
        p_case_id,
        'new_message',
        'New Message from ' || v_sender_name,
        'You have a new message about case: ' || v_case_title,
        '/case/' || p_case_id || '/messages'
    );
    
    RETURN json_build_object(
        'success', true,
        'message_id', v_message_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark message as read
CREATE OR REPLACE FUNCTION mark_message_read(p_message_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE messages 
    SET read_at = NOW() 
    WHERE id = p_message_id 
    AND recipient_id = p_user_id 
    AND read_at IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get conversation for a case
CREATE OR REPLACE FUNCTION get_case_messages(
    p_case_id UUID,
    p_user_id UUID
)
RETURNS TABLE (
    message_id UUID,
    sender_id UUID,
    sender_name TEXT,
    recipient_id UUID,
    content TEXT,
    attachment_url TEXT,
    read_at TIMESTAMP,
    created_at TIMESTAMP
) AS $$
BEGIN
    -- Validate user is involved in case
    IF NOT EXISTS (
        SELECT 1 FROM cases 
        WHERE id = p_case_id 
        AND (submitted_by = p_user_id OR assigned_investigator_id = p_user_id)
    ) THEN
        RAISE EXCEPTION 'Not authorized to view messages for this case';
    END IF;
    
    RETURN QUERY
    SELECT 
        m.id,
        m.sender_id,
        p.username,
        m.recipient_id,
        m.content,
        m.attachment_url,
        m.read_at,
        m.created_at
    FROM messages m
    JOIN profiles p ON m.sender_id = p.id
    WHERE m.case_id = p_case_id
    ORDER BY m.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- FUNCTIONS FOR NOTIFICATIONS
-- ========================================

-- Create notification (internal helper)
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_case_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_action_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO notifications (user_id, case_id, type, title, message, action_url)
    VALUES (p_user_id, p_case_id, p_type, p_title, p_message, p_action_url)
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

-- Mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE notifications 
    SET read_at = NOW() 
    WHERE id = p_notification_id 
    AND user_id = p_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE notifications 
    SET read_at = NOW() 
    WHERE user_id = p_user_id 
    AND read_at IS NULL;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- FUNCTIONS FOR CASE FOLLOWING
-- ========================================

-- Follow a case (authenticated user)
CREATE OR REPLACE FUNCTION follow_case(
    p_case_id UUID,
    p_user_id UUID
)
RETURNS JSON AS $$
BEGIN
    -- Check if already following
    IF EXISTS (
        SELECT 1 FROM case_followers 
        WHERE case_id = p_case_id AND user_id = p_user_id
    ) THEN
        RETURN json_build_object('success', false, 'error', 'Already following this case');
    END IF;
    
    INSERT INTO case_followers (case_id, user_id)
    VALUES (p_case_id, p_user_id);
    
    RETURN json_build_object('success', true, 'message', 'Now following case');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Follow a case (guest via email)
CREATE OR REPLACE FUNCTION follow_case_guest(
    p_case_id UUID,
    p_guest_email TEXT
)
RETURNS JSON AS $$
BEGIN
    -- Validate email format
    IF p_guest_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RETURN json_build_object('success', false, 'error', 'Invalid email address');
    END IF;
    
    -- Check if already following
    IF EXISTS (
        SELECT 1 FROM case_followers 
        WHERE case_id = p_case_id AND guest_email = p_guest_email
    ) THEN
        RETURN json_build_object('success', false, 'error', 'Already following this case');
    END IF;
    
    INSERT INTO case_followers (case_id, guest_email)
    VALUES (p_case_id, p_guest_email);
    
    -- Send confirmation email (to be handled by Edge Function)
    INSERT INTO notifications (guest_email, case_id, type, title, message, action_url)
    VALUES (
        p_guest_email,
        p_case_id,
        'case_follow_confirm',
        'You are now following a case',
        'You will receive email updates about this case. Click to unsubscribe.',
        '/case/' || p_case_id || '/unfollow?email=' || p_guest_email
    );
    
    RETURN json_build_object('success', true, 'message', 'Confirmation email sent');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Unfollow a case
CREATE OR REPLACE FUNCTION unfollow_case(
    p_case_id UUID,
    p_user_id UUID DEFAULT NULL,
    p_guest_email TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM case_followers 
    WHERE case_id = p_case_id 
    AND (
        (p_user_id IS NOT NULL AND user_id = p_user_id) OR
        (p_guest_email IS NOT NULL AND guest_email = p_guest_email)
    );
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- TRIGGERS FOR AUTO-NOTIFICATIONS
-- ========================================

-- Notify followers when case is updated
CREATE OR REPLACE FUNCTION notify_case_update()
RETURNS TRIGGER AS $$
DECLARE
    v_follower RECORD;
    v_update_type TEXT;
    v_message TEXT;
BEGIN
    -- Determine update type and message based on status change
    IF OLD.status != NEW.status THEN
        v_update_type := 'status_change';
        v_message := 'Status changed from ' || OLD.status || ' to ' || NEW.status;
    ELSE
        v_update_type := 'case_update';
        v_message := 'Case has been updated';
    END IF;
    
    -- Notify all followers
    FOR v_follower IN 
        SELECT user_id, guest_email 
        FROM case_followers 
        WHERE case_id = NEW.id AND notify_on_update = TRUE
    LOOP
        IF v_follower.user_id IS NOT NULL THEN
            -- Authenticated user notification
            INSERT INTO notifications (user_id, case_id, type, title, message, action_url)
            VALUES (
                v_follower.user_id,
                NEW.id,
                v_update_type,
                'Case Update: ' || NEW.title,
                v_message,
                '/case/' || NEW.id
            );
        ELSIF v_follower.guest_email IS NOT NULL THEN
            -- Guest email notification
            INSERT INTO notifications (guest_email, case_id, type, title, message, action_url)
            VALUES (
                v_follower.guest_email,
                NEW.id,
                v_update_type,
                'Case Update: ' || NEW.title,
                v_message,
                '/case/' || NEW.id
            );
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_case_update
AFTER UPDATE ON cases
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION notify_case_update();

-- Notify when new comment is added (if enabled by follower)
CREATE OR REPLACE FUNCTION notify_new_comment()
RETURNS TRIGGER AS $$
DECLARE
    v_follower RECORD;
    v_case_title TEXT;
    v_commenter_name TEXT;
BEGIN
    -- Get case title and commenter name
    SELECT title INTO v_case_title FROM cases WHERE id = NEW.case_id;
    SELECT username INTO v_commenter_name FROM profiles WHERE id = NEW.user_id;
    
    -- Notify followers who want comment notifications
    FOR v_follower IN 
        SELECT user_id, guest_email 
        FROM case_followers 
        WHERE case_id = NEW.case_id 
        AND notify_on_comments = TRUE
        AND user_id != NEW.user_id -- Don't notify yourself
    LOOP
        IF v_follower.user_id IS NOT NULL THEN
            INSERT INTO notifications (user_id, case_id, type, title, message, action_url)
            VALUES (
                v_follower.user_id,
                NEW.case_id,
                'new_comment',
                'New Comment on ' || v_case_title,
                v_commenter_name || ' commented on a case you follow',
                '/case/' || NEW.case_id
            );
        ELSIF v_follower.guest_email IS NOT NULL THEN
            INSERT INTO notifications (guest_email, case_id, type, title, message, action_url)
            VALUES (
                v_follower.guest_email,
                NEW.case_id,
                'new_comment',
                'New Comment on ' || v_case_title,
                v_commenter_name || ' commented on a case you follow',
                '/case/' || NEW.case_id
            );
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_new_comment
AFTER INSERT ON comments
FOR EACH ROW
EXECUTE FUNCTION notify_new_comment();

-- ========================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_followers ENABLE ROW LEVEL SECURITY;

-- Messages: Only sender and recipient can view
CREATE POLICY messages_view_policy ON messages
FOR SELECT USING (
    sender_id = auth.uid() OR recipient_id = auth.uid()
);

CREATE POLICY messages_insert_policy ON messages
FOR INSERT WITH CHECK (
    sender_id = auth.uid()
);

-- Notifications: Only owner can view
CREATE POLICY notifications_view_policy ON notifications
FOR SELECT USING (
    user_id = auth.uid()
);

-- Case followers: Anyone can follow, only owner can delete
CREATE POLICY followers_insert_policy ON case_followers
FOR INSERT WITH CHECK (
    user_id = auth.uid() OR user_id IS NULL
);

CREATE POLICY followers_view_policy ON case_followers
FOR SELECT USING (TRUE); -- Public read for follower counts

CREATE POLICY followers_delete_policy ON case_followers
FOR DELETE USING (
    user_id = auth.uid()
);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(recipient_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read_at) WHERE read_at IS NULL;

-- ========================================
-- COMMENTS
-- ========================================

COMMENT ON TABLE messages IS 'Private messages between case submitter and assigned investigator';
COMMENT ON TABLE notifications IS 'System notifications for users and email notifications for guests';
COMMENT ON TABLE case_followers IS 'Users and guests who follow cases to receive updates';

COMMENT ON FUNCTION send_message IS 'Send private message between case participants (submitter ↔ investigator)';
COMMENT ON FUNCTION follow_case IS 'Authenticated user follows a case for notifications';
COMMENT ON FUNCTION follow_case_guest IS 'Guest follows case via email for notifications';
COMMENT ON FUNCTION notify_case_update IS 'Auto-notify followers when case status changes';
