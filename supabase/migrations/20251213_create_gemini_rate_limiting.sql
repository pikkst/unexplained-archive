-- Create table for tracking Gemini API calls (rate limiting)
CREATE TABLE IF NOT EXISTS gemini_api_calls (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT,
  date DATE NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_gemini_calls_user_date ON gemini_api_calls(user_id, date);

-- RLS Policies
ALTER TABLE gemini_api_calls ENABLE ROW LEVEL SECURITY;

-- Users can only see their own calls
CREATE POLICY "Users can view own API calls"
  ON gemini_api_calls FOR SELECT
  USING (auth.uid() = user_id);

-- System can insert calls (from edge function)
CREATE POLICY "Service role can insert API calls"
  ON gemini_api_calls FOR INSERT
  WITH CHECK (true);

-- Create a view for easier rate limit checking
CREATE OR REPLACE VIEW gemini_daily_usage AS
SELECT 
  user_id,
  date,
  COUNT(*) as call_count
FROM gemini_api_calls
GROUP BY user_id, date;
