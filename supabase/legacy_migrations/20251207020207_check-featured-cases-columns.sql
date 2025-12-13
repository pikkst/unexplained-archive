-- Check featured_cases table structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'featured_cases'
ORDER BY ordinal_position;
