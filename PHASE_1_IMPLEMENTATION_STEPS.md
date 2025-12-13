# 🚀 PHASE 1 IMPLEMENTATION - STEP BY STEP

**Date:** December 13, 2025  
**Status:** Ready to implement  
**Duration:** ~3 hours focused work

---

## 📋 CHECKLIST

- [ ] Step 1: Database setup (SQL)
- [ ] Step 2: Create UserStats component
- [ ] Step 3: Create CaseDifficulty component
- [ ] Step 4: Update UserProfile to use new components
- [ ] Step 5: Update ExploreCases to show difficulty
- [ ] Step 6: Update CaseDetail to show difficulty voting
- [ ] Step 7: Test all changes
- [ ] Step 8: Commit and push

---

## STEP 1: DATABASE SETUP ✅

**File:** `supabase/phase-1-setup.sql`

**Action:** Copy and run in Supabase SQL Editor

**What it does:**
1. Adds `difficulty_level` column to `cases` table
2. Creates `case_difficulty_votes` table with RLS
3. Creates view for average difficulty
4. Sets up sample defaults

---

## STEP 2: Create UserStats Component ✅

**File Created:** `src/components/UserStats.tsx`

**What it includes:**
- Reputation display with levels
- Login streaks display  
- Follower/following counts
- Badges grid with icons
- Loading state

**Features:**
- Auto-loads from database
- Shows progression to next level
- Badge icons and tooltips
- Responsive grid layout

---

## STEP 3: Create CaseDifficulty Component ✅

**File Created:** `src/components/CaseDifficulty.tsx`

**What it includes:**
- Difficulty star display
- Community average voting
- Voting interface for investigators
- Vote count and average
- Confirmation messages

**Features:**
- Fetches from `case_difficulty_votes` table
- Creates/updates votes on click
- Shows your rating vs community
- Only investigators can vote

---

## STEP 4: Update UserProfile Component

**File:** `src/components/UserProfile.tsx`

**Changes needed:**

### 4a. Add import for UserStats:
```typescript
import { UserStats } from './UserStats';
```

### 4b. Replace the Stats section (around line 450):

**Find this code:**
```typescript
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-mystery-700">
            <div className="text-center">
              <div className="text-2xl font-bold text-mystery-400 mb-1">
                {profile.role === 'investigator' ? investigatorStats.reputation : (profile.reputation || 0)}
              </div>
              <div className="text-sm text-gray-500">Reputation</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-mystery-400 mb-1">{userCases.length}</div>
              <div className="text-sm text-gray-500">Cases Submitted</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-mystery-400 mb-1">0</div>
              <div className="text-sm text-gray-500">Comments</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-mystery-400 mb-1">0</div>
              <div className="text-sm text-gray-500">Followers</div>
            </div>
          </div>
```

**Replace with:**
```typescript
          {/* User Stats Section - New */}
          {profile?.id && (
            <div className="mt-6 pt-6 border-t border-mystery-700">
              <UserStats userId={profile.id} />
            </div>
          )}
```

### 4c. Add this before the closing div of Profile Header (around line 440):
```typescript
            {/* Show reputation badge if available */}
            {profile.reputation && profile.reputation > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-medium">
                ⭐ {profile.reputation} reputation
              </div>
            )}
```

---

## STEP 5: Update ExploreCases Component

**File:** `src/components/ExploreCases.tsx`

### 5a. Add import:
```typescript
import { CaseDifficulty } from './CaseDifficulty';
```

### 5b. Add to each case card (find where cases are displayed):
```typescript
{/* Add this in the case card, below the title */}
<div className="my-2">
  <CaseDifficulty 
    caseId={caseItem.id}
    initialDifficulty={caseItem.difficulty_level || 3}
    isInvestigator={false}
  />
</div>
```

---

## STEP 6: Update CaseDetail Component

**File:** `src/components/CaseDetail.tsx`

### 6a. Add import:
```typescript
import { CaseDifficulty } from './CaseDifficulty';
```

### 6b. Add difficulty section (in case details area):
```typescript
{/* Difficulty Section */}
<div className="bg-mystery-800 rounded-lg border border-mystery-700 p-6 mb-6">
  <h3 className="text-lg font-semibold text-white mb-4">Investigation Difficulty</h3>
  <CaseDifficulty 
    caseId={caseId}
    initialDifficulty={case_data?.difficulty_level || 3}
    isInvestigator={profile?.role === 'investigator'}
  />
</div>
```

---

## STEP 7: Testing

### Local Testing:

