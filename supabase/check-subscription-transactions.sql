-- Check subscription transactions
SELECT 
    t.id,
    t.from_wallet_id,
    t.to_wallet_id,
    t.amount,
    t.transaction_type,
    t.status,
    t.metadata,
    t.created_at,
    fw.user_id as from_user_id,
    p.username as from_username
FROM transactions t
LEFT JOIN wallets fw ON fw.id = t.from_wallet_id
LEFT JOIN profiles p ON p.id = fw.user_id
WHERE t.transaction_type = 'subscription'
ORDER BY t.created_at DESC;
