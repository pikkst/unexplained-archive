-- =====================================================
-- CHECK AND FIX NOTIFICATIONS SYSTEM
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. CHECK IF NOTIFICATIONS TABLE EXISTS
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'notifications'
) as notifications_table_exists;

-- 2. CREATE NOTIFICATIONS TABLE IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2B. ADD MISSING COLUMNS IF TABLE ALREADY EXISTS
DO $$ 
BEGIN
  -- Add data column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications' 
    AND column_name = 'data'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN data JSONB DEFAULT '{}'::jsonb;
    RAISE NOTICE 'Added data column to notifications table';
  END IF;

  -- Add action_url column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications' 
    AND column_name = 'action_url'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN action_url TEXT;
    RAISE NOTICE 'Added action_url column to notifications table';
  END IF;
END $$;

-- 3. CREATE INDEXES FOR BETTER PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON public.notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read_at) WHERE read_at IS NULL;

-- 4. ENABLE RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 5. DROP OLD POLICIES IF THEY EXIST
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can view all notifications" ON public.notifications;

-- 6. CREATE NEW RLS POLICIES

-- Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can update their own notifications (for marking as read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Service role and Edge Functions can insert notifications
CREATE POLICY "Service role can insert notifications"
ON public.notifications
FOR INSERT
TO service_role
WITH CHECK (true);

-- Admins can insert notifications for any user
CREATE POLICY "Admins can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Admins can view all notifications
CREATE POLICY "Admins can view all notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 7. CREATE HELPER FUNCTIONS

-- Drop existing functions first
DROP FUNCTION IF EXISTS mark_notification_read(UUID, UUID);
DROP FUNCTION IF EXISTS mark_all_notifications_read(UUID);

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(
  p_notification_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.notifications
  SET read_at = NOW()
  WHERE id = p_notification_id 
    AND user_id = p_user_id
    AND read_at IS NULL;
  
  RETURN FOUND;
END;
$$;

-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read(
  p_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.notifications
  SET read_at = NOW()
  WHERE user_id = p_user_id
    AND read_at IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- 8. CHECK EXISTING NOTIFICATIONS
SELECT 
  n.id,
  n.user_id,
  p.full_name as user_name,
  p.username,
  n.type,
  n.title,
  n.message,
  n.read_at,
  n.created_at,
  CASE 
    WHEN n.read_at IS NULL THEN 'UNREAD'
    ELSE 'READ'
  END as status
FROM public.notifications n
LEFT JOIN public.profiles p ON n.user_id = p.id
ORDER BY n.created_at DESC
LIMIT 20;

-- 9. COUNT NOTIFICATIONS BY STATUS
SELECT 
  COUNT(*) FILTER (WHERE read_at IS NULL) as unread_count,
  COUNT(*) FILTER (WHERE read_at IS NOT NULL) as read_count,
  COUNT(*) as total_count
FROM public.notifications;

-- 10. COUNT NOTIFICATIONS BY USER
SELECT 
  p.full_name,
  p.username,
  COUNT(*) FILTER (WHERE n.read_at IS NULL) as unread,
  COUNT(*) FILTER (WHERE n.read_at IS NOT NULL) as read,
  COUNT(*) as total
FROM public.notifications n
JOIN public.profiles p ON n.user_id = p.id
GROUP BY p.id, p.full_name, p.username
ORDER BY unread DESC, total DESC;

-- 11. CHECK MASS NOTIFICATIONS TABLE
SELECT 
  id,
  target_group_code,
  target_user_ids,
  subject,
  status,
  sent_count,
  failed_count,
  created_at,
  started_at,
  completed_at
FROM public.mass_notifications
ORDER BY created_at DESC
LIMIT 10;

-- 12. CHECK IF ANY NOTIFICATIONS WERE ACTUALLY CREATED
SELECT COUNT(*) as total_notifications_in_db FROM public.notifications;

-- 13. VIEW ALL NOTIFICATIONS (if any exist)
SELECT * FROM public.notifications ORDER BY created_at DESC;

-- =====================================================
-- FIX PENDING MASS NOTIFICATIONS
-- These notifications were created but never sent
-- =====================================================

-- Option 1: Delete pending notifications that were never sent
-- Uncomment to delete:
-- DELETE FROM public.mass_notifications WHERE status = 'pending';

-- Option 2: Update them to 'failed' status for record keeping
-- UPDATE public.mass_notifications 
-- SET status = 'failed', 
--     completed_at = NOW()
-- WHERE status = 'pending';

-- =====================================================
-- MANUAL TEST: Send a test notification to yourself
-- =====================================================

-- Step 1: Get your user ID
SELECT id, username, full_name FROM public.profiles WHERE role = 'admin' LIMIT 1;

-- Step 2: Insert a test notification (READY TO RUN)
INSERT INTO public.notifications (user_id, type, title, message)
VALUES (
  'bad181a6-8cc0-4416-945a-04e951a9d9a6',
  'new_message',
  'Test Notification 🎉',
  'If you see this in your inbox, the notification system is working!'
);

-- Step 3: Verify it was inserted
SELECT 
  id, 
  user_id, 
  type, 
  title, 
  message, 
  read_at,
  created_at
FROM public.notifications 
WHERE user_id = 'bad181a6-8cc0-4416-945a-04e951a9d9a6' 
ORDER BY created_at DESC 
LIMIT 5;
