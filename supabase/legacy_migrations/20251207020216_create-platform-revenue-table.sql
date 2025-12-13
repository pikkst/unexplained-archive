-- Ensure platform_revenue table exists with correct schema
-- This table tracks all platform revenue (no platform wallet needed)

-- Drop view or table if exists
DROP VIEW IF EXISTS platform_revenue CASCADE;
DROP TABLE IF EXISTS platform_revenue CASCADE;

CREATE TABLE platform_revenue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  revenue_type TEXT NOT NULL CHECK (revenue_type IN (
    'platform_fee', 
    'subscription', 
    'featured_case', 
    'ad_revenue', 
    'api_access', 
    'boost_purchase',
    'background_check',
    'premium_service'
  )),
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT DEFAULT 'EUR' NOT NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index for faster queries
CREATE INDEX idx_platform_revenue_type ON platform_revenue(revenue_type);
CREATE INDEX idx_platform_revenue_created ON platform_revenue(created_at);

-- Enable RLS (allow admins to read)
ALTER TABLE platform_revenue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_view_platform_revenue"
  ON platform_revenue FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Verify
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'platform_revenue'
ORDER BY ordinal_position;
