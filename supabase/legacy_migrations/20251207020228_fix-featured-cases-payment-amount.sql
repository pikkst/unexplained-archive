-- Fix featured_cases: remove old payment_amount column or make it nullable
-- The new schema uses price_paid instead

DO $$
BEGIN
  -- If payment_amount exists and is NOT NULL, either drop it or make nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'featured_cases' 
    AND column_name = 'payment_amount'
    AND is_nullable = 'NO'
  ) THEN
    -- Check if we have price_paid column (new schema)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'featured_cases' 
      AND column_name = 'price_paid'
    ) THEN
      -- Both exist, drop payment_amount (keep price_paid)
      ALTER TABLE featured_cases DROP COLUMN payment_amount CASCADE;
      RAISE NOTICE 'Dropped payment_amount column (using price_paid instead)';
    ELSE
      -- Only payment_amount exists, rename it to price_paid
      ALTER TABLE featured_cases RENAME COLUMN payment_amount TO price_paid;
      RAISE NOTICE 'Renamed payment_amount to price_paid';
    END IF;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'featured_cases' 
    AND column_name = 'payment_amount'
  ) THEN
    -- payment_amount exists but is already nullable, just drop it if price_paid exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'featured_cases' 
      AND column_name = 'price_paid'
    ) THEN
      ALTER TABLE featured_cases DROP COLUMN payment_amount CASCADE;
      RAISE NOTICE 'Dropped nullable payment_amount column';
    END IF;
  END IF;
  
  -- Ensure price_paid exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'featured_cases' 
    AND column_name = 'price_paid'
  ) THEN
    ALTER TABLE featured_cases ADD COLUMN price_paid DECIMAL(10,2) NOT NULL DEFAULT 0;
    RAISE NOTICE 'Added price_paid column';
  END IF;
  
END $$;

-- Verify
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'featured_cases'
  AND column_name IN ('payment_amount', 'price_paid')
ORDER BY column_name;
