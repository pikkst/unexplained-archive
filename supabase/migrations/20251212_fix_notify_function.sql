-- FIXED: Update notify_case_update function to handle investigator_notes changes
-- and remove references to non-existent notify_on_resolution column

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

  -- If investigator_notes changed (NEW ADDITION!)
  IF OLD.investigator_notes IS DISTINCT FROM NEW.investigator_notes AND NEW.investigator_notes IS NOT NULL THEN
    -- Send notification to case owner
    INSERT INTO notifications (user_id, case_id, type, title, message, action_url)
    VALUES (
      v_case_owner_id,
      NEW.id,
      'case_update',
      'Investigator added notes to your case 📝',
      'Investigator ' || COALESCE(v_investigator_name, 'Unknown') || ' added notes to case: "' || v_case_title || '"',
      '/cases/' || NEW.id
    );

    -- Send notification to all followers
    FOR v_follower IN 
      SELECT user_id
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
    END LOOP;
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
          'Case updated 🔔',
          'Case "' || v_case_title || '" received an update from investigator',
          '/cases/' || NEW.id
        );
      END IF;
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

    -- Send notification to followers (FIXED: removed notify_on_resolution reference)
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

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ notify_case_update function updated successfully!';
END $$;
