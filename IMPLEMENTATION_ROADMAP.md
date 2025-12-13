# 🚀 KONKREETNE TEGEVUSKAVA - PRIORITY JÄIKUS

## PHASE 1: QUICK WINS (Alustage siit - 2-3 päeva tööd)

### [ ] 1. Follow System UI Implementation (Priority: URGENT)
**Fuss:** 30-45 min  
**Kuhu:** UserProfile.tsx looduslikel

```typescript
// Lisa UserProfile.tsx-le
<button onClick={handleFollow} className="...">
  {isFollowing ? "Unfollow" : "Follow"}
</button>

// Näita "Following Activity" UserProfile-l
// Kasutaja näeb konkreetse inimese tegevusi
```

**Andmed juba olemas:** user_follows tabel ✅

---

### [ ] 2. User Reputation Score Display (Priority: HIGH)
**Fuss:** 15 min  
**Kuhu:** UserProfile.tsx, Navbar.tsx

```typescript
// UserProfile.tsx
<div className="reputation">
  ⭐ Reputation: {profile.reputation || 0}
</div>

// Käida parandab: "Top 10% uurijad", "Master Investigator"
```

---

### [ ] 3. Case Difficulty Rating System (Priority: HIGH)
**Fuss:** 45 min  
**Kuhu:** ExploreCases.tsx, CaseDetail.tsx

```typescript
// Cases tabelisse (SQL):
ALTER TABLE cases ADD difficulty_rating INTEGER DEFAULT 3;

// UI: ★★★★☆ näitamine
<div className="stars">{Array(5).map((_, i) => ...)}</div>

// ExploreCases filter: Näita filtering "Difficulty"
```

---

### [ ] 4. Login Streak Display (Priority: MEDIUM)
**Fuss:** 30 min  
**Kuhu:** UserProfile.tsx header

```typescript
// Kasutaja näeb: "🔥 7 päeva järjest"
// Näita streak counter
// Ligitõmbav: Motiveerib kasutajaid iga päev sisse logima
```

**Andmed juba olemas:** user_challenges tabel ✅

---

### [ ] 5. Badge Display System (Priority: MEDIUM)
**Fuss:** 30 min  
**Kuhu:** UserProfile.tsx, Leaderboard.tsx

```typescript
// Näita kasutaja badges ProBadge asemel
// Nt: "🏆 Case Solver", "🔬 Evidence Master"
// user_badges tabel on juba olemas
```

---

## PHASE 2: MEDIUM PRIORITY (1-2 nädalat)

### [ ] 6. Similar Cases Widget
**Fuss:** 45 min  
**Kuhu:** CaseDetail.tsx

```typescript
// Näita 3-5 sarnast juhtumit
// Filter: Sama kategooria, sama asukoha lähedal
<div className="similar-cases">
  {relatedCases.map(case => ...)}
</div>
```

---

### [ ] 7. Case Trending Indicator
**Fuss:** 30 min  
**Kuhu:** ExploreCases.tsx

```typescript
// Näita "🔥 Trending" märk
// Views last 7 days > average
```

---

### [ ] 8. Forum Moderation UI (Content Management)
**Fuss:** 60 min  
**Kuhu:** AdminDashboard.tsx - Content Management tab

```typescript
// Lisage forum_posts moderatsioon
// Näita pending posts
// Approve/Reject/Flag buttons
```

---

### [ ] 9. Case Progress Percentage
**Fuss:** 30 min  
**Kuhu:** ExploreCases.tsx, CaseDetail.tsx

```typescript
// Cases: Add `progress_percentage` (0-100)
// Visual: <progress max="100" value={progress} />
// Näita "Investigation 45% complete"
```

---

### [ ] 10. Case Bookmark/Save System
**Fuss:** 60 min  
**Kuhu:** CaseDetail.tsx

```typescript
// Create: user_saved_cases table
// Lisage "Save for later" nupp
// UserProfile näitab "Saved cases" sektsioon
```

---

## PHASE 3: MAJOR FEATURES (2-3 nädalat)

### [ ] 11. Geographic Heatmap (Admin Analytics)
**Fuss:** 120 min  
**Kuhu:** AdminDashboard.tsx - Analytics tab

```typescript
// Asenda "Top Countries" list heatmap-iga
// Kasutage: react-leaflet + heatmap plugin
// Näita country-specific case concentration
```

**Andmed juba kogutud:** analytics_events.country ✅

---

### [ ] 12. Case Category Trends Chart
**Fuss:** 90 min  
**Kuhu:** AdminDashboard.tsx - Analytics tab

```typescript
// Line chart: UFO vs Cryptid vs Paranormal popularity over time
// X-axis: months
// Y-axis: case count
// Kasutage: recharts (juba installeeritud)
```

---

### [ ] 13. Evidence Upvoting System
**Fuss:** 120 min  
**Kuhu:** CaseDetail.tsx, CaseComments.tsx

