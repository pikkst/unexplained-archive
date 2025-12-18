-- ========================================
-- Database Schema Check
-- ========================================
-- Run this to see what tables and columns exist

-- 1. List all tables in public schema
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Check transactions table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'transactions'
ORDER BY ordinal_position;

-- 3. Check wallets table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'wallets'
ORDER BY ordinal_position;

-- 4. Check profiles table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 5. Check webhook_events table structure (if exists)
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'webhook_events'
ORDER BY ordinal_position;

-- 6. Check platform_revenue table structure (if exists)
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'platform_revenue'
ORDER BY ordinal_position;

-- 7. List all columns that contain 'transaction' in their name
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND (column_name LIKE '%transaction%' OR table_name LIKE '%transaction%')
ORDER BY table_name, column_name;

-- 8. List all columns that contain 'deposit' or 'wallet' in their name
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND (column_name LIKE '%deposit%' OR column_name LIKE '%wallet%')
ORDER BY table_name, column_name;
