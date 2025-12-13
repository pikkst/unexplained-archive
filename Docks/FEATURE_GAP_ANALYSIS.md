# FEATURE ANALYSIS & GAP ASSESSMENT
**Unexplained Archive Platform**  
Date: December 5, 2025

---

## ✅ IMPLEMENTED FEATURES

### 1. Case Submission Flow ✅
**Status:** Fully Implemented

**Available:**
- User submission form (SubmitCaseForm.tsx)
- Fields: Title, Category, Description, Location, Media, Reward
- AI Image Generation placeholder
- Supabase storage integration
- Form validation

**SQL:**
```sql
-- Cases table with all necessary fields
CREATE TABLE cases (
  user_id, title, description, category, date_occurred,
  location, media_urls, ai_generated, status, reward, etc.
)
```

---

### 2. Investigator Claim Flow ⚠️ **PARTIALLY IMPLEMENTED**
**Status:** Basic implementation exists, NO TEAM COLLABORATION

**Available:**
- ✅ Investigator Dashboard (InvestigatorDashboard.tsx)
- ✅ "Review & Assign" button for open cases
- ✅ Case assignment logic (assigned_investigator_id)
- ✅ Status change to "INVESTIGATING"
- ✅ apiService.claimCase() function

**SQL:**
```sql
-- Cases table supports single investigator assignment
cases.investigator_id UUID REFERENCES profiles(id)
```

**MISSING:**
- ❌ **Team Leader concept** - No field for team_leader_id
- ❌ **Team Members table** - No case_team_members table
- ❌ **Invite system** - No team invitations
- ❌ **Multi-investigator collaboration** - Only 1 investigator per case
- ❌ **Team messaging** - No internal team communication

---

### 3. Investigation & Resolution Flow ✅
**Status:** Fully Implemented

**Available:**
- ✅ Investigation notes (CaseDetail.tsx)
- ✅ Resolution proposal submission
- ✅ Status: OPEN → INVESTIGATING → PENDING_REVIEW → RESOLVED
- ✅ User rating system (1-5 stars + comment)
- ✅ Rating affects reputation score

**SQL:**
```sql
-- Reputation tracking in profiles
UPDATE profiles 
SET reputation_score = GREATEST(0, reputation_score - 50)
WHERE id = investigator_id;
```

**UI Components:**
- CaseDetail.tsx: Resolution approval/rejection
- Rating modal with star system
- Investigator notes and proposal fields

---

### 4. Rewards & Donations ✅ (via ESCROW)
**Status:** Fully Implemented with ESCROW

**Available:**
- ✅ Case reward field
- ✅ Direct Stripe payments → Platform wallet (escrow)
- ✅ Escrow release on submitter approval (15% platform fee)
- ✅ Three-tier dispute resolution
- ✅ Admin override for distribution
- ✅ Investigator wallet & payouts

**SQL:**
```sql
-- Escrow functions (setup-payment-system.sql)
process_direct_donation()
release_escrow_to_investigator()
admin_resolve_dispute_release()
admin_resolve_dispute_refund()
```

**MISSING:**
- ❌ **Team reward splitting** - No mechanism to split rewards among team members
- ❌ **Team Leader adjustments** - No custom distribution logic
- ❌ **Multi-investigator payouts** - Only supports single investigator

---

### 5. Rating & Reputation ✅
**Status:** Fully Implemented

**Available:**
- ✅ User rates investigator after resolution (1-5 stars)
- ✅ Rating affects profiles.reputation score
- ✅ Reputation displayed on Leaderboard
- ✅ Reputation penalty on refund (-50 points)
- ✅ Cases_solved counter for investigators

**SQL:**
```sql
-- Reputation field in profiles
profiles.reputation INTEGER DEFAULT 0

-- Investigators table tracks performance
investigators (
  cases_solved INTEGER DEFAULT 0,
  rating DECIMAL(3, 2) DEFAULT 0.00
)
```

**UI:**
- Leaderboard.tsx displays top investigators by reputation
- CaseDetail.tsx shows investigator reputation score
- Rating modal after case resolution

