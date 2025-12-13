-- Check database schema - see what tables exist
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'extensions', 'net', 'graphql')
ORDER BY tablename;

-- Show all tables with row counts
SELECT 
  t.table_name,
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t.table_name) as exists_in_public
FROM information_schema.tables t
WHERE t.table_schema = 'public'
ORDER BY t.table_name;

-- Check for case-related tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name ILIKE '%case%'
ORDER BY table_name;

-- Check for comment/interaction tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name ILIKE '%comment%' OR table_name ILIKE '%post%' OR table_name ILIKE '%interaction%')
ORDER BY table_name;

-- Check wallet/transaction tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name ILIKE '%wallet%' OR table_name ILIKE '%transaction%' OR table_name ILIKE '%boost%')
ORDER BY table_name;

-- Full schema listing with columns
SELECT 
  t.table_name,
  STRING_AGG(c.column_name || ' (' || c.data_type || ')', ', ' ORDER BY c.ordinal_position) as columns
FROM information_schema.tables t
LEFT JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
WHERE t.table_schema = 'public'
GROUP BY t.table_name
ORDER BY t.table_name;
