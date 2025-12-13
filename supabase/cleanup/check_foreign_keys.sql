-- Find all foreign key constraints related to cases table
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'cases'
ORDER BY tc.table_name;

-- Show which tables reference cases table
SELECT DISTINCT
  tc.table_name,
  string_agg(kcu.column_name, ', ') as referencing_columns
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'cases'
GROUP BY tc.table_name
ORDER BY tc.table_name;

-- Count records in each table that references cases
SELECT 'notifications' as table_name, COUNT(*) as count FROM notifications WHERE case_id IS NOT NULL
UNION ALL
SELECT 'messages', COUNT(*) FROM messages WHERE case_id IS NOT NULL
UNION ALL
SELECT 'comments', COUNT(*) FROM comments WHERE case_id IS NOT NULL
UNION ALL
SELECT 'featured_cases', COUNT(*) FROM featured_cases WHERE case_id IS NOT NULL
UNION ALL
SELECT 'forum_threads', COUNT(*) FROM forum_threads WHERE case_id IS NOT NULL
UNION ALL
SELECT 'subscription_usage_log', COUNT(*) FROM subscription_usage_log WHERE case_id IS NOT NULL;
