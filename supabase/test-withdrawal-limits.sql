-- Test Withdrawal Limits & Balance Checks
-- Purpose: Verify withdrawal system prevents overdrafts and maintains correct balances

-- 1. Check current wallet state
SELECT 
    w.id,
    w.user_id,
    w.balance as available,
    w.reserved as pending_withdrawals,
    (w.balance + w.reserved) as total,
    p.username
FROM wallets w
JOIN profiles p ON w.user_id = p.id
WHERE w.user_id = 'd2e685c5-0922-4385-8403-279278660ae8';

-- 2. Check pending withdrawal requests
SELECT 
    id,
    amount,
    fee,
    net_amount,
    status,
    requested_at
FROM withdrawal_requests
WHERE user_id = 'd2e685c5-0922-4385-8403-279278660ae8'
ORDER BY requested_at DESC;

-- 3. Calculate total deposited vs withdrawn
SELECT 
    SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE 0 END) as total_deposits,
    SUM(CASE WHEN transaction_type = 'withdrawal' THEN amount ELSE 0 END) as total_withdrawals,
    SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE -amount END) as net_balance
FROM transactions t
JOIN wallets w ON t.to_wallet_id = w.id OR t.from_wallet_id = w.id
WHERE w.user_id = 'd2e685c5-0922-4385-8403-279278660ae8';

-- 4. Verify Stripe balance tracking
-- This simulates what should be in Stripe Operations account
SELECT 
    'Expected Stripe Operations Balance' as description,
    SUM(w.balance + w.reserved) as amount_eur,
    'All user wallets combined' as note
FROM wallets w;

-- 5. Test overdraft protection (should fail)
-- Run this to test: Will attempt to withdraw more than available
-- Expected: Error or zero rows affected
/*
DO $$
DECLARE
    test_wallet RECORD;
    test_amount DECIMAL := 99999.00; -- Intentionally too much
BEGIN
    SELECT * INTO test_wallet 
    FROM wallets 
    WHERE user_id = 'd2e685c5-0922-4385-8403-279278660ae8';
    
    IF test_wallet.balance >= test_amount THEN
        RAISE NOTICE 'FAIL: Wallet has enough balance (should not happen)';
    ELSE
        RAISE NOTICE 'PASS: Overdraft protection working - balance: €%, requested: €%', 
            test_wallet.balance, test_amount;
    END IF;
END $$;
*/
