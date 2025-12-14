-- Check if we're collecting analytics data
SELECT 
  COUNT(*) as total_events,
  COUNT(DISTINCT visitor_id) as unique_visitors,
  COUNT(DISTINCT session_id) as sessions,
  MAX(created_at) as last_event
FROM analytics_events 
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Recent page views
SELECT 
  page_path,
  COUNT(*) as views,
  COUNT(DISTINCT visitor_id) as unique_visitors
FROM analytics_events 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY page_path
ORDER BY views DESC
LIMIT 10;
