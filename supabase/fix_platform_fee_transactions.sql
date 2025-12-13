-- This script corrects the accounting of platform fees that were incorrectly
-- recorded as debit transactions from user wallets.
--
-- It performs three main actions in a single transaction:
-- 1. Moves the fee records from the `transactions` table to the `platform_revenue` table.
-- 2. Refunds the fee amount back to the user's wallet balance.
-- 3. Deletes the incorrect `platform_fee` transaction records.
--
-- Always back up your database before running a migration script.

BEGIN;

-- Step 1: Move platform fee transactions to the platform_revenue table.
-- This version uses the correct `source` value ('platform_fee') to satisfy the
-- database check constraint. The original transaction type is stored in metadata.
INSERT INTO platform_revenue (amount, source, transaction_id, description, created_at, metadata)
SELECT
    t.amount,
    'platform_fee' AS source, -- Use the allowed source value
    NULL AS transaction_id, -- Set foreign key to NULL to allow deletion of the old transaction
    'Manually migrated platform fee from incorrect transaction record.' AS description,
    t.created_at,
    jsonb_build_object(
        'original_transaction_type', COALESCE(t.metadata->>'sourceTransaction', 'donation'),
        'original_transaction_id', t.id,
        'caseId', t.case_id,
        'userId', (SELECT user_id FROM wallets WHERE id = t.from_wallet_id)
    )
FROM
    transactions t
WHERE
    t.transaction_type = 'platform_fee';

-- Step 2: Refund the deducted fee amounts back to the users' wallets.
-- This is critical for correcting user balances. It finds the user's wallet
-- associated with the incorrect fee and adds the fee amount back to their balance.
UPDATE wallets w
SET
    balance = w.balance + t.amount,
    updated_at = NOW()
FROM
    transactions t
WHERE
    w.id = t.from_wallet_id
    AND t.transaction_type = 'platform_fee';

-- Step 3: Delete the incorrect 'platform_fee' transactions from the main transactions table.
-- This cleans up the transaction history, removing the erroneous debit records.
DELETE FROM transactions
WHERE transaction_type = 'platform_fee';

COMMIT;

-- After running this script, you can verify the changes with these queries:
--
-- 1. Check the platform_revenue table for the new entries.
--    SELECT * FROM platform_revenue ORDER BY created_at DESC;
--
-- 2. Check a user's wallet balance to confirm it has been corrected.
--    SELECT * FROM wallets WHERE user_id = '[user_id]';
--
-- 3. Check the transactions table to confirm 'platform_fee' records are gone.
--    SELECT COUNT(*) FROM transactions WHERE transaction_type = 'platform_fee';
