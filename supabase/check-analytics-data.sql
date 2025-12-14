-- Check analytics_events table structure

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'analytics_events'
ORDER BY ordinal_position;

-- Check if we have any data
SELECT 
  COUNT(*) as total_events,
  COUNT(DISTINCT session_id) as unique_sessions,
  COUNT(DISTINCT visitor_id) as unique_visitors,
  MIN(created_at) as oldest_event,
  MAX(created_at) as newest_event
FROM analytics_events;

-- Check session data quality
SELECT 
  session_id,
  COUNT(*) as page_views,
  MIN(created_at) as session_start,
  MAX(created_at) as session_end,
  EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) as duration_seconds
FROM analytics_events
WHERE session_id IS NOT NULL
GROUP BY session_id
ORDER BY session_start DESC
LIMIT 10;
