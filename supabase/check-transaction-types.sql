-- Check allowed transaction types
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'transactions'::regclass
  AND conname LIKE '%transaction_type%';
