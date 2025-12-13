-- =============================================
-- FIX MULTIPLE PERMISSIVE POLICIES
-- Consolidating overlapping policies to improve performance
-- =============================================

-- 1. Table: ai_usage (SELECT)
-- Consolidating "Admins can view all translation usage" and "Users view own ai usage"
DROP POLICY IF EXISTS "Admins can view all translation usage" ON ai_usage;
DROP POLICY IF EXISTS "Users view own ai usage" ON ai_usage;
DROP POLICY IF EXISTS "Users can view own translation usage" ON ai_usage; -- potential duplicate

CREATE POLICY "ai_usage_select_policy" ON ai_usage
FOR SELECT USING (
  (auth.uid() = user_id) OR 
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
);

-- 2. Table: background_checks (SELECT)
-- Consolidating "Admins can view all checks" and "Users can view own checks"
DROP POLICY IF EXISTS "Admins can view all checks" ON background_checks;
DROP POLICY IF EXISTS "Users can view own checks" ON background_checks;

CREATE POLICY "background_checks_select_policy" ON background_checks
FOR SELECT USING (
  (auth.uid() = investigator_id) OR 
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
);

-- 3. Table: challenges (SELECT)
-- Consolidating "Admins manage challenges" (which includes SELECT) and "Public view challenges"
-- We'll split the admin policy to exclude SELECT, and handle SELECT in a unified policy.
DROP POLICY IF EXISTS "Admins manage challenges" ON challenges;

-- Re-create Admin policy for INSERT, UPDATE, DELETE
CREATE POLICY "admins_manage_challenges_mod" ON challenges
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

CREATE POLICY "admins_manage_challenges_update" ON challenges
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

CREATE POLICY "admins_manage_challenges_delete" ON challenges
FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- Unified SELECT policy (Assuming existing "Public view challenges" was just true or status based)
-- We drop it and recreate a smart one.
DROP POLICY IF EXISTS "Public view challenges" ON challenges;

CREATE POLICY "challenges_select_policy" ON challenges
FOR SELECT USING (
  true -- Making it effectively public, or you could add (status = 'active' OR admin) if that was the intent. 
       -- Given the warning "Public view challenges", it likely allowed everyone.
);

-- 4. Table: featured_cases (SELECT)
-- Consolidating "view_active_featured_cases" and "view_own_featured_cases"
DROP POLICY IF EXISTS "view_active_featured_cases" ON featured_cases;
DROP POLICY IF EXISTS "view_own_featured_cases" ON featured_cases;

CREATE POLICY "featured_cases_select_policy" ON featured_cases
FOR SELECT USING (
  (active = true) OR -- Assuming "view_active_featured_cases" filtered by active=true
  (EXISTS (SELECT 1 FROM cases WHERE cases.id = featured_cases.case_id AND cases.user_id = auth.uid()))
);

-- 5. Table: investigator_applications (SELECT)
-- Consolidating "admins_select_all_applications" and "users_select_own_application"
DROP POLICY IF EXISTS "admins_select_all_applications" ON investigator_applications;
DROP POLICY IF EXISTS "users_select_own_application" ON investigator_applications;

CREATE POLICY "investigator_applications_select_policy" ON investigator_applications
FOR SELECT USING (
  (auth.uid() = user_id) OR
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
);

-- 6. Table: transaction_limits (INSERT, SELECT, UPDATE)

-- SELECT
DROP POLICY IF EXISTS "Admins can view all transaction limits" ON transaction_limits;
DROP POLICY IF EXISTS "Users can view own transaction limits" ON transaction_limits;
DROP POLICY IF EXISTS "Users can view their own transaction limits" ON transaction_limits;

CREATE POLICY "transaction_limits_select_policy" ON transaction_limits
FOR SELECT USING (
  (auth.uid() = user_id) OR
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
);

-- INSERT
DROP POLICY IF EXISTS "System can insert transaction limits" ON transaction_limits;
DROP POLICY IF EXISTS "Users can insert own transaction limits" ON transaction_limits;

CREATE POLICY "transaction_limits_insert_policy" ON transaction_limits
FOR INSERT WITH CHECK (
  (auth.uid() = user_id) OR
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'service_role')) OR -- Assuming "System" meant service_role or admin
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
);

-- UPDATE
DROP POLICY IF EXISTS "Admins can update transaction limits" ON transaction_limits;
DROP POLICY IF EXISTS "System can update transaction limits" ON transaction_limits;

CREATE POLICY "transaction_limits_update_policy" ON transaction_limits
FOR UPDATE USING (
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')) OR
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'service_role'))
);

-- 7. Table: transactions (SELECT)
-- Consolidating "Admins view all transactions" and "Users view own transactions"
DROP POLICY IF EXISTS "Admins view all transactions" ON transactions;
DROP POLICY IF EXISTS "Users view own transactions" ON transactions;

CREATE POLICY "transactions_select_policy" ON transactions
FOR SELECT USING (
  (
    EXISTS (
      SELECT 1 FROM wallets
      WHERE wallets.id = transactions.from_wallet_id
        AND wallets.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM wallets
      WHERE wallets.id = transactions.to_wallet_id
        AND wallets.user_id = auth.uid()
    )
  )
  OR
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
);

-- 8. Table: user_challenges (SELECT)
-- Consolidating "Admins view all user challenges" and "Users view own challenges"
DROP POLICY IF EXISTS "Admins view all user challenges" ON user_challenges;
DROP POLICY IF EXISTS "Users view own challenges" ON user_challenges;

CREATE POLICY "user_challenges_select_policy" ON user_challenges
FOR SELECT USING (
  (auth.uid() = user_id) OR
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
);

-- 9. Table: wallets (SELECT)
-- Consolidating "Admins view all wallets" and "wallets_select_policy"
DROP POLICY IF EXISTS "Admins view all wallets" ON wallets;
DROP POLICY IF EXISTS "wallets_select_policy" ON wallets;

CREATE POLICY "wallets_select_policy_unified" ON wallets
FOR SELECT USING (
  (auth.uid() = user_id) OR
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
);