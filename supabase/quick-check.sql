-- KIIRE KONTROLL - kopeeri tulemus siia tagasi

-- 1. Funktsiooni parameetrid
SELECT pg_get_function_arguments(p.oid) as send_message_params
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'send_message';

-- 2. Tabeli veerud
SELECT string_agg(column_name, ', ' ORDER BY ordinal_position) as messages_columns
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'messages';

-- 3. Kas attachment_url eksisteerib?
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'messages' 
    AND column_name = 'attachment_url'
) as has_attachment_url;
