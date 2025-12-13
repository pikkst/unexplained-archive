-- Fix RLS policies for subscriptions table
-- Ensure Edge Functions can insert and users can read their own subscriptions

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Service role full access subscriptions" ON subscriptions;

-- Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Service role (Edge Functions) has full access
CREATE POLICY "Service role full access subscriptions" ON subscriptions
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');
