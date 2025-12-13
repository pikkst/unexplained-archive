-- =============================================
-- TRANSACTION MONITORING ENHANCEMENTS
-- Better foreign keys and views for admin dashboard
-- =============================================

-- Add missing indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_from_wallet_id ON transactions(from_wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_to_wallet_id ON transactions(to_wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);

-- Create a view that joins transactions with user profiles for easier querying
CREATE OR REPLACE VIEW transactions_with_users AS
SELECT 
  t.*,
  w_from.user_id as from_user_id,
  w_to.user_id as to_user_id,
  p_from.username as from_username,
  p_from.avatar_url as from_avatar_url,
  p_to.username as to_username,
  p_to.avatar_url as to_avatar_url
FROM transactions t
LEFT JOIN wallets w_from ON t.from_wallet_id = w_from.id
LEFT JOIN wallets w_to ON t.to_wallet_id = w_to.id
LEFT JOIN profiles p_from ON w_from.user_id = p_from.id
LEFT JOIN profiles p_to ON w_to.user_id = p_to.id;

-- Grant view access
GRANT SELECT ON transactions_with_users TO authenticated;

-- View for transaction statistics
CREATE OR REPLACE VIEW transaction_statistics AS
SELECT 
  DATE(created_at) as date,
  transaction_type,
  status,
  COUNT(*) as count,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount,
  MIN(amount) as min_amount,
  MAX(amount) as max_amount
FROM transactions
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at), transaction_type, status
ORDER BY date DESC, transaction_type;

-- Grant view access
GRANT SELECT ON transaction_statistics TO authenticated;

-- =============================================
-- TRANSACTION LIMITS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS transaction_limits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  daily_limit DECIMAL(10, 2) DEFAULT 100.00 NOT NULL, -- Default €100/day for unverified
  monthly_limit DECIMAL(10, 2) DEFAULT 1000.00 NOT NULL, -- Default €1000/month for unverified
  daily_spent DECIMAL(10, 2) DEFAULT 0.00 NOT NULL,
  monthly_spent DECIMAL(10, 2) DEFAULT 0.00 NOT NULL,
  last_daily_reset TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  last_monthly_reset TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  verification_level INTEGER DEFAULT 0 CHECK (verification_level BETWEEN 0 AND 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transaction_limits_user_id ON transaction_limits(user_id);

-- Enable RLS
ALTER TABLE transaction_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transaction limits"
  ON transaction_limits FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "System can manage transaction limits"
  ON transaction_limits FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- Function to update limits based on verification level
CREATE OR REPLACE FUNCTION update_transaction_limits_on_kyc()
RETURNS TRIGGER AS $$
BEGIN
  -- Update limits based on verification level
  IF NEW.status = 'approved' THEN
    UPDATE transaction_limits
    SET 
      daily_limit = CASE NEW.verification_level
        WHEN 1 THEN 1000.00  -- Basic KYC: €1000/day
        WHEN 2 THEN 5000.00  -- Advanced KYC: €5000/day
        ELSE 100.00
      END,
      monthly_limit = CASE NEW.verification_level
        WHEN 1 THEN 10000.00  -- Basic KYC: €10,000/month
        WHEN 2 THEN 50000.00  -- Advanced KYC: €50,000/month
        ELSE 1000.00
      END,
      verification_level = NEW.verification_level,
      updated_at = NOW()
    WHERE user_id = NEW.user_id;
    
    -- Create limits entry if it doesn't exist
    INSERT INTO transaction_limits (user_id, verification_level)
    VALUES (NEW.user_id, NEW.verification_level)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update limits when KYC status changes
DROP TRIGGER IF EXISTS trigger_update_limits_on_kyc ON kyc_verification;
CREATE TRIGGER trigger_update_limits_on_kyc
  AFTER INSERT OR UPDATE ON kyc_verification
  FOR EACH ROW
  EXECUTE FUNCTION update_transaction_limits_on_kyc();

-- Function to reset daily/monthly spending limits
CREATE OR REPLACE FUNCTION reset_transaction_limits()
RETURNS void AS $$
BEGIN
  -- Reset daily limits
  UPDATE transaction_limits
  SET 
    daily_spent = 0,
    last_daily_reset = NOW()
  WHERE last_daily_reset < CURRENT_DATE;
  
  -- Reset monthly limits
  UPDATE transaction_limits
  SET 
    monthly_spent = 0,
    last_monthly_reset = NOW()
  WHERE DATE_TRUNC('month', last_monthly_reset) < DATE_TRUNC('month', CURRENT_DATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT ALL ON transaction_limits TO authenticated;

-- =============================================
-- COMPLETION MESSAGE
-- =============================================

DO $$ 
BEGIN
  RAISE NOTICE 'Transaction monitoring enhancements complete!';
  RAISE NOTICE '✓ Transaction indexes added';
  RAISE NOTICE '✓ Transaction views created';
  RAISE NOTICE '✓ Transaction limits table';
  RAISE NOTICE '✓ KYC-based limit updates';
  RAISE NOTICE '✓ Daily/monthly reset function';
END $$;
