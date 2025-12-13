# 🚀 PHASE 1 IMPLEMENTATION GUIDE

**Status:** Ready to Start  
**Target Duration:** 2-3 days (5 quick wins)  
**Data Status:** ✅ All database tables already exist - only UI needed

---

## 📋 PHASE 1 QUICK WINS

| # | Feature | Time | Status | Component | Database |
|---|---------|------|--------|-----------|----------|
| 1 | Follow System UI | 30m | Ready | UserProfile.tsx | user_follows ✅ |
| 2 | Reputation Display | 15m | Ready | UserProfile.tsx | profiles.reputation ✅ |
| 3 | Case Difficulty Ratings | 45m | Ready | ExploreCases.tsx, CaseDetail.tsx | cases (new column) |
| 4 | Login Streaks Display | 30m | Ready | UserProfile.tsx | user_challenges ✅ |
| 5 | Badges Display | 30m | Ready | UserProfile.tsx | user_badges ✅ |

**Total Phase 1 Time:** ~150 minutes (~2.5 hours focused work)

---

## 🗄️ DATABASE SETUP

### ✅ ALREADY EXISTS (No action needed)
```sql
-- User relationships
SELECT * FROM user_follows;
-- Columns: id, follower_id, following_id, created_at

-- User achievements
SELECT * FROM user_badges;
-- Columns: id, user_id, badge_id, earned_at

-- User challenges (login streaks)
SELECT * FROM user_challenges;
-- Columns: id, user_id, challenge_id, progress, completed_at, reward_points

-- User profiles
SELECT * FROM profiles;
-- Columns: id, reputation, level, total_points, ...
```

### 🆕 NEEDS TO BE ADDED

#### Task 3: Case Difficulty Ratings
```sql
-- Add difficulty column to cases table (if not exists)
ALTER TABLE cases 
ADD COLUMN difficulty_level INT DEFAULT 3; 
-- 1=Easy, 2=Medium, 3=Hard, 4=Very Hard, 5=Extremely Hard

-- Optional: Create difficulty_ratings table for user voting
CREATE TABLE case_difficulty_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID REFERENCES cases(id),
  user_id UUID REFERENCES auth.users(id),
  difficulty_rating INT, -- 1-5
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(case_id, user_id)
);

-- View to calculate average difficulty
CREATE OR REPLACE VIEW case_difficulty_avg AS
SELECT 
  case_id,
  ROUND(AVG(difficulty_rating)::numeric, 1) as avg_difficulty,
  COUNT(*) as vote_count
FROM case_difficulty_votes
GROUP BY case_id;
```

**Action:** Run these SQL commands in Supabase editor

---

## 💻 FRONTEND IMPLEMENTATION

### Task 1: Follow System UI (30 min)

**File:** [src/components/UserProfile.tsx](src/components/UserProfile.tsx)

**Changes:**
1. Add Follow/Unfollow button at top of profile
2. Display follower/following count
3. Add followers list modal

**Code to Add:**
```typescript
// UserProfile.tsx

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function UserProfile() {
  const { user } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followCount, setFollowCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [showFollowers, setShowFollowers] = useState(false);

  useEffect(() => {
    // Check if current user follows profile user
    const checkFollowing = async () => {
      if (!user || !profileUser?.id) return;
      
      const { data } = await supabase
        .from('user_follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', profileUser.id)
        .single();
      
      setIsFollowing(!!data);
    };

    // Get follow counts
    const getFollowCounts = async () => {
      if (!profileUser?.id) return;
      
      const { count: following } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact' })
        .eq('follower_id', profileUser.id);
      
      const { count: followers } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact' })
        .eq('following_id', profileUser.id);
      
      setFollowCount(following || 0);
      setFollowerCount(followers || 0);
    };

    checkFollowing();
    getFollowCounts();
  }, [user, profileUser?.id]);

  const handleFollowToggle = async () => {
    if (!user || !profileUser?.id) return;

    if (isFollowing) {
      // Unfollow
      await supabase
        .from('user_follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', profileUser.id);
    } else {
      // Follow
      await supabase
        .from('user_follows')
        .insert({
          follower_id: user.id,
          following_id: profileUser.id
        });
    }

    setIsFollowing(!isFollowing);
  };

  return (
    <div className="profile-container">
      {/* Follow Section */}
      <div className="profile-header">
        <h1>{profileUser?.username}</h1>
        
        {user?.id !== profileUser?.id && (
          <button
            onClick={handleFollowToggle}
            className={isFollowing ? 'btn-unfollow' : 'btn-follow'}
          >
            {isFollowing ? '✓ Following' : '+ Follow'}
          </button>
        )}
      </div>

      {/* Follow Stats */}
      <div className="follow-stats">
        <div className="stat" onClick={() => setShowFollowers(true)}>
          <span className="number">{followerCount}</span>
          <span className="label">Followers</span>
        </div>
        <div className="stat">
          <span className="number">{followCount}</span>
          <span className="label">Following</span>
        </div>
      </div>

      {/* Followers List Modal */}
      {showFollowers && (
        <FollowersList 
          userId={profileUser?.id}
          onClose={() => setShowFollowers(false)}
        />
      )}

      {/* Rest of profile */}
    </div>
  );
}

// FollowersList Component
function FollowersList({ userId, onClose }) {
  const [followers, setFollowers] = useState([]);

  useEffect(() => {
    const getFollowers = async () => {
      const { data } = await supabase
        .from('user_follows')
        .select('follower:profiles!follower_id(*)')
        .eq('following_id', userId);
      
      setFollowers(data?.map(f => f.follower) || []);
    };

    getFollowers();
  }, [userId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>Followers</h2>
        <div className="followers-list">
          {followers.map(follower => (
            <div key={follower.id} className="follower-item">
              <img src={follower.avatar_url} alt={follower.username} />
              <Link to={`/profile/${follower.id}`}>
                {follower.username}
              </Link>
            </div>
          ))}
        </div>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
```