---

## ❌ MISSING FEATURES

### 6. Team Collaboration ❌ **NOT IMPLEMENTED**
**Status:** Completely Missing

**Required Schema (MongoDB equivalent in PostgreSQL):**
```sql
-- NEW TABLE NEEDED
CREATE TABLE case_team_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
  investigator_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('leader', 'member')),
  joined_at TIMESTAMP DEFAULT NOW(),
  invited_by UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('invited', 'active', 'left')),
  UNIQUE(case_id, investigator_id)
);

-- NEW TABLE: Team Invitations
CREATE TABLE team_invitations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE NOT NULL,
  from_investigator_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  to_investigator_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  responded_at TIMESTAMP
);

-- Modify cases table
ALTER TABLE cases 
  ADD COLUMN team_leader_id UUID REFERENCES profiles(id),
  ADD COLUMN is_team_case BOOLEAN DEFAULT FALSE;
```

**Required Functions:**
```sql
-- Invite investigator to team
CREATE FUNCTION invite_team_member(p_case_id UUID, p_from_id UUID, p_to_id UUID)

-- Accept team invitation
CREATE FUNCTION accept_team_invite(p_invitation_id UUID, p_investigator_id UUID)

-- Remove team member (leader only)
CREATE FUNCTION remove_team_member(p_case_id UUID, p_leader_id UUID, p_member_id UUID)

-- Get team members for case
CREATE FUNCTION get_case_team(p_case_id UUID)
```

**Required UI Components:**
```tsx
// TeamManagementPanel.tsx
- List current team members
- "Invite Investigator" button
- Remove member button (for leader)

// TeamInvitationModal.tsx
- Search investigators
- Send invitation message

// InvestigatorDashboard.tsx
- "Team Invitations" tab
- Accept/Reject buttons
```

---

### 7. Internal Team Messaging ⚠️ **PARTIALLY AVAILABLE**
**Status:** General messaging exists, but no team-specific features

**Available:**
- ✅ Private messages between case submitter ↔ investigator (MessagesModal.tsx)
- ✅ messages table (setup-messaging-notifications.sql)

**Missing:**
- ❌ Team group chat (multi-investigator conversation)
- ❌ Team-only message threads
- ❌ File sharing between team members
- ❌ Team notes/findings collaboration

**Required:**
```sql
-- Extend messages table for team chats
ALTER TABLE messages
  ADD COLUMN is_team_message BOOLEAN DEFAULT FALSE,
  ADD COLUMN team_case_id UUID REFERENCES cases(id);

-- Team-specific message policy
-- All team members can view team messages
```

---

## 🔧 ADMINISTRATOR WORKFLOWS

### 6.1 Investigator Verification ✅
**Status:** Fully Implemented

**Available:**
- ✅ AdminDashboard.tsx - Verification Queue
- ✅ Approve/Reject/Review buttons
- ✅ investigators.verified field
- ✅ apiService.verifyInvestigator()

**SQL:**
```sql
investigators (
  verified BOOLEAN DEFAULT FALSE,
  credentials TEXT NOT NULL
)
```

---

### 6.2 Case Moderation ✅
**Status:** Fully Implemented via Dispute System

**Available:**
- ✅ Admin can view DISPUTED cases
- ✅ Three actions: Force Release, Reject & Penalty, Community Vote
- ✅ Admin notes and decision logging
- ✅ Case status overrides

**SQL:**
```sql
admin_resolve_dispute_release(case_id, admin_id, notes)
admin_resolve_dispute_refund(case_id, admin_id, notes)
send_case_to_community_vote(case_id, admin_id, duration)
```

---

### 6.3 Team Disputes ❌ **NOT APPLICABLE**
**Status:** Missing (no team system exists)

**Would Require:**
- Team contribution tracking
- Reward split disputes
- Admin override for team payouts
- Team member removal/suspension

---

### 6.4 Content Moderation ⚠️ **BASIC IMPLEMENTATION**
**Status:** RLS policies exist, no dedicated moderation tools

