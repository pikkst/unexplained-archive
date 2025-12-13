-- This script deploys the Platform Revenue system.
-- It creates the necessary table and a function to record platform fees
-- from various transaction types like donations, withdrawals, and subscriptions.
-- This version is idempotent and safe to re-run.

-- Step 1: Create the platform_revenue table if it does not exist.
CREATE TABLE IF NOT EXISTS platform_revenue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0)
);

-- Step 1b: Ensure all required columns exist in the table.
-- This makes the script safe to re-run even if the table was partially created.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='platform_revenue' AND column_name='source') THEN
        ALTER TABLE platform_revenue ADD COLUMN source TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='platform_revenue' AND column_name='reference_id') THEN
        ALTER TABLE platform_revenue ADD COLUMN reference_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='platform_revenue' AND column_name='metadata') THEN
        ALTER TABLE platform_revenue ADD COLUMN metadata JSONB;
    END IF;
END;
$$;


COMMENT ON TABLE platform_revenue IS 'Tracks all revenue earned by the platform from fees.';
COMMENT ON COLUMN platform_revenue.source IS 'The type of transaction that generated the revenue.';
COMMENT ON COLUMN platform_revenue.reference_id IS 'Associated transaction or payment ID for auditing.';

-- Create an index for faster queries on the source of revenue
CREATE INDEX IF NOT EXISTS idx_platform_revenue_source ON platform_revenue(source);

-- Enable Row Level Security
ALTER TABLE platform_revenue ENABLE ROW LEVEL SECURITY;

-- Grant access to the service_role (for server-side functions)
GRANT SELECT, INSERT ON platform_revenue TO service_role;


-- Step 2: Create a function to calculate and record platform fees
-- This function will be called by other database functions to ensure
-- fees are consistently calculated and recorded.
CREATE OR REPLACE FUNCTION record_platform_fee(
  p_amount DECIMAL,
  p_type TEXT,
  p_reference_id TEXT
) RETURNS DECIMAL AS $$
DECLARE
  v_fee DECIMAL;
BEGIN
  -- Calculate fee based on the transaction type
  v_fee := CASE
    WHEN p_type = 'donation' THEN p_amount * 0.10 -- 10%
    WHEN p_type = 'case_reward' THEN p_amount * 0.15 -- 15%
    WHEN p_type = 'withdrawal' THEN 2.0 + (p_amount * 0.02) -- €2 + 2%
    WHEN p_type = 'subscription' THEN p_amount * 0.05 -- 5%
    ELSE 0
  END;

  -- Insert the calculated fee into the platform_revenue table
  IF v_fee > 0 THEN
    INSERT INTO platform_revenue (amount, source, reference_id)
    VALUES (v_fee, p_type || '_fee', p_reference_id);
  END IF;

  -- Return the calculated fee
  RETURN v_fee;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to the service_role
GRANT EXECUTE ON FUNCTION record_platform_fee(DECIMAL, TEXT, TEXT) TO service_role;

-- Example of how to use this function in another DB function:
--
-- DECLARE
--   v_platform_fee DECIMAL;
-- BEGIN
--   -- ... your logic ...
--   v_platform_fee := record_platform_fee(total_amount, 'donation', stripe_charge_id);
--   v_net_amount := total_amount - v_platform_fee;
--   -- ... continue logic ...
-- END;
--
