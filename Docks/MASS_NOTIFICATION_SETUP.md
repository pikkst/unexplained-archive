# Mass Notification System Setup

This document explains the mass notification system that allows admins to send notifications to user groups and automatically welcomes new users.

## Features

### 1. **Mass Notifications (Admin Only)**
Admins can send notifications to specific user groups:
- **All Users** - Every registered user
- **All Investigators** - Users with investigator role
- **Free Tier Users** - Users without active subscription
- **Pro Subscribers** - Users with Pro subscription
- **Premium Subscribers** - Users with Premium subscription

### 2. **Automatic Welcome Messages**
New users automatically receive a welcome notification explaining:
- Platform features and capabilities
- How to explore cases
- How to become an investigator
- Community features
- AI tools and premium options

## Database Setup

### Step 1: Run the SQL Setup Script

Execute the following SQL file in your Supabase SQL Editor:

```bash
setup-mass-notifications.sql
```

This creates:
- `send_mass_notification()` - Function for admins to send bulk notifications
- `send_welcome_notification()` - Function to send welcome message
- `send_user_notification()` - Helper function for individual notifications
- `trigger_welcome_notification()` - Trigger that fires on new user creation
- `on_user_created_welcome` - Trigger attached to profiles table

### Step 2: Verify Trigger Installation

Check that the trigger is active:

```sql
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname = 'on_user_created_welcome';
```

Should return the trigger with `tgenabled = 'O'` (enabled).

### Step 3: Test Welcome Message

Create a test user and verify they receive the welcome notification:

```sql
-- Check notifications for a specific user
SELECT * FROM notifications 
WHERE user_id = 'USER_ID_HERE' 
AND title LIKE 'Welcome%';
```

## Admin Panel Usage

### Accessing Mass Notifications

1. Log in as an admin user
2. Navigate to `/admin`
3. Scroll to the "Mass Notifications" panel

### Sending Mass Notifications

1. **Select Recipient Groups**: Click on one or more user groups
   - The system shows the count of users in each group
   - Total recipients are calculated automatically
   
2. **Enter Notification Title**: 
   - Maximum 100 characters
   - Should be clear and concise
   
3. **Write Message**: 
   - Maximum 500 characters
   - Support for line breaks
   
4. **Add Action URL (Optional)**:
   - Examples: `/explore`, `/profile`, `/forum`
   - Users will be redirected here when clicking the notification
   
5. **Click "Send"**:
   - Confirmation shows number of notifications sent
   - Users receive notifications in their notification bell

## Welcome Message Customization

To customize the welcome message, edit the SQL function:

```sql
-- Edit the message in setup-mass-notifications.sql
CREATE OR REPLACE FUNCTION send_welcome_notification(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    INSERT INTO notifications (
        user_id,
        type,
        title,
        message,  -- Edit this content
        action_url
    )
    VALUES (
        p_user_id,
        'case_follow_confirm',
        'Welcome to Unexplained Archive!',  -- Edit title
        'Your custom welcome message here...',  -- Edit message
        '/explore'  -- Edit redirect URL
    );
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Security

### Admin Verification
The `send_mass_notification()` function checks that the caller has admin privileges:

```sql
SELECT role = 'admin' INTO v_is_admin
FROM profiles
WHERE id = p_admin_id;
```

Non-admin users will receive an "Unauthorized" error.

### Function Permissions
All functions use `SECURITY DEFINER` to execute with elevated privileges, but include proper authorization checks.

## Testing

### Test Mass Notification

```sql
-- As admin, send test notification to free tier users
SELECT send_mass_notification(
    'ADMIN_USER_ID'::UUID,
    ARRAY['free_tier']::TEXT[],
    'Test Notification',
    'This is a test message',
    '/explore'
);
```

### Test Welcome Message

```sql
-- Manually trigger welcome message for existing user
SELECT send_welcome_notification('USER_ID'::UUID);
```

### Check Notification Delivery

```sql
-- See all notifications sent in last hour
SELECT 
    n.title,
    n.message,
    p.username as recipient,
    n.created_at
FROM notifications n
JOIN profiles p ON n.user_id = p.id
WHERE n.created_at > NOW() - INTERVAL '1 hour'
ORDER BY n.created_at DESC;
```

## Troubleshooting

### Welcome messages not sending

1. Check if trigger exists:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'on_user_created_welcome';
```

2. Check trigger function:
```sql
\df trigger_welcome_notification
```

3. Test manually:
```sql
SELECT send_welcome_notification('existing_user_id'::UUID);
```

### Mass notifications failing

1. Verify admin role:
```sql
SELECT role FROM profiles WHERE id = 'YOUR_USER_ID';
```

2. Check function exists:
```sql
\df send_mass_notification
```

3. Check for SQL errors in Supabase logs

## UI Components

- **MassNotificationPanel.tsx** - Main admin interface for sending notifications
- **AdminDashboard.tsx** - Includes the MassNotificationPanel component
- **Inbox.tsx** - Users view their notifications here
- **Navbar.tsx** - Shows notification bell with unread count

## Database Schema

The system uses the existing `notifications` table:

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id),
    case_id UUID REFERENCES cases(id),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    action_url TEXT,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Future Enhancements

Potential improvements:
- Schedule notifications for future delivery
- Rich text formatting in messages
- Attach images or files to notifications
- Email notifications for important messages
- User notification preferences (mute certain types)
- Notification templates for common messages
- A/B testing different message versions
- Analytics on notification engagement rates