```bash
# Start dev server
npm run dev

# Navigate to:
# 1. Profile page - Check for reputation, badges, streaks
# 2. Explore Cases - Check difficulty stars on each case
# 3. Case Detail - Check difficulty section and voting
# 4. Another user's profile - Check follow button
```

### Test Cases:

1. **Reputation & Badges**
   - [ ] Visit your profile
   - [ ] Check reputation score displays
   - [ ] Check badges display correctly
   - [ ] Check streak count shows

2. **Follow System**
   - [ ] Visit another user's profile
   - [ ] Click "Follow" button
   - [ ] Check it changes to "Unfollow"
   - [ ] Check follower count updates
   - [ ] Click "Unfollow" and verify it reverts

3. **Difficulty Ratings**
   - [ ] Open a case in ExploreCases
   - [ ] Check difficulty stars display
   - [ ] Log in as investigator
   - [ ] Open case detail
   - [ ] Vote on difficulty
   - [ ] Check vote saves
   - [ ] Refresh page to verify persistence

4. **Mobile Responsive**
   - [ ] Test on mobile screen
   - [ ] Check all badges display in grid
   - [ ] Check difficulty stars wrap properly
   - [ ] Check follow button is clickable

---

## STEP 8: Git Commit & Push

```bash
# Check what changed
git status

# Add files
git add src/components/UserStats.tsx
git add src/components/CaseDifficulty.tsx
git add src/components/UserProfile.tsx
git add src/components/ExploreCases.tsx
git add src/components/CaseDetail.tsx
git add supabase/phase-1-setup.sql
git add PHASE_1_IMPLEMENTATION_GUIDE.md

# Commit with detailed message
git commit -m "feat: Phase 1 - Implement reputation, badges, streaks, and difficulty ratings

- Added UserStats component: displays reputation levels, login streaks, follower counts, and earned badges
- Added CaseDifficulty component: star ratings system with community voting for investigators
- Enhanced UserProfile with new stats section showing reputation progression and badges grid
- Added difficulty display to ExploreCases component with interactive star ratings
- Added difficulty voting interface to CaseDetail for investigators
- Database: Added difficulty_level column to cases + case_difficulty_votes table with RLS
- Features:
  * Reputation levels: Newcomer → Legend (5000+ points)
  * Login streaks with fire emoji and reward tracking
  * Badge display with 12 badge types and earn dates
  * Case difficulty: 1-5 star ratings with community average
  * Investigator voting on case difficulty
  * Complete RLS policies for security

Closes implementation Task 1-5 of Phase 1"

# Push to GitHub
git push origin main
```

---

## 📊 VERIFICATION AFTER PUSH

1. Check GitHub repo - Should see new commit
2. Check Actions tab - GitHub Actions should auto-deploy
3. Visit live site - Should see all features working
4. Check browser console - Should have no errors

---

## ⚠️ TROUBLESHOOTING

### If components don't appear:
```bash
# Check imports in UserProfile.tsx
# Make sure path is correct: '../components/UserStats'

# Clear React cache
rm -rf node_modules/.vite
npm run dev
```

### If database error appears:
```
"Failed to fetch difficulty data"
→ Ensure supabase/phase-1-setup.sql was run first
→ Check Supabase SQL Editor for errors
```

### If follow button not working:
```
"Failed to follow"
→ Ensure user_follows table exists
→ Check RLS policies are enabled
→ Verify auth is working
```

---

## 📈 NEXT STEPS AFTER PHASE 1

1. **Task 6:** Similar Cases widget
2. **Task 7:** Trending Indicator
3. **Task 8:** Forum Moderation
4. **Task 9:** Case Bookmarks
5. **Task 10:** More Phase 2 features...

---

## 📞 FILES MODIFIED SUMMARY

| File | Changes | Type |
|------|---------|------|
| UserProfile.tsx | Added UserStats section | Update |
| ExploreCases.tsx | Added difficulty display | Update |
| CaseDetail.tsx | Added difficulty voting | Update |
| UserStats.tsx | NEW component | Create |
| CaseDifficulty.tsx | NEW component | Create |
| phase-1-setup.sql | Database schema | Create |

**Total:** 3 new files, 3 updated files

---

## ✅ PHASE 1 COMPLETE WHEN:

- [ ] All SQL run in Supabase
- [ ] All components created
- [ ] All components integrated
- [ ] Local testing passed
- [ ] Deployed to GitHub Pages
- [ ] Live features verified
- [ ] Git commit pushed

---

**Ready? Start with STEP 1! 🚀**
