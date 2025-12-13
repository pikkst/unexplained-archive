-- DEBUG: Check notification system for case updates
-- Run this to see if triggers, followers, and notifications are working correctly

-- ============================================================================
-- 1. CHECK IF TRIGGERS EXIST
-- ============================================================================
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name IN ('trigger_notify_case_update', 'trigger_auto_follow_own_case', 'trigger_notify_investigator_assigned')
ORDER BY trigger_name;

-- ============================================================================
-- 2. CHECK CASE FOLLOWERS FOR SPECIFIC CASE
-- ============================================================================
-- Replace '3b2413c5-9fa5-4609-aaf8-0f8444ee9734' with your case ID
SELECT 
  cf.case_id,
  cf.user_id,
  p.username,
  cf.notify_on_update,
  cf.followed_at
FROM case_followers cf
LEFT JOIN profiles p ON p.id = cf.user_id
WHERE cf.case_id = '3b2413c5-9fa5-4609-aaf8-0f8444ee9734'
ORDER BY cf.followed_at;

-- ============================================================================
-- 3. CHECK NOTIFICATIONS FOR CASE
-- ============================================================================
SELECT 
  n.id,
  n.user_id,
  p.username,
  n.type,
  n.title,
  n.message,
  n.read_at,
  CASE WHEN n.read_at IS NULL THEN 'UNREAD ⭐' ELSE 'READ ✓' END as status,
  n.created_at
FROM notifications n
LEFT JOIN profiles p ON p.id = n.user_id
WHERE n.case_id = '3b2413c5-9fa5-4609-aaf8-0f8444ee9734'
ORDER BY n.created_at DESC;

-- ============================================================================
-- 4. CHECK CASE OWNER AND INVESTIGATOR
-- ============================================================================
SELECT 
  c.id as case_id,
  c.title,
  c.user_id as owner_id,
  owner.username as owner_username,
  c.assigned_investigator_id,
  inv.username as investigator_username,
  c.status,
  c.resolution_proposal,
  c.investigator_notes,
  c.updated_at
FROM cases c
LEFT JOIN profiles owner ON owner.id = c.user_id
LEFT JOIN profiles inv ON inv.id = c.assigned_investigator_id
WHERE c.id = '3b2413c5-9fa5-4609-aaf8-0f8444ee9734';

-- ============================================================================
-- 5. CHECK IF AUTO-FOLLOW TRIGGER WORKS (Test on new case creation)
-- ============================================================================
-- This will show all cases and whether owner is following
SELECT 
  c.id,
  c.title,
  c.user_id as owner_id,
  p.username as owner_username,
  CASE 
    WHEN cf.case_id IS NOT NULL THEN 'YES ✅'
    ELSE 'NO ❌'
  END as owner_following
FROM cases c
LEFT JOIN profiles p ON p.id = c.user_id
LEFT JOIN case_followers cf ON cf.case_id = c.id AND cf.user_id = c.user_id
ORDER BY c.created_at DESC
LIMIT 10;
