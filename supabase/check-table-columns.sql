-- Quick script to check table columns for all tables we're adding RLS to

SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'admin_actions',
    'ai_usage',
    'badges',
    'boost_pricing',
    'case_followers',
    'challenges',
    'comments',
    'featured_cases',
    'forum_posts',
    'forum_threads',
    'kyc_verification',
    'moderation_flags',
    'stripe_accounts',
    'transaction_limits',
    'withdrawal_requests',
    'subscriptions'
  )
ORDER BY table_name, column_name;
