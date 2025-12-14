-- Create user notification preferences table
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Email notifications
  email_case_updates BOOLEAN DEFAULT true,
  email_new_messages BOOLEAN DEFAULT true,
  email_new_comments BOOLEAN DEFAULT true,
  email_mentions BOOLEAN DEFAULT true,
  email_case_assigned BOOLEAN DEFAULT true,
  email_case_resolved BOOLEAN DEFAULT true,
  email_reward_updates BOOLEAN DEFAULT true,
  email_team_invites BOOLEAN DEFAULT true,
  email_weekly_digest BOOLEAN DEFAULT true,
  email_marketing BOOLEAN DEFAULT false,
  
  -- Push notifications (for future implementation)
  push_case_updates BOOLEAN DEFAULT true,
  push_new_messages BOOLEAN DEFAULT true,
  push_new_comments BOOLEAN DEFAULT false,
  push_mentions BOOLEAN DEFAULT true,
  push_case_assigned BOOLEAN DEFAULT true,
  
  -- Notification frequency
  digest_frequency VARCHAR(20) DEFAULT 'weekly', -- 'daily', 'weekly', 'never'
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON user_notification_preferences(user_id);

-- Enable Row Level Security
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own preferences
CREATE POLICY "Users can view own notification preferences"
  ON user_notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert own notification preferences"
  ON user_notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own notification preferences"
  ON user_notification_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own preferences
CREATE POLICY "Users can delete own notification preferences"
  ON user_notification_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_notification_prefs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS notification_prefs_updated_at_trigger ON user_notification_preferences;
CREATE TRIGGER notification_prefs_updated_at_trigger
  BEFORE UPDATE ON user_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_prefs_updated_at();

-- Create function to initialize default preferences for new users
CREATE OR REPLACE FUNCTION initialize_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-initialize preferences for new users
DROP TRIGGER IF EXISTS init_notification_prefs_trigger ON auth.users;
CREATE TRIGGER init_notification_prefs_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_notification_preferences();

COMMENT ON TABLE user_notification_preferences IS 'User preferences for email and push notifications';
