-- Check what status values are allowed in transactions table
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'transactions'::regclass
AND conname LIKE '%status%';

-- Also check if there's an enum type
SELECT 
  t.typname,
  e.enumlabel
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname LIKE '%transaction%status%'
   OR t.typname LIKE '%status%'
ORDER BY t.typname, e.enumsortorder;
