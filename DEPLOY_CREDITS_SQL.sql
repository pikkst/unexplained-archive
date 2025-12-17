-- ========================================
-- CREDITS SYSTEM DEPLOYMENT SCRIPT
-- Copy-paste this into Supabase SQL Editor
-- ========================================
-- URL: https://supabase.com/dashboard/project/plyyjvbemdsubmnvudvr/sql/new

-- 1. Add credits columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0 CHECK (credits >= 0);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lifetime_credits_earned INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lifetime_credits_spent INTEGER DEFAULT 0;

-- 2. Credit transactions log
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    source VARCHAR(100),
    campaign_redemption_id UUID REFERENCES campaign_redemptions(id) ON DELETE SET NULL,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_transaction_type CHECK (transaction_type IN ('earned', 'spent', 'promo', 'reward', 'admin_grant', 'refund'))
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type);

-- 4. RLS Policies
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own credit transactions" ON credit_transactions;
CREATE POLICY "Users can view their own credit transactions" ON credit_transactions
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all credit transactions" ON credit_transactions;
CREATE POLICY "Admins can view all credit transactions" ON credit_transactions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- 5. Function: Add credits
CREATE OR REPLACE FUNCTION add_user_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_transaction_type VARCHAR(50),
    p_source VARCHAR(100),
    p_description TEXT DEFAULT NULL,
    p_campaign_redemption_id UUID DEFAULT NULL,
    p_case_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_new_balance INTEGER;
    v_transaction_id UUID;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;
    
    UPDATE profiles
    SET 
        credits = credits + p_amount,
        lifetime_credits_earned = lifetime_credits_earned + GREATEST(p_amount, 0),
        lifetime_credits_spent = lifetime_credits_spent + GREATEST(-p_amount, 0),
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING credits INTO v_new_balance;
    
    INSERT INTO credit_transactions (
        user_id, amount, balance_after, transaction_type, source,
        description, campaign_redemption_id, case_id
    ) VALUES (
        p_user_id, p_amount, v_new_balance, p_transaction_type, p_source,
        p_description, p_campaign_redemption_id, p_case_id
    ) RETURNING id INTO v_transaction_id;
    
    RETURN json_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'new_balance', v_new_balance,
        'amount', p_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Function: Spend credits
CREATE OR REPLACE FUNCTION spend_user_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_source VARCHAR(100),
    p_description TEXT DEFAULT NULL,
    p_case_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_current_balance INTEGER;
    v_result JSON;
BEGIN
    SELECT credits INTO v_current_balance FROM profiles WHERE id = p_user_id;
    
    IF v_current_balance IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;
    
    IF v_current_balance < p_amount THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Insufficient credits', 
            'required', p_amount,
            'available', v_current_balance
        );
    END IF;
    
    v_result := add_user_credits(
        p_user_id, -p_amount, 'spent', p_source,
        p_description, NULL, p_case_id
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function: Get credits
CREATE OR REPLACE FUNCTION get_user_credits(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_profile RECORD;
BEGIN
    SELECT credits, lifetime_credits_earned, lifetime_credits_spent
    INTO v_profile FROM profiles WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'balance', v_profile.credits,
        'lifetime_earned', v_profile.lifetime_credits_earned,
        'lifetime_spent', v_profile.lifetime_credits_spent
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function: Admin grant credits
CREATE OR REPLACE FUNCTION admin_grant_credits(
    p_admin_id UUID,
    p_user_id UUID,
    p_amount INTEGER,
    p_reason TEXT
)
RETURNS JSON AS $$
DECLARE
    v_is_admin BOOLEAN;
    v_result JSON;
BEGIN
    SELECT role = 'admin' INTO v_is_admin FROM profiles WHERE id = p_admin_id;
    
    IF NOT v_is_admin THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized - Admin only');
    END IF;
    
    v_result := add_user_credits(
        p_user_id, p_amount, 'admin_grant', 'admin_manual',
        p_reason || ' (granted by admin)', NULL, NULL
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Trigger: Auto-grant credits on campaign redemption
CREATE OR REPLACE FUNCTION grant_credits_on_redemption()
RETURNS TRIGGER AS $$
DECLARE
    v_credits INTEGER;
    v_campaign_name TEXT;
BEGIN
    v_credits := (NEW.benefit_value->>'free_credits')::INTEGER;
    
    IF v_credits IS NOT NULL AND v_credits > 0 THEN
        SELECT name INTO v_campaign_name FROM promotional_campaigns WHERE id = NEW.campaign_id;
        
        PERFORM add_user_credits(
            NEW.user_id, v_credits, 'promo', 'campaign_redemption',
            'Promotional credits from: ' || v_campaign_name, NEW.id, NULL
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_grant_credits_on_redemption ON campaign_redemptions;
CREATE TRIGGER trigger_grant_credits_on_redemption
    AFTER INSERT ON campaign_redemptions
    FOR EACH ROW
    WHEN (NEW.benefit_type = 'free_credits' OR (NEW.benefit_value->>'free_credits')::INTEGER > 0)
    EXECUTE FUNCTION grant_credits_on_redemption();

-- 10. View: Credit summary
CREATE OR REPLACE VIEW user_credit_summary AS
SELECT 
    p.id AS user_id,
    p.username,
    p.credits AS current_balance,
    p.lifetime_credits_earned AS total_earned,
    p.lifetime_credits_spent AS total_spent,
    COUNT(ct.id) AS transaction_count,
    MAX(ct.created_at) AS last_transaction_at
FROM profiles p
LEFT JOIN credit_transactions ct ON ct.user_id = p.id
GROUP BY p.id, p.username, p.credits, p.lifetime_credits_earned, p.lifetime_credits_spent;

GRANT SELECT ON user_credit_summary TO authenticated;

COMMENT ON COLUMN profiles.credits IS 'Virtual currency earned from promotions - can be used for AI generation, donations, etc.';
COMMENT ON TABLE credit_transactions IS 'Log of all credit earnings and spending - separate from wallet (real money)';

-- ✅ DEPLOYMENT COMPLETE!

-- Test queries:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles' AND column_name LIKE '%credit%';
-- SELECT * FROM credit_transactions LIMIT 5;
-- SELECT proname FROM pg_proc WHERE proname LIKE '%credit%';
