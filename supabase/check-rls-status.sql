-- Check RLS (Row Level Security) status for all tables
-- This script shows which tables exist and their RLS configuration

-- =============================================================================
-- 1. ALL TABLES WITH RLS STATUS
-- =============================================================================
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  CASE 
    WHEN rowsecurity THEN '✅ RLS Enabled'
    ELSE '❌ RLS DISABLED'
  END as status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY 
  rowsecurity DESC,
  tablename;

-- =============================================================================
-- 2. TABLES WITHOUT RLS (SECURITY RISK!)
-- =============================================================================
SELECT 
  '🔴 CRITICAL: Tables without RLS' as alert,
  tablename,
  '❌ No protection - any user can access!' as risk
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
ORDER BY tablename;

-- =============================================================================
-- 3. EXISTING RLS POLICIES
-- =============================================================================
SELECT 
  schemaname,
  tablename,
  policyname,
  CASE cmd
    WHEN '*' THEN 'ALL'
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
  END as operation,
  CASE 
    WHEN permissive = 'PERMISSIVE' THEN '✅ PERMISSIVE'
    ELSE '⚠️ RESTRICTIVE'
  END as type
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =============================================================================
-- 4. TABLES WITH RLS BUT NO POLICIES (WILL BLOCK ALL ACCESS!)
-- =============================================================================
SELECT 
  '⚠️ WARNING: RLS enabled but no policies' as alert,
  t.tablename,
  '🚫 Will block all user access!' as impact
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = t.schemaname
      AND p.tablename = t.tablename
  )
ORDER BY t.tablename;

-- =============================================================================
-- 5. SUMMARY STATISTICS
-- =============================================================================
SELECT 
  COUNT(*) as total_tables,
  COUNT(*) FILTER (WHERE rowsecurity = true) as tables_with_rls,
  COUNT(*) FILTER (WHERE rowsecurity = false) as tables_without_rls,
  ROUND(100.0 * COUNT(*) FILTER (WHERE rowsecurity = true) / COUNT(*), 1) as rls_coverage_percent
FROM pg_tables
WHERE schemaname = 'public';

-- =============================================================================
-- 6. POLICY COUNT PER TABLE
-- =============================================================================
SELECT 
  t.tablename,
  t.rowsecurity as rls_enabled,
  COUNT(p.policyname) as policy_count
FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = t.schemaname
WHERE t.schemaname = 'public'
GROUP BY t.tablename, t.rowsecurity
ORDER BY 
  policy_count ASC,
  t.tablename;

-- =============================================================================
-- USAGE INSTRUCTIONS:
-- =============================================================================
-- Run this script in Supabase SQL Editor to see:
-- 1. Which tables exist in your database
-- 2. Which have RLS enabled/disabled
-- 3. Which policies exist for each table
-- 4. Which tables need RLS policies added
--
-- Focus on tables shown in section 2 (no RLS) and section 4 (no policies)
-- These are security vulnerabilities that need immediate attention!
