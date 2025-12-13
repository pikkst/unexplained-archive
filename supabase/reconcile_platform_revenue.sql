-- This script reconciles historical financial data to correctly distinguish
-- between direct platform revenue and user-to-user (escrowed) funds.
--
-- It performs the following actions in a single transaction:
-- 1. Identifies 'boost_payment' transactions and moves the FULL amount to platform_revenue.
-- 2. Identifies 'donation' transactions, calculates the correct 10% platform fee,
--    and moves ONLY the fee amount to platform_revenue.
-- 3. Refunds users for any 'platform_fee' transactions that were incorrectly debited.
-- 4. Cleans up the old, incorrect 'platform_fee' records.
--
-- NOTE: Run the `deploy_revenue_system.sql` script BEFORE running this one.
-- Always back up your database before running this script.

BEGIN;

-- Step 1: Process direct revenue payments (e.g., case boosts)
-- These payments are 100% platform revenue. The transaction_id is set to NULL
-- to prevent foreign key violations when the old transaction is deleted.
INSERT INTO platform_revenue (amount, source, transaction_id, description, created_at, metadata)
SELECT
    t.amount,
    'boost' AS source,
    NULL AS transaction_id, -- Do not link to the transaction we are about to delete
    'Manually reconciled boost payment.' AS description,
    t.created_at,
    jsonb_build_object(
        'original_transaction_id', t.id,
        'caseId', t.case_id,
        'userId', t.user_id
    )
FROM
    transactions t
WHERE
    t.transaction_type = 'boost_payment';

-- Step 2: Process escrowed payments (e.g., donations) and extract only the fee.
-- These are user-to-user payments where the platform only earns a fee.
INSERT INTO platform_revenue (amount, source, transaction_id, description, created_at, metadata)
SELECT
    (t.amount * 0.10) AS amount, -- Calculate the 10% platform fee
    'platform_fee' AS source,
    NULL AS transaction_id, -- Do not link to the transaction we are about to delete
    'Manually reconciled platform fee from donation.' AS description,
    t.created_at,
    jsonb_build_object(
        'original_transaction_id', t.id,
        'gross_donation_amount', t.amount,
        'caseId', t.case_id,
        'userId', t.user_id
    )
FROM
    transactions t
WHERE
    t.transaction_type = 'donation';

-- Step 3: Refund users for any old, incorrect 'platform_fee' debits.
-- This finds wallets that were incorrectly charged and refunds them.
UPDATE wallets w
SET
    balance = w.balance + t.amount,
    updated_at = NOW()
FROM
    transactions t
WHERE
    w.id = t.from_wallet_id
    AND t.transaction_type = 'platform_fee';

-- Step 4: Break the foreign key link from featured_cases to the transactions
-- that are about to be deleted. This prevents a foreign key violation.
UPDATE featured_cases
SET transaction_id = NULL
WHERE transaction_id IN (
    SELECT id FROM transactions WHERE transaction_type = 'boost_payment'
);

-- Step 5: Delete the old, incorrect 'platform_fee' transactions.
DELETE FROM transactions
WHERE transaction_type = 'platform_fee';

-- Step 6: (Optional but Recommended) Delete the now-reconciled direct boost payments
-- from the main transaction table to avoid double-counting in user histories.
-- These were never user-to-user, so they shouldn't appear as a debit.
DELETE FROM transactions
WHERE transaction_type = 'boost_payment';

COMMIT;

-- Verification Queries:
-- SELECT * FROM platform_revenue ORDER BY created_at DESC;
-- SELECT * FROM wallets WHERE user_id = '[some_user_id]';
-- SELECT * FROM transactions WHERE transaction_type IN ('platform_fee', 'boost_payment');
-- SELECT * FROM featured_cases WHERE transaction_id IS NOT NULL; -- Should be empty for old boosts

