-- =============================================
-- CHECK ANALYTICS & SEO SCHEMA STATUS
-- Run this in Supabase SQL Editor to see what
-- tables/columns/roles exist that our setup
-- script relies on.
-- =============================================

-- 1. Check if key tables exist
SELECT 
  schemaname AS schema,
  tablename AS table
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles',
    'analytics_events',
    'analytics_daily_stats',
    'blog_articles',
    'blog_comments',
    'seo_rankings'
  )
ORDER BY tablename;

-- 2. Show columns for each relevant table
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'analytics_events',
    'analytics_daily_stats',
    'blog_articles',
    'blog_comments',
    'seo_rankings'
  )
ORDER BY table_name, ordinal_position;

-- 3. Show RLS status for relevant tables
SELECT 
  schemaname,
  tablename,
  rowsecurity,
  relrowsecurity AS rls_enabled
FROM pg_catalog.pg_tables t
JOIN pg_class c ON c.relname = t.tablename
JOIN pg_namespace n ON n.nspname = t.schemaname AND n.oid = c.relnamespace
WHERE schemaname = 'public'
  AND tablename IN (
    'analytics_events',
    'analytics_daily_stats',
    'blog_articles',
    'blog_comments',
    'seo_rankings'
  )
ORDER BY tablename;

-- 4. List policies on relevant tables
SELECT 
  n.nspname     AS schema,
  c.relname     AS table_name,
  p.polname     AS policy_name,
  p.polcmd      AS command,
  pg_get_expr(p.polqual, p.polrelid) AS using_expression,
  pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
FROM pg_policy p
JOIN pg_class c   ON p.polrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND c.relname IN (
    'analytics_events',
    'analytics_daily_stats',
    'blog_articles',
    'blog_comments',
    'seo_rankings'
  )
ORDER BY c.relname, p.polname;

-- 5. Inspect profiles table structure (if it exists)
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 6. (Optional) Sample rows from profiles (will fail if table doesn't exist)
SELECT *
FROM profiles
LIMIT 50;

-- If this last query fails, you don't have a profiles
-- table matching what the analytics/SEO setup expects.