**Styling (Tailwind):**
```typescript
// Add to UserProfile.tsx className
className="flex gap-4 items-center"
// Follow button
className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
// Stats
className="grid grid-cols-2 gap-4 mt-4 text-center"
```

---

### Task 2: Reputation Display (15 min)

**File:** [src/components/UserProfile.tsx](src/components/UserProfile.tsx)

**Add to profile header:**
```typescript
<div className="reputation-badge">
  <span className="level-icon">★</span>
  <div>
    <p className="reputation-score">{profileUser?.reputation || 0}</p>
    <p className="level-text">{getRepLevel(profileUser?.reputation)}</p>
  </div>
</div>

function getRepLevel(reputation) {
  if (reputation >= 5000) return "Legend";
  if (reputation >= 2000) return "Expert";
  if (reputation >= 1000) return "Trusted";
  if (reputation >= 500) return "Active";
  if (reputation >= 100) return "Contributor";
  return "Newcomer";
}
```

---

### Task 3: Case Difficulty Ratings (45 min)

**Files:**
- [src/components/ExploreCases.tsx](src/components/ExploreCases.tsx)
- [src/components/CaseDetail.tsx](src/components/CaseDetail.tsx)

**ExploreCases.tsx - Add difficulty badge to case cards:**
```typescript
<div className="case-card">
  <h3>{case.title}</h3>
  
  {/* Add difficulty display */}
  <div className="difficulty-badge">
    {renderDifficultyStars(case.difficulty_level)}
    <span className="difficulty-text">
      {getDifficultyLabel(case.difficulty_level)}
    </span>
  </div>
  
  <p>{case.description}</p>
</div>

function renderDifficultyStars(level) {
  return (
    <div className="stars">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={i <= level ? 'star-filled' : 'star-empty'}>
          ★
        </span>
      ))}
    </div>
  );
}

function getDifficultyLabel(level) {
  const labels = {
    1: 'Easy',
    2: 'Medium',
    3: 'Hard',
    4: 'Very Hard',
    5: 'Extremely Hard'
  };
  return labels[level] || 'Unknown';
}
```

**CaseDetail.tsx - Add difficulty selector for investigators:**
```typescript
{/* If investigator viewing case, allow rating difficulty */}
{isInvestigator && (
  <div className="difficulty-section">
    <h3>How difficult is this case?</h3>
    <div className="difficulty-votes">
      {[1, 2, 3, 4, 5].map(rating => (
        <button
          key={rating}
          onClick={() => voteDifficulty(caseId, rating)}
          className={userDifficultyVote === rating ? 'active' : ''}
        >
          {'★'.repeat(rating)}
        </button>
      ))}
    </div>
    <p className="avg-difficulty">
      Average: {averageDifficulty?.avg_difficulty || 'No votes yet'}
    </p>
  </div>
)}
```

---

### Task 4: Login Streaks Display (30 min)

**File:** [src/components/UserProfile.tsx](src/components/UserProfile.tsx)

**Add streaks section:**
```typescript
const [streaks, setStreaks] = useState(null);

useEffect(() => {
  const getStreaks = async () => {
    const { data } = await supabase
      .from('user_challenges')
      .select('*')
      .eq('user_id', profileUser?.id)
      .eq('challenge_id', 'login-streak');
    
    if (data?.length > 0) {
      setStreaks(data[0]);
    }
  };
  
  getStreaks();
}, [profileUser?.id]);

// In JSX:
{streaks && (
  <div className="streaks-card">
    <h3>🔥 Login Streak</h3>
    <div className="streak-count">{streaks.progress} days</div>
    <p className="streak-label">Keep it going!</p>
    {streaks.completed_at && (
      <p className="reward-text">
        ✓ Reward earned: {streaks.reward_points} points
      </p>
    )}
  </div>
)}
```

---

### Task 5: Badges Display (30 min)

**File:** [src/components/UserProfile.tsx](src/components/UserProfile.tsx)

