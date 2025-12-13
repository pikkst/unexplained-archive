# 🚀 Team Collaboration System - Quick Start Guide

## Installation (5 minutes)

### Step 1: Run Database Migration
```bash
# In Supabase SQL Editor, run:
```
```sql
-- Copy and paste contents of setup-team-collaboration.sql
-- This creates:
-- ✅ case_team_members table
-- ✅ team_invitations table  
-- ✅ Team management functions
-- ✅ Reward distribution functions
-- ✅ RLS policies
```

### Step 2: Verify Migration
```sql
-- Check tables exist:
SELECT * FROM case_team_members LIMIT 1;
SELECT * FROM team_invitations LIMIT 1;

-- Check functions exist:
SELECT proname FROM pg_proc WHERE proname LIKE '%team%';
```

### Step 3: Update Payment System
The existing `setup-payment-system.sql` has already been updated with team support.
If you haven't run it yet, run it now:
```sql
\i setup-payment-system.sql
```

### Step 4: Verify Frontend Integration
All React components are already created and integrated:
- ✅ `TeamManagementPanel.tsx`
- ✅ `TeamInvitationModal.tsx`
- ✅ `RewardSplitModal.tsx`
- ✅ `TeamInvitationsPanel.tsx`
- ✅ `teamService.ts`

No additional frontend setup needed!

---

## Usage Examples

### Example 1: Investigator Claims Case and Invites Team

#### As Investigator (John):
1. Go to **Investigator Dashboard** → **Case Board** tab
2. Find an OPEN case and click **"Review & Assign"**
3. Click **"Investigate This Case"** button
4. ✅ You are now the **Team Leader**

5. Open the case detail page
6. Scroll to **"Investigation Team"** section
7. Click **"Invite Member"** button
8. Search for another investigator (e.g., "Sarah")
9. Add optional message: *"Need your expertise on this UFO case!"*
10. Click **"Send Invitation"**
11. ✅ Invitation sent!

#### As Invited Investigator (Sarah):
1. Notice **red notification badge** on dashboard
2. Click **"Team Invitations"** tab
3. See invitation from John with case details
4. Click **"Accept & Join Team"**
5. ✅ Automatically redirected to case
6. You're now part of the team!

---

### Example 2: Setting Custom Reward Split

#### As Team Leader:
1. Open case detail page
2. In **"Investigation Team"** section
3. Click **"Reward Split"** button
4. Adjust percentages:
   - John (Leader): 60%
   - Sarah (Member): 40%
5. Verify total = 100% (green indicator)
6. Click **"Save Splits"**
7. ✅ Split percentages saved

**Alternative - Equal Split:**
- Click **"Split Equally"** button
- System auto-calculates: 50% / 50%
- Click **"Save Splits"**

---

### Example 3: Complete Team Case with Payout

#### Team Investigation Phase:
1. **Both investigators** can access case detail page
2. **Team Leader** logs evidence and findings
3. **Team Leader** submits resolution proposal
4. Case status: INVESTIGATING → PENDING_REVIEW

#### Submitter Approval Phase:
1. **Case Submitter** receives notification
2. Submitter reviews team's resolution
3. Submitter clicks **"Accept & Rate Investigator"**
4. Rates 5 stars and confirms

#### Automatic Payout:
```
Total Reward: $500
Platform Fee (15%): -$75
Net Amount: $425

Distribution (60/40 split):
- John's Wallet: +$255 (60%)
- Sarah's Wallet: +$170 (40%)

✅ Transaction records created for both
✅ Wallets updated automatically
✅ Reputation points awarded
```

---

## Testing Your Setup

### Test 1: Single Investigator Claim
```bash
# Expected Result:
✅ Investigator becomes team leader
✅ Team panel shows 1 member (leader badge)
✅ "Invite Member" button visible
✅ case.is_team_case = false
```

### Test 2: Send Invitation
```bash
# Expected Result:
✅ Invitation modal opens
✅ Search finds verified investigators
✅ Invitation saved to database
✅ Notification badge appears for recipient
✅ case.is_team_case = true
```

### Test 3: Accept Invitation
```bash
# Expected Result:
✅ Member added to case_team_members
✅ invitation.status = 'accepted'
✅ Team panel shows 2 members
✅ Redirect to case detail page
```

### Test 4: Reward Split
```bash
# Expected Result:
✅ Modal shows all team members
✅ Percentage validation works
✅ "Split Equally" button works
✅ Save updates contribution_percentage
✅ Percentages visible in team panel
```

### Test 5: Team Payout
```bash
# Expected Result:
✅ release_escrow_to_investigator() detects team case
✅ distribute_team_reward() called
✅ Each member receives correct percentage
✅ Wallet balances updated
✅ Transaction records created
```

---

