# Admin Credit Award Feature

## Overview
Admins can now award free credits to users as rewards for exceptional contributions, compensations, or other special circumstances.

## Feature Location
**Admin Dashboard → Users Management Tab**

Navigate to: `/admin` → Click "Users Management" tab

## How to Use

### Step 1: Access Users Management
1. Log in as an admin user
2. Navigate to the Admin Dashboard
3. Click on the "Users Management" tab

### Step 2: Find the User
- Use the search bar to find users by:
  - Username
  - Full name
  - Email
  - User ID
- Browse through the list of users

### Step 3: Award Credits
1. Click the "Award Credits" button on the user's card
2. Fill in the award form:
   - **Credit Amount**: Enter the number of credits (must be positive)
   - **Reason for Award**: Explain why you're awarding credits (required)
3. Review the new balance preview
4. Click "Award Credits" to confirm

### Example Use Cases
- **Outstanding Investigation**: User provided exceptional investigation work
- **Community Contribution**: User helped improve the platform
- **Platform Issue Compensation**: User experienced technical issues
- **Early Adopter Reward**: Rewarding early supporters
- **Competition Winner**: User won a community contest

## Technical Details

### Backend Function
The feature uses the existing `admin_grant_credits` database function:

```sql
admin_grant_credits(
    p_admin_id UUID,      -- Admin's user ID
    p_user_id UUID,       -- Recipient's user ID
    p_amount INTEGER,     -- Credit amount (must be positive)
    p_reason TEXT         -- Reason for the award
)
```

### Security
- Only users with `role = 'admin'` can award credits
- The function verifies admin privileges before execution
- All credit awards are logged in `credit_transactions` table with:
  - Transaction type: `'admin_grant'`
  - Source: `'admin_manual'`
  - Full audit trail with admin ID and reason

### Transaction Logging
Every credit award is automatically logged with:
- **User ID**: Recipient of the credits
- **Amount**: Credits awarded
- **Transaction Type**: `admin_grant`
- **Source**: `admin_manual`
- **Description**: Reason provided by admin + "(granted by admin)"
- **Timestamp**: When the award was made

### User Credit Balance
Credits are immediately added to:
- `profiles.credits` - Current available balance
- `profiles.lifetime_credits_earned` - Total credits earned over time

## UI Features

### User Card Display
Each user card shows:
- Avatar
- Username and full name
- Email address
- Role (admin/investigator/user)
- Current credit balance
- Reputation score
- PRO membership status
- Join date

### Search & Filter
- Real-time search across username, name, email, and ID
- Results counter showing filtered user count
- Instant filtering as you type

### Award Modal
- Shows recipient information
- Displays current credit balance
- Input validation for amount and reason
- Preview of new balance after award
- Confirmation before awarding
- Loading state during processing

## Error Handling
The feature handles:
- Invalid amounts (must be positive number)
- Missing reason (required field)
- Unauthorized access (non-admin users)
- User not found errors
- Database errors

## Success Flow
1. Admin fills the form correctly
2. Confirmation dialog appears
3. Credits are awarded via RPC call
4. Success message displays
5. User list refreshes to show updated balance
6. Form resets for next award

## Benefits
✅ Admins can reward exceptional users  
✅ Provides compensation tool for platform issues  
✅ Enables promotional campaigns and contests  
✅ Full audit trail for all awards  
✅ Immediate credit availability for users  
✅ Easy-to-use interface  

## Database Schema

### Credit Transactions Table
```sql
credit_transactions (
    id UUID PRIMARY KEY,
    user_id UUID,
    amount INTEGER,
    balance_after INTEGER,
    transaction_type VARCHAR(50),  -- 'admin_grant'
    source VARCHAR(100),            -- 'admin_manual'
    description TEXT,
    created_at TIMESTAMPTZ
)
```

## Notes
- Credits are free rewards (not purchases)
- Cannot be negative
- Reason is required for audit purposes
- Awards are irreversible (by design for audit integrity)
- All transactions are logged permanently
