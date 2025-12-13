-- Translation Feature Database Setup
-- Run this in Supabase SQL Editor to ensure all tables exist for translation tracking

-- 1. Ensure ai_usage table exists for tracking translations
CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add index for faster queries by user
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_id ON ai_usage(user_id);

-- 3. Add index for feature type queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON ai_usage(feature);

-- 4. Add index for date-based analytics
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage(created_at DESC);

-- 5. Enable Row Level Security
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policy: Users can view their own usage
CREATE POLICY "Users can view own translation usage"
  ON ai_usage
  FOR SELECT
  USING (auth.uid() = user_id);

-- 7. RLS Policy: Users can insert their own usage records
CREATE POLICY "Users can insert own translation usage"
  ON ai_usage
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 8. RLS Policy: Admins can view all usage
CREATE POLICY "Admins can view all translation usage"
  ON ai_usage
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- 9. Create function to check translation permissions
CREATE OR REPLACE FUNCTION can_use_translation(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    -- Check if user is admin
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = check_user_id
      AND role = 'admin'
    )
    OR
    -- Check if user is investigator with active subscription
    EXISTS (
      SELECT 1 FROM profiles p
      INNER JOIN subscriptions s ON s.user_id = p.id
      WHERE p.id = check_user_id
      AND p.role = 'investigator'
      AND s.status = 'active'
      AND (s.end_date IS NULL OR s.end_date > NOW())
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create view for translation analytics (admin only)
CREATE OR REPLACE VIEW translation_analytics AS
SELECT
  DATE(created_at) as date,
  feature,
  COUNT(*) as translation_count,
  COUNT(DISTINCT user_id) as unique_users
FROM ai_usage
WHERE feature IN ('case_translation', 'comment_translation', 'ai_image_translation')
GROUP BY DATE(created_at), feature
ORDER BY date DESC, translation_count DESC;

-- 11. Grant permissions on view
GRANT SELECT ON translation_analytics TO authenticated;

-- 12. Create function to get user's translation usage count (last 30 days)
CREATE OR REPLACE FUNCTION get_user_translation_count(check_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM ai_usage
    WHERE user_id = check_user_id
    AND feature LIKE '%translation%'
    AND created_at > NOW() - INTERVAL '30 days'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Add comment to document the feature column values
COMMENT ON COLUMN ai_usage.feature IS 'Translation feature types: case_translation, comment_translation, ai_image_translation, ai_report_generation';

-- 14. Add metadata examples comment
COMMENT ON COLUMN ai_usage.metadata IS 'JSON metadata: {"source_lang": "et", "target_lang": "en", "text_length": 250, "case_id": "uuid"}';

-- Verification queries (run these to check setup):
-- SELECT * FROM ai_usage LIMIT 10;
-- SELECT * FROM translation_analytics WHERE date > CURRENT_DATE - INTERVAL '7 days';
-- SELECT can_use_translation(auth.uid());
-- SELECT get_user_translation_count(auth.uid());

NOTIFY pgrst, 'reload schema';
