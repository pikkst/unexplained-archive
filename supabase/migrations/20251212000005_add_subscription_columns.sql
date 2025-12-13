-- Add missing columns to subscriptions table for investigator subscription system

-- Drop old check constraint
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_type_check;

-- Add new check constraint with updated plan types
ALTER TABLE subscriptions 
ADD CONSTRAINT subscriptions_plan_type_check 
CHECK (plan_type IN ('investigator_pro', 'user_premium', 'basic', 'premium', 'pro'));

-- Add missing columns
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly', 'onetime')),
ADD COLUMN IF NOT EXISTS price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}';

COMMENT ON COLUMN subscriptions.billing_cycle IS 'Subscription billing cycle: monthly, yearly, or onetime';
COMMENT ON COLUMN subscriptions.price IS 'Price paid for this subscription period';
COMMENT ON COLUMN subscriptions.features IS 'JSON object containing subscription features';

-- Fix RLS policies - drop all existing and recreate properly
DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Service role full access subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users view own subscriptions" ON subscriptions;

-- Users can only SELECT their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON subscriptions
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Service role (Edge Functions with service_role key) has FULL access
CREATE POLICY "Service role full access subscriptions" ON subscriptions
  USING (auth.jwt()->>'role' = 'service_role');
