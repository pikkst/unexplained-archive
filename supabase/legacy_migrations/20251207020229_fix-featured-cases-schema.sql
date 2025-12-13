-- Fix featured_cases table schema to match the expected columns
-- This migrates from the old schema to the new schema expected by purchase_case_boost

-- First, check if we need to migrate or create fresh
DO $$
BEGIN
  -- Check if the table exists and has old schema
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'featured_cases' 
    AND column_name = 'payment_amount'
  ) THEN
    -- Old schema exists, need to migrate
    
    -- Add missing columns if they don't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'featured_cases' AND column_name = 'price_paid'
    ) THEN
      ALTER TABLE featured_cases ADD COLUMN price_paid DECIMAL(10,2);
      -- Copy data from old column
      UPDATE featured_cases SET price_paid = payment_amount WHERE payment_amount IS NOT NULL;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'featured_cases' AND column_name = 'boost_type'
    ) THEN
      ALTER TABLE featured_cases ADD COLUMN boost_type TEXT;
      -- Set default based on boost_level
      UPDATE featured_cases 
      SET boost_type = CASE 
        WHEN boost_level = 1 THEN 'basic_24h'
        WHEN boost_level = 2 THEN 'premium_72h'
        WHEN boost_level = 3 THEN 'ultra_168h'
        ELSE 'basic_24h'
      END;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'featured_cases' AND column_name = 'paid_by'
    ) THEN
      ALTER TABLE featured_cases ADD COLUMN paid_by UUID REFERENCES profiles(id) ON DELETE CASCADE;
      -- Copy from user_id
      UPDATE featured_cases SET paid_by = user_id WHERE user_id IS NOT NULL;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'featured_cases' AND column_name = 'stripe_payment_id'
    ) THEN
      ALTER TABLE featured_cases ADD COLUMN stripe_payment_id TEXT;
      -- Copy from payment_id
      UPDATE featured_cases SET stripe_payment_id = payment_id WHERE payment_id IS NOT NULL;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'featured_cases' AND column_name = 'impressions'
    ) THEN
      ALTER TABLE featured_cases ADD COLUMN impressions INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'featured_cases' AND column_name = 'clicks'
    ) THEN
      ALTER TABLE featured_cases ADD COLUMN clicks INTEGER DEFAULT 0;
    END IF;
    
    -- Make sure price_paid is NOT NULL
    UPDATE featured_cases SET price_paid = 0 WHERE price_paid IS NULL;
    ALTER TABLE featured_cases ALTER COLUMN price_paid SET NOT NULL;
    
  ELSE
    -- Table doesn't exist or doesn't have old schema, create fresh
    DROP TABLE IF EXISTS featured_cases CASCADE;
    
    CREATE TABLE featured_cases (
      case_id UUID REFERENCES cases(id) ON DELETE CASCADE PRIMARY KEY,
      featured_until TIMESTAMPTZ NOT NULL,
      price_paid DECIMAL(10,2) NOT NULL,
      boost_type TEXT NOT NULL,
      paid_by UUID REFERENCES profiles(id) ON DELETE CASCADE,
      stripe_payment_id TEXT,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired')),
      impressions INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    );
    
    -- Create indexes
    CREATE INDEX idx_featured_cases_status ON featured_cases(status);
    CREATE INDEX idx_featured_cases_featured_until ON featured_cases(featured_until);
    CREATE INDEX idx_featured_cases_paid_by ON featured_cases(paid_by);
    
    -- Enable RLS
    ALTER TABLE featured_cases ENABLE ROW LEVEL SECURITY;
    
    -- RLS Policies
    CREATE POLICY "view_active_featured_cases"
    ON featured_cases FOR SELECT
    USING (status = 'active' AND featured_until > NOW());
    
    CREATE POLICY "view_own_featured_cases"
    ON featured_cases FOR SELECT
    USING (auth.uid() = paid_by);
    
    CREATE POLICY "create_own_featured_cases"
    ON featured_cases FOR INSERT
    WITH CHECK (auth.uid() = paid_by);
    
  END IF;
END $$;

-- Make sure boost_pricing table exists
CREATE TABLE IF NOT EXISTS boost_pricing (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  boost_type TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  duration_hours INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  features JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add sort_order column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'boost_pricing' AND column_name = 'sort_order'
  ) THEN
    ALTER TABLE boost_pricing ADD COLUMN sort_order INTEGER DEFAULT 0;
  END IF;
END $$;

-- Insert default pricing if empty
INSERT INTO boost_pricing (boost_type, display_name, duration_hours, price, features, sort_order)
VALUES 
  ('basic_24h', 'Basic Boost', 24, 4.99, '["Featured placement for 24 hours", "3x visibility boost", "Priority in search results"]'::jsonb, 1),
  ('premium_72h', 'Premium Boost', 72, 12.99, '["Featured placement for 72 hours", "5x visibility boost", "Priority in search results", "Highlighted border"]'::jsonb, 2),
  ('ultra_168h', 'Ultra Boost', 168, 24.99, '["Featured placement for 1 week", "10x visibility boost", "Top priority placement", "Highlighted border", "Featured badge"]'::jsonb, 3)
ON CONFLICT (boost_type) DO NOTHING;

-- Create function to get active boosts
DROP FUNCTION IF EXISTS get_active_boosts();

CREATE FUNCTION get_active_boosts()
RETURNS TABLE (
  case_id UUID,
  title TEXT,
  description TEXT,
  category TEXT,
  location TEXT,
  featured_until TIMESTAMPTZ,
  boost_type TEXT,
  impressions INTEGER,
  clicks INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.title,
    c.description,
    c.category,
    c.location,
    fc.featured_until,
    fc.boost_type,
    fc.impressions,
    fc.clicks
  FROM featured_cases fc
  JOIN cases c ON c.id = fc.case_id
  WHERE fc.status = 'active'
    AND fc.featured_until > NOW()
  ORDER BY fc.featured_until DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE featured_cases IS 'Stores boosted/featured cases with analytics';
COMMENT ON TABLE boost_pricing IS 'Available boost tiers and pricing';
