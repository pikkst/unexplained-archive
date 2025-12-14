# Admin Function Security Audit

## Overview
All `SECURITY DEFINER` functions bypass Row Level Security (RLS) and run with elevated privileges. These functions MUST verify that the caller has admin role before executing sensitive operations.

## Critical Functions to Verify

### 1. admin_resolve_dispute()
**Location**: `create-admin-dispute-resolution.sql`
**Status**: ⚠️ NEEDS VERIFICATION
**Action**: Check if function validates `p_admin_id` has admin role
```sql
-- Should have:
IF NOT EXISTS (
  SELECT 1 FROM profiles 
  WHERE id = p_admin_id 
  AND role = 'admin'
) THEN
  RAISE EXCEPTION 'Unauthorized: Admin role required';
END IF;
```

### 2. process_webhook_event()
**Location**: `add-webhook-idempotency.sql` line 37
**Status**: ✅ SAFE (Service role only, not user-callable)
**Purpose**: Prevent webhook replay attacks

### 3. check_withdrawal_rate_limit()
**Location**: `add-withdrawal-rate-limiting.sql` line 19
**Status**: ✅ SAFE (User checks own rate limit)
**Purpose**: Enforce 3 withdrawals/day limit

### 4. apply_case_template()
**Location**: `create-case-templates-table.sql` line 154
**Status**: ⚠️ NEEDS VERIFICATION
**Action**: Verify user can only apply templates to their own cases

### 5. send_message()
**Location**: `fix-send-message-function.sql` line 25
**Status**: ⚠️ NEEDS VERIFICATION
**Action**: Verify sender_id = auth.uid() before sending

### 6. mark_messages_as_read()
**Location**: `fix-send-message-function.sql` line 107
**Status**: ⚠️ NEEDS VERIFICATION
**Action**: Verify only recipient can mark as read

### 7. get_unread_message_count()
**Location**: `fix-send-message-function.sql` line 141
**Status**: ✅ SAFE (User sees own count only)

### 8. record_analytics_event()
**Location**: `setup-analytics-seo-complete.sql`
**Status**: ⚠️ NEEDS VERIFICATION
**Action**: Check for rate limiting (prevent spam)

### 9. get_pending_investigator_applications()
**Location**: Referenced in AdminDashboard.tsx line 93
**Status**: ⚠️ NEEDS VERIFICATION
**Action**: Must verify caller has admin role

### 10. get_all_investigators()
**Location**: Referenced in AdminDashboard.tsx line 99
**Status**: ⚠️ NEEDS VERIFICATION
**Action**: Must verify caller has admin role

## Security Checklist

- [ ] Verify admin_resolve_dispute() checks admin role
- [ ] Verify get_pending_investigator_applications() checks admin role
- [ ] Verify get_all_investigators() checks admin role
- [ ] Verify apply_case_template() validates case ownership
- [ ] Verify send_message() validates sender identity
- [ ] Verify mark_messages_as_read() validates recipient identity
- [ ] Add rate limiting to record_analytics_event()
- [ ] Audit all remaining SECURITY DEFINER functions

## Recommended Fix Pattern

For ALL admin functions, add this at the start:
```sql
CREATE OR REPLACE FUNCTION admin_function_name(...)
RETURNS ...
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- CRITICAL: Verify admin role
  SELECT role = 'admin' INTO v_is_admin
  FROM profiles
  WHERE id = auth.uid();
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Admin role required';
  END IF;
  
  -- Rest of function logic...
END;
$$;
```

## Testing Commands

```sql
-- Test as regular user (should fail)
SELECT admin_resolve_dispute(
  '<case_id>',
  '<user_id>',  -- Non-admin user ID
  'test',
  true
);

-- Test as admin (should succeed)
SELECT admin_resolve_dispute(
  '<case_id>',
  '<admin_user_id>',  -- Admin user ID
  'test',
  true
);
```

## Priority: CRITICAL 🔴
Without proper role verification, regular users can call admin functions and execute privileged operations (refunds, dispute resolutions, etc).
