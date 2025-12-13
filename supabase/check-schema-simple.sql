-- ========================================
-- SIMPLE DATABASE SCHEMA CHECK
-- Kopeeri see Supabase SQL editorisse
-- ========================================

-- 1. Kontrolli send_message funktsiooni parameetreid
SELECT 
    'send_message function parameters:' as info,
    pg_get_function_arguments(p.oid) as parameters
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'send_message';

-- 2. Kontrolli messages tabeli veerge
SELECT 
    'messages table columns:' as info,
    string_agg(column_name, ', ' ORDER BY ordinal_position) as columns
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'messages';

-- 3. Kontrolli kas attachment_url veerg eksisteerib
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'messages' 
            AND column_name = 'attachment_url'
        ) THEN '✓ attachment_url veerg EKSISTEERIB'
        ELSE '✗ attachment_url veerg PUUDUB'
    END as status;

-- 4. Kontrolli subject veergu
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'messages' 
            AND column_name = 'subject'
        ) THEN '✓ subject veerg EKSISTEERIB'
        ELSE '✗ subject veerg PUUDUB'
    END as status;

-- 5. Näita kõik sõnumitega seotud funktsioonid
SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as parameters
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND (p.proname LIKE '%message%' OR p.proname LIKE '%notification%')
ORDER BY p.proname;
