-- Check the latest mass notification attempt
SELECT 
  id,
  target_group_code,
  subject,
  message,
  delivery_method,
  notification_type,
  status,
  sent_count,
  failed_count,
  created_at,
  started_at,
  completed_at
FROM public.mass_notifications
ORDER BY created_at DESC
LIMIT 1;

-- Check who is in pro_subscribers group
SELECT * FROM get_subscription_group_members('pro_subscribers');

-- Check if any notifications were created in the last hour
SELECT 
  COUNT(*) as notifications_created_last_hour
FROM public.notifications
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Show all notifications from last hour
SELECT 
  n.*,
  p.username,
  p.full_name
FROM public.notifications n
LEFT JOIN public.profiles p ON n.user_id = p.id
WHERE n.created_at > NOW() - INTERVAL '1 hour'
ORDER BY n.created_at DESC;
