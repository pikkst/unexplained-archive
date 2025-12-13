-- Test Withdrawal Setup SQL Script
-- Purpose: Configure withdrawal requests with valid test bank details for Stripe payout testing
-- Execute in Supabase SQL Editor

-- 1. Update pending withdrawal with valid Estonian test IBAN
UPDATE withdrawal_requests 
SET 
    bank_name = 'Swedbank',
    iban = 'EE382200221020145685',
    account_holder = 'Test User'
WHERE 
    id = (
        SELECT id 
        FROM withdrawal_requests 
        WHERE status = 'pending' AND bank_name = 'TBD'
        ORDER BY requested_at DESC
        LIMIT 1
    );

-- 2. Fix RLS policy for transactions table (allow users to view their own transactions)
-- Remove OLD/BROKEN policies that check non-existent user_id column
DROP POLICY IF EXISTS "Users can view their own transactions." ON transactions;
DROP POLICY IF EXISTS "Users view own transactions" ON transactions;

-- Create CORRECT policy that checks via wallet relationships
CREATE POLICY "Users view own transactions" 
ON transactions 
FOR SELECT 
USING (
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
);

-- 3. Verify the updates
SELECT 
    id,
    user_id,
    amount,
    bank_name,
    iban,
    account_holder,
    status,
    requested_at
FROM withdrawal_requests
WHERE status = 'pending'
ORDER BY requested_at DESC
LIMIT 5;

-- 4. Check wallet balance and reserved amount
SELECT 
    id,
    user_id,
    balance,
    reserved,
    created_at
FROM wallets
WHERE user_id = (
    SELECT user_id 
    FROM withdrawal_requests 
    WHERE status = 'pending' 
    ORDER BY requested_at DESC 
    LIMIT 1
);

-- 5. Verify transactions exist (bypassing RLS with admin view)
SELECT 
    t.id,
    t.from_wallet_id,
    t.to_wallet_id,
    w1.user_id as from_user,
    w2.user_id as to_user,
    t.amount,
    t.transaction_type,
    t.status,
    t.metadata,
    t.created_at
FROM transactions t
LEFT JOIN wallets w1 ON t.from_wallet_id = w1.id
LEFT JOIN wallets w2 ON t.to_wallet_id = w2.id
ORDER BY t.created_at DESC
LIMIT 10;

-- 6. Check current RLS policies on transactions
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'transactions';
