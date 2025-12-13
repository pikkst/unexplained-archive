# ⚡ PHASE 1 QUICK START REFERENCE

## What's Been Created

✅ **New Components:**
- `UserStats.tsx` - Reputation, badges, streaks, followers
- `CaseDifficulty.tsx` - Star ratings + community voting

✅ **SQL File:**
- `supabase/phase-1-setup.sql` - Database schema

✅ **Guides:**
- `PHASE_1_IMPLEMENTATION_GUIDE.md` - Detailed instructions
- `PHASE_1_IMPLEMENTATION_STEPS.md` - Step-by-step guide
- `PHASE_1_QUICK_START_REFERENCE.md` - This file!

---

## 3 SIMPLE STEPS TO COMPLETE PHASE 1

### Step 1: Database (5 min)
```
→ Open Supabase SQL Editor
→ Copy all code from: supabase/phase-1-setup.sql
→ Run it (Ctrl+Enter)
→ Done!
```

### Step 2: Update Files (20 min)
```
→ Open src/components/UserProfile.tsx
→ Add: import { UserStats } from './UserStats';
→ Replace the Stats section (see guide)
→ Add reputation badge at top
```

### Step 3: Add to Views (15 min)
```
→ ExploreCases.tsx - Add <CaseDifficulty /> to case cards
→ CaseDetail.tsx - Add <CaseDifficulty /> to details
→ Test in browser: npm run dev
```

---

## What Users Will See

### On Any Profile:
- ⭐ Reputation score (0-5000+)
- 🔥 Login streak count
- 👥 Followers/Following counts
- 🏆 All earned badges with dates
- Level indicator: Newcomer → Legend

### On Case Pages:
- ⭐⭐⭐ Difficulty stars (1-5)
- 📊 Community average rating
- 🗳️ Vote buttons (investigators only)
- ✓ Confirmation message after voting

### On User Cards:
- Follow/Unfollow button (works already!)
- Reputation display
- Role badge

---

## Database Changes

| Table | Change | Type |
|-------|--------|------|
| cases | ADD difficulty_level INT | Column |
| NEW | case_difficulty_votes | Table |
| NEW | case_difficulty_avg | View |

---

## Component Props

### UserStats
```typescript
<UserStats 
  userId="uuid-here"  // Required: user ID
/>
```

### CaseDifficulty
```typescript
<CaseDifficulty
  caseId="uuid-here"           // Required
  initialDifficulty={3}        // Optional: 1-5
  isInvestigator={false}       // Optional: show voting?
/>
```

---

## Testing Checklist

```
□ Run npm run dev
□ Visit your profile → See reputation & badges
□ Visit another profile → Click Follow
□ Open case → See difficulty stars
□ As investigator → Vote on difficulty
□ Refresh page → Vote persists
□ Mobile → All responsive
□ Console → No errors
```

---

## Git Commands When Done

```bash
git add src/components/UserStats.tsx
git add src/components/CaseDifficulty.tsx
git add src/components/UserProfile.tsx
git add src/components/ExploreCases.tsx
git add src/components/CaseDetail.tsx
git add supabase/phase-1-setup.sql

git commit -m "feat: Phase 1 - Reputation, badges, streaks, difficulty ratings"

git push origin main
```

---

## Estimated Timeline

| Task | Time |
|------|------|
| Database Setup | 5 min |
| UserProfile Update | 15 min |
| ExploreCases Update | 10 min |
| CaseDetail Update | 10 min |
| Testing | 10 min |
| Git Commit/Push | 5 min |
| **TOTAL** | **55 min** |

---

## Files You'll Touch

```
src/components/
├── UserProfile.tsx ← UPDATE (import + stats section)
├── ExploreCases.tsx ← UPDATE (add CaseDifficulty)
├── CaseDetail.tsx ← UPDATE (add CaseDifficulty + voting)
├── UserStats.tsx ← CREATED ✓
└── CaseDifficulty.tsx ← CREATED ✓

supabase/
└── phase-1-setup.sql ← CREATED ✓
```

---

## Common Gotchas

❌ **"UserStats not found"**
→ Check import path in UserProfile.tsx
→ Make sure file is saved

❌ **"Database error when voting"**
→ Run supabase/phase-1-setup.sql first!
→ Check Supabase SQL Editor for errors

❌ **"Profile not updating"**
→ Clear browser cache (Ctrl+Shift+Delete)
→ Refresh page

❌ **"Badges not showing"**
→ Check user_badges table has data
→ Check badge_id format matches BADGE_NAMES

---

## Features Included

| Feature | Component | Status |
|---------|-----------|--------|
| Reputation Display | UserStats | ✅ |
| Reputation Levels | UserStats | ✅ |
| Login Streaks | UserStats | ✅ |
| Badges Grid | UserStats | ✅ |
| Follower Count | UserStats | ✅ |
| Difficulty Stars | CaseDifficulty | ✅ |
| Difficulty Voting | CaseDifficulty | ✅ |
| Community Average | CaseDifficulty | ✅ |
| RLS Security | SQL | ✅ |

---

## Need Help?

1. **Database error?** → Check supabase/phase-1-setup.sql
2. **Component not showing?** → Check imports & file paths
3. **Data not loading?** → Check user IDs match & RLS policies
4. **Styling wrong?** → Check Tailwind CSS is imported
5. **Still stuck?** → Check browser console for error messages

---

## Success Indicators ✓

When all these show, Phase 1 is complete:

✓ Reputation badge on profile
✓ Badges grid displays your badges  
✓ Streaks show login count
✓ Difficulty stars on case cards
✓ Can vote on difficulty as investigator
✓ Follow/Unfollow button works
✓ No console errors
✓ All responsive on mobile
✓ Deployed to GitHub Pages
✓ Live features working

---

## What's Next?

After Phase 1 complete:
- [ ] Phase 2: Similar cases, trending, moderation
- [ ] Phase 3: Heatmap, trends, analytics
- [ ] Phase 4: Polls, notifications, admin tools

---

**Total Phase 1 Time: ~1 hour start to finish** ⏱️

Ready? Start with database setup! 🚀
