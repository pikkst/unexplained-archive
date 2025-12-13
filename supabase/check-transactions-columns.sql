-- Check what columns exist in transactions table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'transactions';
