-- Fix featured_cases table: handle both user_id and paid_by columns
-- Some tables have user_id (old), some have paid_by (new)

DO $$
BEGIN
  -- Drop old RLS policies that depend on user_id
  DROP POLICY IF EXISTS create_own_featured_cases ON featured_cases;
  DROP POLICY IF EXISTS view_own_featured_cases ON featured_cases;
  DROP POLICY IF EXISTS update_own_featured_cases ON featured_cases;
  DROP POLICY IF EXISTS view_active_featured_cases ON featured_cases;
  RAISE NOTICE 'Dropped old RLS policies';
  
  -- Check if user_id column exists and is NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'featured_cases' 
    AND column_name = 'user_id'
    AND is_nullable = 'NO'
  ) THEN
    -- Make user_id nullable or drop it if paid_by exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'featured_cases' 
      AND column_name = 'paid_by'
    ) THEN
      -- Both exist, drop user_id (keep paid_by)
      ALTER TABLE featured_cases DROP COLUMN IF EXISTS user_id CASCADE;
      RAISE NOTICE 'Dropped user_id column (using paid_by instead)';
    ELSE
      -- Only user_id exists, rename it to paid_by
      ALTER TABLE featured_cases RENAME COLUMN user_id TO paid_by;
      RAISE NOTICE 'Renamed user_id to paid_by';
    END IF;
  END IF;
  
  -- Ensure paid_by column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'featured_cases' 
    AND column_name = 'paid_by'
  ) THEN
    ALTER TABLE featured_cases ADD COLUMN paid_by UUID REFERENCES profiles(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added paid_by column';
  END IF;
  
  -- Make paid_by nullable (not required for all scenarios)
  ALTER TABLE featured_cases ALTER COLUMN paid_by DROP NOT NULL;
  RAISE NOTICE 'Made paid_by nullable';
  
  -- Recreate RLS policies with paid_by
  CREATE POLICY "view_active_featured_cases"
    ON featured_cases FOR SELECT
    USING (status = 'active' AND featured_until > NOW());
  
  CREATE POLICY "view_own_featured_cases"
    ON featured_cases FOR SELECT
    USING (paid_by = auth.uid());
  
  CREATE POLICY "create_own_featured_cases"
    ON featured_cases FOR INSERT
    WITH CHECK (paid_by = auth.uid());
  
  RAISE NOTICE 'Created new RLS policies with paid_by';
  
END $$;

-- Verify the change
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'featured_cases'
  AND column_name IN ('user_id', 'paid_by')
ORDER BY column_name;
