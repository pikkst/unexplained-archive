-- Add cancel_at_period_end column to subscriptions table

ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN subscriptions.cancel_at_period_end IS 'Whether subscription will be canceled at end of period';
