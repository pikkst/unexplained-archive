-- Check what columns exist in forum_threads table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'forum_threads'
ORDER BY ordinal_position;
