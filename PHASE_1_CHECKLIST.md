# ⚡ QUICK ACTION CHECKLIST

## 🎯 DO THIS RIGHT NOW (5-10 minutes)

### Step 1: Run Database Setup
```
⬜ Go to: https://supabase.com → Your Project → SQL Editor
⬜ Click "New Query"
⬜ Open file: supabase/PHASE_1_SETUP.sql
⬜ Copy entire content
⬜ Paste into SQL Editor
⬜ Click "Run"
⬜ Wait for green "Success" message
```

**Expected Output:**
```
✓ Multiple queries executed successfully
✓ No error messages
```

---

## 🔍 VERIFY IN SUPABASE (2 minutes)

Click **Data Browser** in Supabase:

```
⬜ Find table: case_difficulty_votes → EXISTS ✓
⬜ Find table: user_follows → EXISTS ✓
⬜ Find table: user_badges → EXISTS ✓
⬜ Find table: badges → EXISTS ✓
⬜ Find table: user_challenges → EXISTS ✓
⬜ Find table: challenges → EXISTS ✓
```

---

## 💻 BUILD & TEST LOCALLY (15 minutes)

```bash
# Terminal 1: Start dev server
npm run dev

# Wait for "Local: http://localhost:5173" message
```

Open browser to: **http://localhost:5173**

```
⬜ Go to your profile page
⬜ Look for "Badges" section (might be empty)
⬜ Look for "Login Streak" section (if you have streak data)
⬜ Check stats show: Reputation, Cases, Following, Followers
⬜ Go to a case detail page
⬜ Look for "How difficult is this case?" section
⬜ Click 1-5 stars to rate difficulty
⬜ Refresh page - rating should stay
⬜ Check Console (F12) - no red errors
```

---

## 📝 REMAINING WORK (30 minutes total)

### Task A: Add CaseDifficultyRating to CaseDetail (15 min)

**File:** `src/components/CaseDetail.tsx`

**Find:** Around line 200-250 (look for case title/description)

**Add this import at top:**
```typescript
import { CaseDifficultyRating } from './CaseDifficultyRating';
```

**Add this in JSX** (after case description):
```typescript
<div className="mt-8">
  <CaseDifficultyRating 
    caseId={caseId}
    currentDifficulty={caseDetail?.difficulty_level || 3}
  />
</div>
```

---

### Task B: Add Difficulty Stars to ExploreCases (15 min)

**File:** `src/components/ExploreCases.tsx`

**Find:** Case card JSX (where case title/description shown)

**Add this function:**
```typescript
const getDifficultyLabel = (level: number): string => {
  const labels: Record<number, string> = {
    1: 'Easy', 2: 'Medium', 3: 'Hard', 4: 'Very Hard', 5: 'Extremely Hard'
  };
  return labels[level] || 'Unknown';
};
```

**Add this in case card:**
```typescript
<div className="mt-2 flex items-center gap-1">
  {[1, 2, 3, 4, 5].map(i => (
    <span key={i} className={i <= (caseItem.difficulty_level || 3) ? 'text-yellow-400' : 'text-gray-400'}>
      ★
    </span>
  ))}
  <span className="ml-2 text-xs text-gray-400">
    {getDifficultyLabel(caseItem.difficulty_level || 3)}
  </span>
</div>
```

---

## ✅ FINAL STEP: Commit Changes

```bash
git add -A

git commit -m "feat: Phase 1 - Badges, streaks, difficulty ratings

✨ Features:
- User badges display on profile (Trophy icon)
- Login streak display on profile (Fire emoji)
- Follow/follower count display updated
- Case difficulty rating component with 1-5 stars
- Difficulty display on case detail page
- Difficulty stars on case cards

🗄️ Database:
- case_difficulty_votes table + RLS
- case_difficulty_avg view
- badges & challenges lookup tables
- 8 badges + 4 challenges added

⏱️ Time: ~2.5 hours
📊 Status: 40% of Phase 1 complete"

git push
```

---

## 🎉 CURRENT PROGRESS

### Completed (40%)
- ✅ UserProfile badges section
- ✅ UserProfile streaks section
- ✅ UserProfile follow counts
- ✅ CaseDifficultyRating component
- ✅ Database schema + RLS

### Remaining (60%)
- ⏳ Integrate into CaseDetail (15 min)
- ⏳ Integrate into ExploreCases (15 min)
- ⏳ Test everything (15 min)
- ⏳ Commit & push (5 min)

---

## 📊 WHAT WORKS NOW

```
✓ Follow system (click follow/unfollow)
✓ Reputation display (shows score)
✓ Badges section (if user has badges)
✓ Streaks section (if user has streaks)
✓ Difficulty rating component (ready to use)
```

---

## 🚀 NEXT PHASE AFTER THIS

Once Phase 1 is done (est. 2.5-3 hours):

1. **Phase 2: Medium Features** (3-4 days)
   - Similar cases widget
   - Case trending indicator
   - Case bookmarks
   - Forum moderation

2. **Phase 3: Major Features** (1 week)
   - Heatmap
   - Trends analysis
   - Evidence voting
   - Community theories

3. **Phase 4: Polish** (3-4 days)
   - Templates (users & investigators)
   - Bulk operations (admin)
   - Analytics export
   - Notification panel

4. **Phase 4b: Monetization** (3 days)
   - User-created polls
   - Paid polls system
   - Admin poll approval

---

## ⚠️ COMMON ISSUES

| Issue | Solution |
|-------|----------|
| Badges section empty | Badges show only if user has earned badges. That's normal. |
| Streaks section missing | Only shows if user has active login streak with progress > 0 |
| Difficulty component not appearing | Make sure you added it to CaseDetail.tsx JSX |
| Stars not clickable | Make sure you're logged in, component handles that |
| Build fails | Run `npm install` then `npm run dev` |

---

## 📱 BROWSER TEST

Open DevTools (F12):
```
⬜ No red errors in Console
⬜ Network tab shows all requests 200/201
⬜ Application → Cookies shows auth token
```

---

**Total Remaining Time: ~50 minutes**

**Estimated Completion: 14:00-15:00 (depending on start time)**
