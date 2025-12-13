-- AUTO-FOLLOW: Case owner automatically follows their own cases
-- This ensures case owners receive notifications when investigators update their cases

-- ============================================================================
-- 1. CREATE TRIGGER TO AUTO-FOLLOW NEW CASES
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_follow_own_case()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new case is created, automatically add the owner to case_followers
  INSERT INTO case_followers (case_id, user_id, notify_on_update)
  VALUES (NEW.id, NEW.user_id, TRUE)
  ON CONFLICT (case_id, user_id) DO NOTHING; -- Skip if already exists
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trigger_auto_follow_own_case ON cases;

-- Create trigger that fires after new case insertion
CREATE TRIGGER trigger_auto_follow_own_case
  AFTER INSERT ON cases
  FOR EACH ROW
  EXECUTE FUNCTION auto_follow_own_case();

-- ============================================================================
-- 2. BACKFILL: Add existing case owners to case_followers
-- ============================================================================

-- For all existing cases, ensure the owner is in case_followers
INSERT INTO case_followers (case_id, user_id, notify_on_update)
SELECT 
  c.id as case_id,
  c.user_id,
  TRUE as notify_on_update
FROM cases c
WHERE NOT EXISTS (
  SELECT 1 FROM case_followers cf 
  WHERE cf.case_id = c.id AND cf.user_id = c.user_id
)
ON CONFLICT (case_id, user_id) DO NOTHING;

-- Log success
DO $$ 
BEGIN 
  RAISE NOTICE 'Auto-follow system installed. Case owners will now automatically follow their cases.';
END $$;
