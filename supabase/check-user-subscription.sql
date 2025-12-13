-- Check user's subscription status and credits

-- 1. Check subscription record
SELECT 
    id,
    user_id,
    plan_type,
    status,
    billing_cycle,
    price,
    current_period_start,
    current_period_end,
    created_at
FROM subscriptions
WHERE user_id = '1d5fd006-9953-4d8a-9885-df448e4bd66f';

-- 2. Check subscription credits
SELECT 
    user_id,
    subscription_id,
    credits_total,
    credits_used,
    credits_remaining,
    billing_cycle,
    current_period_start,
    current_period_end,
    created_at
FROM subscription_credits
WHERE user_id = '1d5fd006-9953-4d8a-9885-df448e4bd66f';

-- 3. Check subscription transactions
SELECT 
    id,
    user_id,
    subscription_id,
    plan_code,
    amount,
    billing_cycle,
    payment_method,
    status,
    created_at
FROM subscription_transactions
WHERE user_id = '1d5fd006-9953-4d8a-9885-df448e4bd66f'
ORDER BY created_at DESC;