```typescript
// Create: evidence_likes table
// Kasutajad saavad like-ida tõendeid
// Parimad tõendid ülal
// Feature: Ligitõmbav - competing evidence quality-st
```

---

### [ ] 14. Community Voting/Theories
**Fuss:** 180 min  
**Kuhu:** CaseDetail.tsx - uus "Theories" tab

```typescript
// Create: case_theories table
// Kasutajad postavad teooriad
// Hääletamine: "UFO" vs "Weather balloon" vs "Unknown"
// Näita: "75% believe UFO, 15% weather, 10% unknown"
```

---

### [ ] 15. Investigator Team Analytics
**Fuss:** 90 min  
**Kuhu:** InvestigatorDashboard.tsx

```typescript
// Lisage metricsed:
// - Cases per team member
// - Average resolution time
// - Success rate by category
// - Team contribution graph
```

---

## PHASE 4: POLISH & OPTIMIZATION (2-3 nädalat)

### [ ] 16. Case Investigation Templates
**Fuss:** 120 min  
**Kuhu:** SubmitCaseForm.tsx, CaseFolder.tsx

```typescript
// Admin loob template-id (nt "UFO Sighting Checklist")
// Kasutajad kopeerivad template-st
// Kiirendab protsessi
```

---

### [ ] 17. Bulk Admin Operations
**Fuss:** 150 min  
**Kuhu:** AdminDashboard.tsx

```typescript
// Bulk case assignment
// Bulk user banning
// Bulk email campaigns
// Checkbox select + action buttons
```

---

### [ ] 18. User Behavior Timeline (Admin)
**Fuss:** 120 min  
**Kuhu:** AdminDashboard.tsx - uus "User Activity" tab

```typescript
// Valida user
// Näita: Login times, case submissions, comments timeline
// Fraud detection: Same IP, multiple accounts
```

---

### [ ] 19. Analytics Export (PDF/CSV)
**Fuss:** 90 min  
**Kuhu:** AdminDashboard.tsx

```typescript
// Add buttons: "Export PDF" / "Export CSV"
// Genereerib kuukaarte raportit
// Kasutage: jsPDF, papaparse
```

---

### [ ] 20. Notification Panel (Global)
**Fuss:** 60 min  
**Kuhu:** Navbar.tsx

```typescript
// Avaks notification dropdown
// Näita: New messages, case updates, badge earned
// Nüüd ainult /messages lehel nähtav
```

---

## 🎯 SOOVITAV JÄIKUS (Alustage siit)

### WEEK 1 (40 tunni aeg jooksul)
- [ ] Phase 1: Quick Wins (1-5)
- [ ] 6. Similar Cases Widget
- [ ] 7. Case Trending Indicator
- [ ] 9. Case Progress Percentage

### WEEK 2 (40 tunni aeg jooksul)
- [ ] 8. Forum Moderation UI
- [ ] 10. Case Bookmark System
- [ ] 11. Geographic Heatmap
- [ ] 12. Trend Analysis Chart

### WEEK 3+ (Jätkuv parandus)
- [ ] 13-20. Major features & polish

---

## 📊 MÕJU SCORECARD

| Feature | Effort | Impact | Priority |
|---------|--------|--------|----------|
| Follow System | 30m | HIGH | 🔴 |
| Reputation Display | 15m | MEDIUM | 🟡 |
| Difficulty Ratings | 45m | MEDIUM | 🟡 |
| Login Streaks | 30m | HIGH | 🔴 |
| Badges | 30m | MEDIUM | 🟡 |
| Similar Cases | 45m | MEDIUM | 🟡 |
| Trending Indicator | 30m | LOW | 🟢 |
| Forum Moderation | 60m | HIGH | 🔴 |
| Progress Bar | 30m | LOW | 🟢 |
| Case Bookmarks | 60m | MEDIUM | 🟡 |
| Heatmap | 120m | MEDIUM | 🟡 |
| Trends Chart | 90m | MEDIUM | 🟡 |
| Evidence Voting | 120m | HIGH | 🔴 |
| Theories/Voting | 180m | HIGH | 🔴 |
| Team Analytics | 90m | MEDIUM | 🟡 |
| **KOKKU** | **~1500 min** | - | - |
| **≈ päevades** | **~25 päeva** | - | - |

---

## ⚠️ PÖÖRAKE TÄHELEPANU

1. **Suurem osa andmetest JA JUBA OLEMAS** - ainult UI puudub
2. **Kasutajad ei tea, et nende andmed on kogutud** (teekond, badge, jne)
3. **Analytics on olemas, aga admin ei näe visualiseeringu** (heatmap, trends)
4. **Engagement features pool ei tööta** (voting, similar cases, jne)

Otsingug: Valmistada user-facing features nähtavaks, mis juba salates andmeid koguvad.

