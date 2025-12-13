# Profile Creation Issue - Fix Guide

## Problem
New users are created in `auth.users` but their profile is not automatically created in the `profiles` table, causing "Profile not found after retries" errors.

## Root Cause
The database trigger `on_auth_user_created` is either:
1. Not installed
2. Not enabled
3. Failing silently

## Solution

### Step 1: Run the Setup Script

Execute this SQL file in your Supabase SQL Editor:

```bash
setup-auto-profile-creation.sql
```

This script will:
- ✅ Create/update the `handle_new_user()` function
- ✅ Drop and recreate the trigger
- ✅ Set up proper RLS policies
- ✅ Grant necessary permissions
- ✅ Verify the configuration

### Step 2: Verify Installation

After running the script, you should see output like:

```
═══════════════════════════════════════════════
     USER SIGNUP CONFIGURATION STATUS
═══════════════════════════════════════════════

✅ Profile Table RLS: ENABLED
   └─ Active Policies: 3

✅ Auto-Profile Trigger: ENABLED ✅

🎉 All systems ready! New users will:
   1. Auto-create profile on signup
   2. Receive welcome notification
   3. Have full access to their profile
```

### Step 3: Test with New User

1. Create a new test user through the signup form
2. Check the browser console - should NOT see "Profile not found" errors
3. Verify the profile was created:

```sql
SELECT * FROM profiles WHERE username = 'test_user';
```

## What the Trigger Does

When a new user signs up via `auth.signUp()`:

1. **User Created**: Supabase Auth creates entry in `auth.users`
2. **Trigger Fires**: `on_auth_user_created` trigger executes
3. **Profile Created**: `handle_new_user()` function:
   - Generates unique username from email
   - Creates profile in `profiles` table
   - Sets default values (role='user', reputation=0)
   - Handles conflicts (updates if profile exists)
4. **Welcome Message**: Separate trigger sends welcome notification

## Troubleshooting

### Check if Trigger Exists

```sql
SELECT tgname, tgenabled, tgrelid::regclass 
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';
```

Expected result:
- `tgname`: on_auth_user_created
- `tgenabled`: O (enabled)
- `tgrelid`: auth.users

### Check if Function Exists

```sql
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'handle_new_user';
```

Should return the function definition.

### View Recent Auth Users

```sql
SELECT 
  au.id,
  au.email,
  au.created_at as auth_created,
  p.username,
  p.created_at as profile_created
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
ORDER BY au.created_at DESC
LIMIT 10;
```

This shows if profiles are being created alongside auth users.

### Manual Profile Creation (Emergency)

If a user was created but has no profile:

```sql
INSERT INTO profiles (id, username, full_name, role, reputation)
VALUES (
  'USER_ID_HERE',
  'username_here',
  '',
  'user',
  0
)
ON CONFLICT (id) DO NOTHING;
```

### Check Trigger Logs

Supabase logs trigger errors. Check the logs in:
- Supabase Dashboard → Database → Logs
- Look for: "Error in handle_new_user"

## Common Issues

### Issue: Trigger Not Firing

**Cause**: Trigger might be disabled or on wrong schema

**Fix**:
```sql
-- Enable trigger
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

-- Or recreate it
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();
```

### Issue: Username Conflicts

**Cause**: Two users with same email prefix

**Solution**: The trigger now auto-generates unique usernames by appending random suffix if needed.

### Issue: RLS Blocking Insert

**Cause**: Policies too restrictive

**Fix**: The script creates proper policies:
```sql
-- This allows user to create their own profile during signup
CREATE POLICY "Users can insert own profile" 
  ON profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);
```

## After Fix

Once the trigger is working:

1. ✅ New users automatically get profiles
2. ✅ No more "Profile not found" errors
3. ✅ Users can immediately access their profile page
4. ✅ Welcome notifications are sent automatically

## Related Files

- `setup-auto-profile-creation.sql` - Main setup script
- `fix-rls-profiles.sql` - Original RLS fix (superseded)
- `setup-mass-notifications.sql` - Welcome message trigger
- `src/contexts/AuthContext.tsx` - Frontend auth handling

## Prevention

To prevent this issue in the future:

1. Always run database setup scripts in correct order
2. Test signup flow after any auth schema changes
3. Monitor Supabase logs for trigger errors
4. Keep backups of working trigger code