**Available:**
- ✅ RLS policies for data access control
- ✅ Admin role with elevated permissions
- ✅ User ban capability (via auth.users)

**Missing:**
- ❌ **Flagging system** - No user/investigator flagging mechanism
- ❌ **Moderation queue** - No admin panel for flagged content
- ❌ **Media approval** - No pre-publication review
- ❌ **User suspension** - No soft-ban functionality
- ❌ **Content removal logs** - No audit trail

**Required Schema:**
```sql
-- NEW TABLE: Content Flags
CREATE TABLE content_flags (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  flagged_by UUID REFERENCES profiles(id),
  content_type TEXT CHECK (content_type IN ('case', 'comment', 'user', 'media')),
  content_id UUID NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'actioned', 'dismissed')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMP,
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- NEW TABLE: User Suspensions
CREATE TABLE user_suspensions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  suspended_by UUID REFERENCES profiles(id),
  reason TEXT NOT NULL,
  suspended_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  is_permanent BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'lifted', 'expired'))
);
```

---

## 📊 SUMMARY TABLE

| Feature | Status | Database | UI | Service Layer |
|---------|--------|----------|----|--------------| 
| **Case Submission** | ✅ Complete | ✅ | ✅ | ✅ |
| **Single Investigator Claim** | ✅ Complete | ✅ | ✅ | ✅ |
| **Team Collaboration** | ❌ Missing | ❌ | ❌ | ❌ |
| **Team Invitations** | ❌ Missing | ❌ | ❌ | ❌ |
| **Investigation & Resolution** | ✅ Complete | ✅ | ✅ | ✅ |
| **Rewards (Single Investigator)** | ✅ Complete | ✅ | ✅ | ✅ |
| **Rewards (Team Split)** | ❌ Missing | ❌ | ❌ | ❌ |
| **Rating & Reputation** | ✅ Complete | ✅ | ✅ | ✅ |
| **Private Messaging (1-to-1)** | ✅ Complete | ✅ | ✅ | ✅ |
| **Team Group Chat** | ❌ Missing | ❌ | ❌ | ❌ |
| **Admin: Investigator Verification** | ✅ Complete | ✅ | ✅ | ✅ |
| **Admin: Case Moderation** | ✅ Complete | ✅ | ✅ | ✅ |
| **Admin: Team Disputes** | ❌ N/A | ❌ | ❌ | ❌ |
| **Admin: Content Flagging** | ❌ Missing | ❌ | ❌ | ❌ |
| **User Suspension System** | ❌ Missing | ❌ | ❌ | ❌ |

---

## 🎯 RECOMMENDATIONS

### Priority 1: CRITICAL MISSING FEATURES
1. **Team Collaboration System** ⭐⭐⭐
   - Add case_team_members table
   - Implement team invitations
   - Create TeamManagementPanel UI
   - Add team reward splitting logic

2. **Content Flagging & Moderation** ⭐⭐⭐
   - Add content_flags table
   - Create admin moderation queue
   - Implement user suspension system

### Priority 2: ENHANCEMENTS
3. **Team Messaging**
   - Extend existing messaging for team group chats
   - Add file sharing for team evidence

4. **Advanced Admin Tools**
   - Audit logs for all admin actions
   - Bulk moderation actions
   - Analytics dashboard

---

## ✅ CONCLUSION

**Current State:**
- Platform supports **single-investigator workflow** excellently
- ESCROW payment system is **production-ready**
- Rating and reputation system is **fully functional**
- Admin dispute resolution is **comprehensive**

**Major Gap:**
- **NO TEAM COLLABORATION** - This is the biggest missing feature
- No multi-investigator cases
- No team reward splitting
- No team invitations

**To Match MongoDB Requirements:**
The platform needs a complete **team collaboration layer** added on top of the existing single-investigator system.

---

**Estimated Implementation:**
- Team Collaboration: ~3-4 days
- Content Flagging: ~2-3 days
- Total: ~5-7 days of development

