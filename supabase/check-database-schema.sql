-- ========================================
-- DATABASE SCHEMA DIAGNOSTICS
-- Kontrolli andmebaasi praegust skeemi
-- Käivita Supabase SQL editoris
-- ========================================

-- 1. CHECKING send_message FUNCTION
SELECT 
    '=== send_message FUNCTION ===' as check_section,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as parameters
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'send_message';

-- 2. CHECKING messages TABLE STRUCTURE
SELECT 
    '=== messages TABLE COLUMNS ===' as check_section,
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'messages'
ORDER BY ordinal_position;

-- 3. CHECK IF REQUIRED COLUMNS EXIST
SELECT 
    '=== COLUMN EXISTENCE CHECK ===' as check_section,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'attachment_url'
    ) THEN '✓ attachment_url EKSISTEERIB' ELSE '✗ attachment_url PUUDUB' END as attachment_url_status,
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'subject'
    ) THEN '✓ subject EKSISTEERIB' ELSE '✗ subject PUUDUB' END as subject_status;

-- 4. CHECKING messages TABLE INDEXES
SELECT 
    '=== messages INDEXES ===' as check_section,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename = 'messages';

-- 5. CHECKING RLS POLICIES ON messages
SELECT 
    '=== messages RLS POLICIES ===' as check_section,
    policyname,
    cmd as operation,
    CASE WHEN permissive = 'PERMISSIVE' THEN 'YES' ELSE 'NO' END as permissive
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'messages';

-- 6. CHECKING OTHER MESSAGE FUNCTIONS
SELECT 
    '=== OTHER MESSAGE FUNCTIONS ===' as check_section,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as parameters
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname IN ('get_case_messages', 'mark_message_read')
ORDER BY p.proname;

-- 7. CHECKING notifications TABLE
SELECT 
    '=== notifications TABLE ===' as check_section,
    column_name, 
    data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'notifications'
ORDER BY ordinal_position;

-- 8. DATA COUNT CHECK
SELECT 
    '=== DATA COUNTS ===' as check_section,
    'messages' as table_name,
    COUNT(*) as row_count
FROM messages
UNION ALL
SELECT 
    '=== DATA COUNTS ===' as check_section,
    'notifications' as table_name,
    COUNT(*) as row_count
FROM notifications;
