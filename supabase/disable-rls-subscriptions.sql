-- Temporarily disable RLS on subscriptions table for testing
ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;

-- Check status
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'subscriptions';
