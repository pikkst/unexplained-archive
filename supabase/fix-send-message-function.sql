-- ========================================
-- FIX SEND_MESSAGE FUNCTION
-- Parandab sõnumite saatmise funktsiooni
-- ========================================

-- 1. Lisa attachment_url veerg kui puudub
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- 2. Eemalda vanad funktsioonid
DROP FUNCTION IF EXISTS send_message(UUID, UUID, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS send_message(UUID, UUID, UUID, TEXT, TEXT);

-- 3. Loo õige send_message funktsioon
-- Parameetrid: p_case_id (VALIKULINE!), p_sender_id, p_recipient_id, p_content, p_attachment_url
-- Töötab nii case-põhiste kui ka direktsõnumitega
CREATE OR REPLACE FUNCTION send_message(
    p_case_id UUID DEFAULT NULL,
    p_sender_id UUID DEFAULT NULL,
    p_recipient_id UUID DEFAULT NULL,
    p_content TEXT DEFAULT NULL,
    p_attachment_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_message_id UUID;
    v_sender_name TEXT;
    v_case_title TEXT;
    v_sender_id_actual UUID;
BEGIN
    -- Kui sender_id on NULL, kasuta auth.uid()
    v_sender_id_actual := COALESCE(p_sender_id, auth.uid());
    
    -- Kontrolli et on olemas recipient ja content
    IF p_recipient_id IS NULL OR p_content IS NULL OR v_sender_id_actual IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Missing required parameters');
    END IF;
    
    -- Kui on case_id, kontrolli õigusi
    IF p_case_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM cases 
            WHERE id = p_case_id 
            AND (submitted_by = v_sender_id_actual OR assigned_investigator_id = v_sender_id_actual)
        ) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Not authorized to message on this case');
        END IF;
    END IF;
    
    -- Sisesta sõnum
    INSERT INTO messages (case_id, sender_id, recipient_id, content, attachment_url)
    VALUES (p_case_id, v_sender_id_actual, p_recipient_id, p_content, p_attachment_url)
    RETURNING id INTO v_message_id;
    
    -- Hangi saatja nimi ja case pealkiri teavituse jaoks
    SELECT username INTO v_sender_name FROM profiles WHERE id = v_sender_id_actual;
    IF p_case_id IS NOT NULL THEN
        SELECT title INTO v_case_title FROM cases WHERE id = p_case_id;
    END IF;
    
    -- Loo teavitus saajale
    IF p_case_id IS NOT NULL THEN
        -- Case'iga seotud sõnum
        INSERT INTO notifications (user_id, case_id, type, title, message, action_url)
        VALUES (
            p_recipient_id,
            p_case_id,
            'new_message',
            'Uus sõnum kasutajalt ' || COALESCE(v_sender_name, 'Tundmatu kasutaja'),
            'Sul on uus sõnum juhtumi kohta: ' || COALESCE(v_case_title, 'Pealkirjata'),
            '/cases/' || p_case_id
        );
    ELSE
        -- Direktsõnum (ilma case'ita)
        INSERT INTO notifications (user_id, type, title, message, action_url)
        VALUES (
            p_recipient_id,
            'new_message',
            'Uus privaatsõnum',
            COALESCE(v_sender_name, 'Keegi') || ' saatis sulle sõnumi',
            '/messages'
        );
    END IF;
    
    RETURN jsonb_build_object(
        'success', true, 
        'message_id', v_message_id
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false, 
            'error', SQLERRM
        );
END;
$$;

-- 4. Loo mark_message_read funktsioon
CREATE OR REPLACE FUNCTION mark_message_read(
    p_message_id UUID,
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Uuenda sõnum kui kasutaja on saaja
    UPDATE messages
    SET read_at = NOW()
    WHERE id = p_message_id
    AND recipient_id = p_user_id
    AND read_at IS NULL;
    
    IF FOUND THEN
        RETURN jsonb_build_object('success', true);
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Message not found or already read');
    END IF;
END;
$$;

-- 5. Loo get_case_messages funktsioon
CREATE OR REPLACE FUNCTION get_case_messages(
    p_case_id UUID,
    p_user_id UUID
)
RETURNS TABLE (
    id UUID,
    case_id UUID,
    sender_id UUID,
    recipient_id UUID,
    content TEXT,
    attachment_url TEXT,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.case_id,
        m.sender_id,
        m.recipient_id,
        m.content,
        m.attachment_url,
        m.read_at,
        m.created_at
    FROM messages m
    WHERE m.case_id = p_case_id
    AND (m.sender_id = p_user_id OR m.recipient_id = p_user_id)
    ORDER BY m.created_at DESC;
END;
$$;

-- 6. Anna õigused
GRANT EXECUTE ON FUNCTION send_message(UUID, UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_message_read(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_case_messages(UUID, UUID) TO authenticated;

-- 7. Lisa kommentaarid
COMMENT ON FUNCTION send_message IS 'Saada privaatsõnum juhtumi osalejate vahel (esitaja ↔ uurija)';
COMMENT ON FUNCTION mark_message_read IS 'Märgi sõnum loetuks';
COMMENT ON FUNCTION get_case_messages IS 'Hangi case''iga seotud sõnumid';

-- 8. Kontrolli et RLS on lubatud
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 9. Lisa/uuenda RLS poliitikad kui vaja
DROP POLICY IF EXISTS "Users can view their messages" ON messages;
CREATE POLICY "Users can view their messages" ON messages
    FOR SELECT
    USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages" ON messages
    FOR INSERT
    WITH CHECK (auth.uid() = sender_id);
