-- Add webhook idempotency protection against replay attacks
-- Prevents processing the same webhook event multiple times

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB,
  
  -- Indexes
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_id ON webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON webhook_events(created_at DESC);

-- Auto-cleanup old events (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM webhook_events 
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- Function to check and record webhook event (idempotency)
CREATE OR REPLACE FUNCTION public.process_webhook_event(
  p_stripe_event_id TEXT,
  p_event_type TEXT,
  p_payload JSONB
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_already_processed BOOLEAN;
BEGIN
  -- Check if event already processed
  SELECT EXISTS(
    SELECT 1 FROM webhook_events WHERE stripe_event_id = p_stripe_event_id
  ) INTO v_already_processed;
  
  IF v_already_processed THEN
    -- Event already processed - prevent replay attack
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'duplicate_event',
      'message', 'This webhook event has already been processed'
    );
  END IF;
  
  -- Record the event
  INSERT INTO webhook_events (stripe_event_id, event_type, payload)
  VALUES (p_stripe_event_id, p_event_type, p_payload);
  
  RETURN jsonb_build_object('success', true, 'message', 'Event recorded');
END;
$$;

-- Enable RLS
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Only service role can access webhook events
CREATE POLICY "Service role only" ON webhook_events
  FOR ALL USING (false); -- Users can't access at all

COMMENT ON TABLE webhook_events IS 'Idempotency table to prevent webhook replay attacks';
