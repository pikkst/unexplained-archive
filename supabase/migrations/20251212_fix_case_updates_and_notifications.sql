-- FIX: Case updates and notifications
-- Problem: When investigator updates case, data not saved to DB and owner/followers don't get notifications
-- Date: 2025-12-12

-- ============================================================================
-- 1. ADD MISSING FIELDS TO CASES TABLE
-- ============================================================================

-- Add investigation_log field for storing case investigation data
ALTER TABLE public.cases 
  ADD COLUMN IF NOT EXISTS investigation_log JSONB DEFAULT '[]'::jsonb;

-- Add resolution_proposal field (for investigator's final report)
ALTER TABLE public.cases 
  ADD COLUMN IF NOT EXISTS resolution_proposal TEXT;

-- Add documents field (for attached documents)
ALTER TABLE public.cases 
  ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb;

-- Add investigator_notes field (legacy simple notes)
ALTER TABLE public.cases 
  ADD COLUMN IF NOT EXISTS investigator_notes TEXT;

COMMENT ON COLUMN public.cases.investigation_log IS 'JSONB array of investigator log entries with timestamp, content, and type';
COMMENT ON COLUMN public.cases.resolution_proposal IS 'Investigator final report/resolution text submitted for user review';
COMMENT ON COLUMN public.cases.documents IS 'JSONB array of attached documents with name, type, url, uploadedAt';
COMMENT ON COLUMN public.cases.investigator_notes IS 'Simple text notes from investigator (legacy field)';

-- ============================================================================
-- 2. FUNCTION: SEND NOTIFICATION ON CASE UPDATE
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_case_update()
RETURNS TRIGGER AS $$
DECLARE
  v_case_owner_id UUID;
  v_case_title TEXT;
  v_investigator_name TEXT;
  v_follower RECORD;
  v_update_type TEXT;
BEGIN
  -- Get case owner ID and title
  SELECT user_id, title INTO v_case_owner_id, v_case_title
  FROM cases WHERE id = NEW.id;

  -- Get investigator name
  SELECT username INTO v_investigator_name
  FROM profiles WHERE id = NEW.investigator_id OR id = NEW.assigned_investigator_id;

  -- Set update type
  v_update_type := 'case_update';
  
  -- If status changed to INVESTIGATING, notify that investigator started work
  IF OLD.status != NEW.status AND NEW.status = 'INVESTIGATING' THEN
    v_update_type := 'investigation_started';
    
    -- Send notification to case owner
    INSERT INTO notifications (user_id, case_id, type, title, message, action_url)
    VALUES (
      v_case_owner_id,
      NEW.id,
      v_update_type,
      'Investigator started working on your case! 🔍',
      'Investigator ' || COALESCE(v_investigator_name, 'Unknown') || ' started investigating your case: "' || v_case_title || '"',
      '/cases/' || NEW.id
    );
  END IF;

  -- If investigation_log changed (new notes added)
  IF OLD.investigation_log IS DISTINCT FROM NEW.investigation_log THEN
    -- Send notification to case owner
    INSERT INTO notifications (user_id, case_id, type, title, message, action_url)
    VALUES (
      v_case_owner_id,
      NEW.id,
      'case_update',
      'Investigator added new information to your case 📝',
      'Investigator ' || COALESCE(v_investigator_name, 'Unknown') || ' updated case: "' || v_case_title || '"',
      '/cases/' || NEW.id
    );

    -- Send notification to all followers
    FOR v_follower IN 
      SELECT user_id, guest_email 
      FROM case_followers 
      WHERE case_id = NEW.id 
        AND notify_on_update = TRUE
        AND user_id != v_case_owner_id -- Don't send duplicate to owner
    LOOP
      IF v_follower.user_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, case_id, type, title, message, action_url)
        VALUES (
          v_follower.user_id,
          NEW.id,
          'case_update',
          'Case updated 🔔',
          'Case "' || v_case_title || '" received an update from investigator',
          '/cases/' || NEW.id
        );
      END IF;
      -- TODO: Email sending for guests (can be done later)
    END LOOP;
  END IF;

  -- If documents changed (new documents added)
  IF OLD.documents IS DISTINCT FROM NEW.documents THEN
    -- Send notification to case owner
    INSERT INTO notifications (user_id, case_id, type, title, message, action_url)
    VALUES (
      v_case_owner_id,
      NEW.id,
      'case_update',
      'Investigator added new documents 📎',
      'New documents were added to case "' || v_case_title || '"',
      '/cases/' || NEW.id
    );

    -- Send notification to followers
    FOR v_follower IN 
      SELECT user_id 
      FROM case_followers 
      WHERE case_id = NEW.id 
        AND notify_on_update = TRUE
        AND user_id != v_case_owner_id
    LOOP
      IF v_follower.user_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, case_id, type, title, message, action_url)
        VALUES (
          v_follower.user_id,
          NEW.id,
          'case_update',
          'New documents added 📎',
          'New documents were added to case "' || v_case_title || '"',
          '/cases/' || NEW.id
        );
      END IF;
    END LOOP;
  END IF;

  -- If resolution_proposal changed (investigator submitted report)
  IF OLD.resolution_proposal IS DISTINCT FROM NEW.resolution_proposal AND NEW.resolution_proposal IS NOT NULL THEN
    -- Send notification to case owner
    INSERT INTO notifications (user_id, case_id, type, title, message, action_url)
    VALUES (
      v_case_owner_id,
      NEW.id,
      'resolution_submitted',
      'Investigator submitted final report! ✅',
      'Investigator ' || COALESCE(v_investigator_name, 'Unknown') || ' submitted resolution for case: "' || v_case_title || '". Please review and confirm.',
      '/cases/' || NEW.id
    );

    -- Send notification to followers
    FOR v_follower IN 
      SELECT user_id 
      FROM case_followers 
      WHERE case_id = NEW.id 
        AND notify_on_update = TRUE
        AND user_id != v_case_owner_id
    LOOP
      IF v_follower.user_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, case_id, type, title, message, action_url)
        VALUES (
          v_follower.user_id,
          NEW.id,
          'resolution_submitted',
          'Final report submitted ✅',
          'Final report for case "' || v_case_title || '" is ready',
          '/cases/' || NEW.id
        );
      END IF;
    END LOOP;
  END IF;

  -- If status changed to PENDING_REVIEW
  IF OLD.status != NEW.status AND NEW.status = 'PENDING_REVIEW' THEN
    -- Send notification to case owner
    INSERT INTO notifications (user_id, case_id, type, title, message, action_url)
    VALUES (
      v_case_owner_id,
      NEW.id,
      'resolution_submitted',
      'Case awaits your review! 👀',
      'Investigator completed investigation for case: "' || v_case_title || '". Please review the results and decide.',
      '/cases/' || NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. ADD TRIGGER TO DETECT CASE UPDATES
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_notify_case_update ON cases;

CREATE TRIGGER trigger_notify_case_update
  AFTER UPDATE ON cases
  FOR EACH ROW
  WHEN (
    OLD.investigation_log IS DISTINCT FROM NEW.investigation_log OR
    OLD.documents IS DISTINCT FROM NEW.documents OR
    OLD.resolution_proposal IS DISTINCT FROM NEW.resolution_proposal OR
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.investigator_notes IS DISTINCT FROM NEW.investigator_notes
  )
  EXECUTE FUNCTION notify_case_update();

COMMENT ON TRIGGER trigger_notify_case_update ON cases IS 
  'Sends notifications to case owner and followers when investigator updates the case';

-- ============================================================================
-- 4. FUNCTION: INVESTIGATOR ASSIGNMENT NOTIFICATION
-- ============================================================================

CREATE OR REPLACE FUNCTION notify_investigator_assigned()
RETURNS TRIGGER AS $$
DECLARE
  v_case_title TEXT;
  v_case_owner_id UUID;
  v_investigator_name TEXT;
BEGIN
  -- If investigator was assigned for the first time
  IF OLD.investigator_id IS NULL AND NEW.investigator_id IS NOT NULL 
     OR OLD.assigned_investigator_id IS NULL AND NEW.assigned_investigator_id IS NOT NULL THEN
    
    -- Get case data
    SELECT title, user_id INTO v_case_title, v_case_owner_id
    FROM cases WHERE id = NEW.id;

    -- Get investigator name
    SELECT username INTO v_investigator_name
    FROM profiles WHERE id = COALESCE(NEW.investigator_id, NEW.assigned_investigator_id);

    -- Send notification to case owner
    INSERT INTO notifications (user_id, case_id, type, title, message, action_url)
    VALUES (
      v_case_owner_id,
      NEW.id,
      'investigator_assigned',
      'Investigator assigned to your case! 🎯',
      'Investigator ' || COALESCE(v_investigator_name, 'Unknown') || ' accepted your case: "' || v_case_title || '"',
      '/cases/' || NEW.id
    );

    -- Automatically add case owner as follower (if not already)
    INSERT INTO case_followers (case_id, user_id, notify_on_update, notify_on_comments, notify_on_resolution)
    VALUES (NEW.id, v_case_owner_id, TRUE, TRUE, TRUE)
    ON CONFLICT DO NOTHING;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger
DROP TRIGGER IF EXISTS trigger_notify_investigator_assigned ON cases;

CREATE TRIGGER trigger_notify_investigator_assigned
  AFTER UPDATE ON cases
  FOR EACH ROW
  WHEN (
    (OLD.investigator_id IS DISTINCT FROM NEW.investigator_id AND NEW.investigator_id IS NOT NULL) OR
    (OLD.assigned_investigator_id IS DISTINCT FROM NEW.assigned_investigator_id AND NEW.assigned_investigator_id IS NOT NULL)
  )
  EXECUTE FUNCTION notify_investigator_assigned();

-- ============================================================================
-- 5. INDEXES FOR PERFORMANCE IMPROVEMENT
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_cases_investigation_log ON cases USING GIN (investigation_log);
CREATE INDEX IF NOT EXISTS idx_cases_documents ON cases USING GIN (documents);
CREATE INDEX IF NOT EXISTS idx_notifications_user_case ON notifications(user_id, case_id, read_at);

-- ============================================================================
-- 6. COMMENTS
-- ============================================================================

COMMENT ON FUNCTION notify_case_update() IS 
  'Sends notifications when investigator updates case - logs, documents, or proposal';

COMMENT ON FUNCTION notify_investigator_assigned() IS 
  'Sends notification to case owner when investigator is assigned to case';

-- Successfully installed! ✅