**Create badges section:**
```typescript
const [badges, setBadges] = useState([]);

useEffect(() => {
  const getBadges = async () => {
    const { data } = await supabase
      .from('user_badges')
      .select('badge:badges(*), earned_at')
      .eq('user_id', profileUser?.id);
    
    setBadges(data || []);
  };
  
  getBadges();
}, [profileUser?.id]);

// Badge data
const BADGE_ICONS = {
  'first-case': '📝',
  'case-solver': '🔍',
  'evidence-master': '🔬',
  'forum-expert': '💬',
  'investigator': '👮',
  'team-builder': '👥',
  'poll-creator': '📊'
};

// In JSX:
<div className="badges-section">
  <h3>Badges</h3>
  <div className="badges-grid">
    {badges.map(badge => (
      <div key={badge.id} className="badge-item" title={badge.badge.name}>
        <span className="badge-icon">
          {BADGE_ICONS[badge.badge.slug] || '🏆'}
        </span>
        <span className="badge-name">{badge.badge.name}</span>
        <span className="badge-date">
          {new Date(badge.earned_at).toLocaleDateString()}
        </span>
      </div>
    ))}
  </div>
</div>
```

---

## 🗂️ ROUTES TO ADD

**File:** [src/routes.tsx](src/routes.tsx) (or router configuration)

```typescript
// Add these routes if not already present
{
  path: '/profile/:userId',
  element: <UserProfile />,
  name: 'User Profile'
},
{
  path: '/followers/:userId',
  element: <FollowersList />,
  name: 'Followers'
}
```

---

## 📱 STYLING GUIDELINES (Tailwind CSS)

```css
/* Follow Button */
.btn-follow {
  @apply px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition;
}

.btn-unfollow {
  @apply px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition;
}

/* Reputation Badge */
.reputation-badge {
  @apply flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-300 rounded-lg;
}

.reputation-score {
  @apply text-2xl font-bold text-yellow-600;
}

/* Difficulty Stars */
.difficulty-badge {
  @apply flex items-center gap-2 text-sm;
}

.star-filled {
  @apply text-yellow-400;
}

.star-empty {
  @apply text-gray-300;
}

/* Streaks */
.streaks-card {
  @apply bg-gradient-to-r from-orange-400 to-red-500 text-white p-4 rounded-lg;
}

.streak-count {
  @apply text-4xl font-bold my-2;
}

/* Badges */
.badges-grid {
  @apply grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4;
}

.badge-item {
  @apply flex flex-col items-center text-center p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition cursor-pointer;
}

.badge-icon {
  @apply text-3xl mb-1;
}

.badge-name {
  @apply text-xs font-semibold;
}
```

---

## 📊 IMPLEMENTATION CHECKLIST

### Database Setup
- [ ] Run SQL: Add difficulty_level to cases
- [ ] Run SQL: Create case_difficulty_votes table
- [ ] Run SQL: Create case_difficulty_avg view
- [ ] Verify: user_follows table structure
- [ ] Verify: user_badges table structure
- [ ] Verify: user_challenges table structure
- [ ] Verify: profiles.reputation column exists

### Frontend Development
- [ ] Task 1: Follow System UI
  - [ ] Add Follow/Unfollow button
  - [ ] Add follow count display
  - [ ] Create FollowersList modal
  - [ ] Test following/unfollowing

- [ ] Task 2: Reputation Display
  - [ ] Add reputation badge to profile
  - [ ] Create getRepLevel function
  - [ ] Style reputation display

- [ ] Task 3: Case Difficulty Ratings
  - [ ] Add difficulty stars to case cards
  - [ ] Create difficulty selector in CaseDetail
  - [ ] Add voting functionality
  - [ ] Display average difficulty

- [ ] Task 4: Login Streaks Display
  - [ ] Query user_challenges data
  - [ ] Display streak count
  - [ ] Show reward info
  - [ ] Style streak card

- [ ] Task 5: Badges Display
  - [ ] Query user_badges data
  - [ ] Create badge grid display
  - [ ] Add badge icons
  - [ ] Add tooltip/hover info

### Testing
- [ ] Test with own profile
- [ ] Test with other user's profile
- [ ] Test following/unfollowing
- [ ] Verify responsive mobile display
- [ ] Check Tailwind styling on all components

### Git Commit
- [ ] Commit: "feat: Phase 1 - Add follow system, reputation, difficulty ratings, streaks, badges"

---

## 🚀 NEXT AFTER PHASE 1

Once Phase 1 complete, start Phase 2:
- [ ] Similar Cases widget
- [ ] Trending Indicator
- [ ] Forum Moderation
- [ ] Case Bookmarks

---

## ❓ QUESTIONS DURING IMPLEMENTATION?

1. **Database:** Use Supabase SQL editor for any schema changes
2. **Frontend:** Follow existing component patterns in codebase
3. **Edge Functions:** Push updates from terminal using Supabase CLI
4. **Testing:** Use `npm run dev` to test locally

**Start with Database Setup, then Frontend Task 1!**
