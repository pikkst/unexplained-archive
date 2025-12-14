-- Delete all test forum posts and threads
-- This will remove all existing forum data

-- First, delete all forum posts (optional, CASCADE will handle this)
DELETE FROM forum_posts;

-- Then delete all forum threads (this will cascade delete all posts)
DELETE FROM forum_threads;

-- Reset sequences if they exist
-- This ensures IDs start fresh (optional)

-- Verify deletion
SELECT 
  (SELECT COUNT(*) FROM forum_threads) as threads_count,
  (SELECT COUNT(*) FROM forum_posts) as posts_count;
