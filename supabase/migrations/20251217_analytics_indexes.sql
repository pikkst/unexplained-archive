-- Add indexes for analytics_events table to optimize share tracking queries
-- Run this in Supabase SQL Editor

-- GIN index for JSONB metadata queries (CRITICAL for performance)
CREATE INDEX IF NOT EXISTS idx_analytics_events_metadata 
  ON analytics_events USING GIN (metadata);

-- Index for event_type filtering
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type 
  ON analytics_events(event_type);

-- Composite index for common query pattern (event_type + date)
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_created 
  ON analytics_events(event_type, created_at DESC);

-- Index for user-specific queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_created 
  ON analytics_events(user_id, created_at DESC) 
  WHERE user_id IS NOT NULL;

-- Partial index for referred visits (most common query)
CREATE INDEX IF NOT EXISTS idx_analytics_events_referred_views 
  ON analytics_events(created_at DESC, metadata)
  WHERE event_type = 'case_view' AND metadata @> '{"is_referred": true}';

-- Comment for documentation
COMMENT ON INDEX idx_analytics_events_metadata IS 'GIN index for fast JSONB metadata queries (share_id, case_id, etc)';
COMMENT ON INDEX idx_analytics_events_type_created IS 'Composite index for event type filtering with time range';
COMMENT ON INDEX idx_analytics_events_referred_views IS 'Optimized for referred visitor tracking queries';
