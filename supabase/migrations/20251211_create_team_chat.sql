-- Create case_team_messages table for internal team communication
CREATE TABLE IF NOT EXISTS public.case_team_messages (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id uuid NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message text NOT NULL,
    is_system_message boolean DEFAULT false,
    attachments jsonb DEFAULT '[]'::jsonb,
    read_by jsonb DEFAULT '[]'::jsonb, -- Array of user IDs who read the message
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.case_team_messages IS 'Internal chat messages between team members working on a case';

-- Create indexes
CREATE INDEX idx_team_messages_case ON public.case_team_messages(case_id, created_at DESC);
CREATE INDEX idx_team_messages_sender ON public.case_team_messages(sender_id);

-- Enable RLS
ALTER TABLE public.case_team_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Team members can view team messages" ON public.case_team_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.case_team_members ctm
      WHERE ctm.case_id = case_team_messages.case_id
      AND ctm.investigator_id = auth.uid()
      AND ctm.status = 'active'
    )
  );

CREATE POLICY "Team members can send messages" ON public.case_team_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.case_team_members ctm
      WHERE ctm.case_id = case_team_messages.case_id
      AND ctm.investigator_id = auth.uid()
      AND ctm.status = 'active'
    )
    AND sender_id = auth.uid()
  );

CREATE POLICY "Sender can update own messages" ON public.case_team_messages
  FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY "Sender can delete own messages" ON public.case_team_messages
  FOR DELETE USING (sender_id = auth.uid());

-- Function to get unread message count
CREATE OR REPLACE FUNCTION get_unread_team_message_count(p_case_id UUID, p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM case_team_messages
        WHERE case_id = p_case_id
        AND sender_id != p_user_id
        AND NOT (read_by @> jsonb_build_array(p_user_id::text))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark messages as read
CREATE OR REPLACE FUNCTION mark_team_messages_read(p_case_id UUID, p_user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE case_team_messages
    SET read_by = CASE 
        WHEN read_by @> jsonb_build_array(p_user_id::text) 
        THEN read_by
        ELSE read_by || jsonb_build_array(p_user_id::text)
    END,
    updated_at = timezone('utc', now())
    WHERE case_id = p_case_id
    AND sender_id != p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_unread_team_message_count IS 'Returns count of unread team messages for a user in a case';
COMMENT ON FUNCTION mark_team_messages_read IS 'Marks all team messages in a case as read by a user';