## Common Scenarios

### Scenario: Remove Unresponsive Member

**Problem:** Team member not contributing
**Solution:**
1. Team Leader opens case detail page
2. In team panel, find member
3. Click red **"Remove"** button
4. Confirm removal
5. ✅ Member removed, status = 'removed'

**Note:** Removed members won't receive reward payout.

---

### Scenario: Member Wants to Leave

**Problem:** Team member wants to leave voluntarily
**Solution:**
1. Member opens case detail page
2. In team panel, click **"Leave Team"**
3. Confirm leave
4. ✅ Status updated to 'left'

**Note:** Cannot leave if you're the team leader.

---

### Scenario: Forgot to Set Reward Split

**Problem:** Leader forgot to set percentages before resolution
**Solution:**
✅ **No problem!** System automatically splits equally:
- Database trigger: `trigger_auto_reward_split`
- Runs when case status changes to RESOLVED
- Calculates equal percentage for all active members
- Example: 3 members → 33%, 33%, 34% (leader gets remainder)

---

### Scenario: Search Not Finding Investigators

**Problem:** Search returns no results
**Checklist:**
- ✅ Is target user role = 'investigator'?
- ✅ Is target user verified?
- ✅ Is target user already on team?
- ✅ Is target user already invited?

**Fix:** Only **verified investigators** who are **NOT** already on team or invited will appear.

---

## Real-time Features

### Live Updates
The system uses Supabase real-time subscriptions:

**Team Changes:**
```typescript
// Automatically updates when:
- New member joins
- Member removed
- Member leaves
- Reward split updated
```

**Invitations:**
```typescript
// Automatically updates when:
- New invitation received
- Invitation accepted/rejected
- Invitation cancelled
```

**Browser Notifications:**
```typescript
// Desktop notifications for:
- New team invitation received
- Team member joined
- Reward received
```

---

## Troubleshooting

### ❌ Issue: "Only team leader can invite members"
**Fix:** Verify you claimed the case first. Only the first investigator becomes leader.

### ❌ Issue: Team panel not appearing
**Fix:** Check if you're assigned to the case. Panel only visible to assigned investigators.

### ❌ Issue: Reward split total ≠ 100%
**Fix:** Adjust percentages or click "Split Equally" button. Total must equal exactly 100.

### ❌ Issue: Payment not distributed
**Fix:** 
1. Check if reward split is set
2. Verify case status = RESOLVED
3. Check is_team_case flag is true
4. Review database logs

### ❌ Issue: Invitation not received
**Fix:**
1. Verify recipient is verified investigator
2. Check if already on team
3. Look in database: `SELECT * FROM team_invitations WHERE to_investigator_id = '...'`

---

## Quick Reference

### Team Roles
| Role | Can Invite | Can Remove | Can Set Split | Can Submit Resolution | Can Leave |
|------|------------|------------|---------------|----------------------|-----------|
| Leader | ✅ | ✅ | ✅ | ✅ | ❌ |
| Member | ❌ | ❌ | ❌ | ❌ | ✅ |

### Invitation Status Flow
```
pending → accepted → member added to team
pending → rejected → invitation closed
pending → cancelled → invitation closed (by sender)
```

### Reward Percentage Rules
- ✅ Total must equal 100%
- ✅ Each member: 0% - 100%
- ✅ Leader can adjust anytime before resolution
- ✅ If not set, auto-splits equally on resolution

### Platform Fees
```
Donation:     10% platform fee
Resolution:   15% platform fee
Refund:        5% handling fee
```

---

## Next Steps

### ✅ Basic Setup Complete
You now have:
- Team formation system
- Invitation workflow
- Reward distribution
- Real-time notifications

### 🔮 Optional Enhancements
Consider adding:
- Team group chat (messaging system)
- Task assignment within team
- Contribution tracking
- Team performance metrics

### 📚 Further Reading
- **TEAM_COLLABORATION_DOCS.md** - Full technical documentation
- **FEATURE_GAP_ANALYSIS.md** - System capabilities overview
- **setup-payment-system.sql** - ESCROW payment system details

---

## Support

### Still Having Issues?
1. Check database migrations: `SELECT * FROM case_team_members LIMIT 1;`
2. Verify RLS policies: Tables should have ENABLE ROW LEVEL SECURITY
3. Check browser console for errors
4. Review Supabase logs

### Success Indicators
✅ Tables created
✅ Functions exist
✅ RLS enabled
✅ Components integrated
✅ Real-time working
✅ Payouts distributing

---

**🎉 Congratulations!**
Your Team Collaboration System is now fully operational!

Test it out by:
1. Creating a test case
2. Claiming it as investigator
3. Inviting a team member
4. Setting reward split
5. Resolving and getting paid

**Happy investigating! 🔍**
