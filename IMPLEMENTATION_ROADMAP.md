# 🚀 IMPLEMENTATION ROADMAP - PRIORITY SCHEDULE

## PHASE 1: QUICK WINS ✅ COMPLETE (Start here - 2-3 days)

### [✓] 1. Follow System UI Implementation ✅ COMPLETE (Priority: URGENT)
**Time:** 30-45 min  
**Location:** UserProfile.tsx
**Status:** Live - Following Activity feed shows recent cases and comments from followed users

```typescript
// Add to UserProfile.tsx
<button onClick={handleFollow} className="...">
  {isFollowing ? "Unfollow" : "Follow"}
</button>

// Show "Following Activity" section
// Display specific user's recent case submissions and comments
```

**Existing Data:** user_follows table ✅

---

### [✓] 2. User Reputation Score Display ✅ COMPLETE (Priority: HIGH)
**Time:** 15 min  
**Location:** UserProfile.tsx, Navbar.tsx
**Status:** Live - Reputation displayed with rank badges (Novice → Legend)

```typescript
// UserProfile.tsx header
<div className="reputation">
  ⭐ Reputation: {profile.reputation || 0}
  <span className="rank">{getRankByReputation(profile.reputation)}</span>
</div>

// Ranks: "Novice", "Expert", "Master Investigator", "Legend"
```

---

### [✓] 3. Case Difficulty Rating System ✅ COMPLETE (Priority: HIGH)
**Time:** 45 min  
**Location:** ExploreCases.tsx, CaseDetail.tsx, Database
**Status:** Live - 5-star difficulty rating with filter, SQL migration created

```sql
-- Add to cases table
ALTER TABLE cases ADD COLUMN difficulty_rating INTEGER DEFAULT 3 CHECK (difficulty_rating BETWEEN 1 AND 5);
```

```typescript
// UI: Show ★★★★☆ rating
<div className="difficulty">
  {Array(5).map((_, i) => (
    <span key={i} className={i < difficulty ? "star-full" : "star-empty"}>★</span>
  ))}
</div>

// ExploreCases: Add filter for difficulty
<select onChange={(e) => setFilter({...filter, difficulty: e.target.value})}>
  <option value="">All Difficulties</option>
  <option value="1">Easy (★)</option>
  <option value="5">Impossible (★★★★★)</option>
</select>
```

---

### [✓] 4. Login Streak Display ✅ COMPLETE (Priority: MEDIUM)
**Time:** 30 min  
**Location:** UserProfile.tsx header
**Status:** Live - Streak displayed prominently in profile header stats

```typescript
// Show streak counter prominently
<div className="login-streak">
  🔥 {currentStreak} day streak
</div>

// Motivates daily login
// Pull from user_challenges table where challenge_type = 'login_streak'
```

---

### [✓] 5. Badge Display System ✅ COMPLETE (Priority: MEDIUM)
**Time:** 30 min  
**Location:** UserProfile.tsx, Leaderboard.tsx
**Status:** Already implemented - Badges display from user_badges table

```typescript
// Replace ProBadge with proper badge system
// user_badges table already has:
// - id, user_id, badge_type, earned_at

const BADGE_ICONS = {
  'case_solver': '🏆',
  'evidence_master': '🔬',
  'forum_expert': '💬',
  'first_case': '🎯',
  'top_100': '🌟'
};

// Display badges on profile
<div className="badges">
  {userBadges.map(badge => (
    <div key={badge.id} className="badge" title={badge.badge_type}>
      {BADGE_ICONS[badge.badge_type]}
    </div>
  ))}
</div>
```

---

## PHASE 2: MEDIUM PRIORITY ✅ COMPLETE (Weeks 2-3)

### [✓] 6. Similar Cases Widget ✅ COMPLETE
**Time:** 45 min  
**Location:** CaseDetail.tsx
**Status:** Live - Shows 3-5 related cases based on category and proximity

```typescript
// Show 3-5 related cases
// Filter: Same category, nearby location
const relatedCases = cases.filter(c =>
  c.category === currentCase.category &&
  isNearby(c.latitude, c.longitude, currentCase.latitude, currentCase.longitude) &&
  c.id !== currentCase.id
).slice(0, 5);

<section className="similar-cases">
  <h3>Similar Cases</h3>
  <div className="case-grid">
    {relatedCases.map(case => <CaseCard case={case} />)}
  </div>
</section>
```

---

### [✓] 7. Case Trending Indicator ✅ COMPLETE
**Time:** 30 min  
**Location:** ExploreCases.tsx
**Status:** Live - Shows 🔥 Trending badge for cases with high recent views

```typescript
// Show "🔥 Trending" badge
// Logic: Views in last 7 days > average views
const isTrending = caseViews.last7Days > averageViews * 1.5;

<div className="case-card">
  {isTrending && <span className="trending">🔥 Trending</span>}
  {/* ... rest of case card ... */}
</div>
```

---

### [✓] 8. Forum Moderation UI ✅ COMPLETE
**Time:** 60 min  
**Location:** AdminDashboard.tsx - Content Management tab
**Status:** Live - Admins can approve, delete, or flag forum posts

```typescript
// Add forum_posts moderation section
<div className="forum-moderation">
  <h3>Forum Posts Pending Review</h3>
  {pendingForumPosts.map(post => (
    <div className="moderation-item">
      <p>{post.title}</p>
      <p className="content">{post.content.substring(0, 200)}...</p>
      <div className="actions">
        <button onClick={() => approvePost(post.id)}>Approve</button>
        <button onClick={() => rejectPost(post.id)}>Reject</button>
        <button onClick={() => flagPost(post.id)}>Flag</button>
      </div>
      <select onChange={(e) => setPriority(post.id, e.target.value)}>
        <option value="low">Low Priority</option>
        <option value="high">High Priority</option>
        <option value="urgent">Urgent</option>
      </select>
    </div>
  ))}
</div>
```

---

### [✓] 9. Case Progress Percentage ✅ COMPLETE
**Time:** 30 min  
**Location:** ExploreCases.tsx, CaseDetail.tsx, Database
**Status:** Live - Visual progress bars with percentage display and status text

```sql
-- Add to cases table
ALTER TABLE cases ADD COLUMN progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage BETWEEN 0 AND 100);
```

```typescript
// Visual progress bar
<div className="case-progress">
  <progress max="100" value={case.progress_percentage} />
  <span>{case.progress_percentage}% complete</span>
</div>

// Investigation status
<div className="status">
  Investigation {case.progress_percentage}% complete
</div>
```

---

### [✓] 10. Case Bookmark/Save System ✅ COMPLETE
**Time:** 60 min  
**Location:** CaseDetail.tsx, UserProfile.tsx
**Status:** Live - Users can save cases and view them in profile saved tab

```sql
-- Create table
CREATE TABLE user_saved_cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  case_id UUID REFERENCES cases(id),
  saved_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, case_id)
);
```

```typescript
// CaseDetail.tsx: Add bookmark button
<button onClick={handleSaveCase} className="bookmark-btn">
  {isSaved ? "📌 Saved" : "☐ Save for Later"}
</button>

// UserProfile.tsx: Show saved cases section
<section className="saved-cases">
  <h3>Saved Cases</h3>
  {savedCases.map(case => <CaseCard case={case} />)}
</section>
```

---

## PHASE 3: MAJOR FEATURES (3-4 weeks)

### [ ] 11. Geographic Heatmap (Admin Analytics)
**Time:** 120 min  
**Location:** AdminDashboard.tsx - Analytics tab

```typescript
// Replace "Top Countries" list with interactive heatmap
import { MapContainer, TileLayer, HeatmapLayer } from 'react-leaflet';

// Get coordinates for each country
const heatmapData = topCountries.map(country => [
  getCountryCenter(country.name).lat,
  getCountryCenter(country.name).lng,
  country.visits / maxVisits // Intensity 0-1
]);

<MapContainer center={[20, 0]} zoom={2}>
  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
  <HeatmapLayer points={heatmapData} />
</MapContainer>
```

**Data Already Collected:** analytics_events.country ✅

---

### [ ] 12. Case Category Trends Chart
**Time:** 90 min  
**Location:** AdminDashboard.tsx - Analytics tab

```typescript
// Line chart: UFO vs Cryptid vs Paranormal popularity over time
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const trendData = getCategoryTrendsByMonth(); // X: months, Y: case count

<LineChart width={800} height={400} data={trendData}>
  <CartesianGrid />
  <XAxis dataKey="month" />
  <YAxis />
  <Tooltip />
  <Legend />
  <Line type="monotone" dataKey="UFO" stroke="#6366f1" />
  <Line type="monotone" dataKey="Cryptid" stroke="#16a34a" />
  <Line type="monotone" dataKey="Paranormal" stroke="#9333ea" />
  <Line type="monotone" dataKey="Supernatural" stroke="#dc2626" />
</LineChart>
```

---

### [ ] 14b. User-Created Polls System (MONETIZATION)
**Time:** 200 min  
**Priority:** HIGH  
**Location:** PollCreationForm.tsx, PollsPage.tsx, AdminDashboard.tsx

**Feature:** Users pay to create surveys/polls with dedicated public page

**Architecture:**
1. **Landing Page** - Featured section: Top 3-5 paid polls (trending/newest)
2. **Polls Page** - Dedicated `/polls` route showing all polls (public, guests welcome)
3. **Poll Detail** - Individual poll voting interface
4. **Admin Panel** - Moderation and approval queue

**Cost Structure:**
- 1€ = 3-day poll
- 5€ = 7-day poll
- 10€ = 14-day poll  
- 15€ = 30-day poll
- Max 50 active polls simultaneously
- Payment via Stripe wallet or card

**Database Schema:**
```sql
-- Polls table
CREATE TABLE user_polls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'general', 'case_related', 'theory'
  cost_eur DECIMAL(5,2),
  duration_days INT, -- 3, 7, 14, 30
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT, -- 'pending_approval', 'active', 'closed'
  total_votes INT DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE -- Show on landing page
);

-- Poll options
CREATE TABLE poll_options (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID REFERENCES user_polls(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  vote_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User votes (one vote per user per poll)
CREATE TABLE poll_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID REFERENCES user_polls(id),
  option_id UUID REFERENCES poll_options(id),
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(poll_id, user_id)
);

-- Track poll creator earnings
CREATE TABLE poll_earnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID REFERENCES user_polls(id),
  creator_id UUID REFERENCES auth.users(id),
  amount_eur DECIMAL(5,2),
  earned_at TIMESTAMPTZ DEFAULT now()
);
```

**UI Components:**
- `PollCreationForm.tsx` - Create with cost selection
- `PollsPage.tsx` - Public polls directory (public route, guest accessible)
- `PollList.tsx` - Landing page featured section (3-5 top polls)
- `PollDetail.tsx` - Vote on poll and see live results  
- `AdminPollApproval.tsx` - Admin moderation queue
- `UserPollsDashboard.tsx` - Creator earnings dashboard

**Landing Page Update:**
```typescript
// LandingPage.tsx: Featured Polls Section
<section className="featured-polls">
  <h2>Active Polls</h2>
  <p>See what the community thinks</p>
  {topPolls.slice(0, 5).map(poll => (
    <div className="poll-card">
      <h3>{poll.title}</h3>
      <p>{poll.total_votes} votes • {poll.days_remaining} days left</p>
      <div className="poll-preview">
        {poll.options.slice(0, 2).map(opt => (
          <div className="option">
            <span>{opt.percentage}%</span> {opt.text}
          </div>
        ))}
      </div>
      <Link to={`/polls/${poll.id}`}>View Full Poll →</Link>
    </div>
  ))}
  <Link to="/polls" className="view-all">View All Polls →</Link>
</section>
```

**Polls Page Route:**
```typescript
// routes.tsx
{
  path: '/polls',
  element: <PollsPage /> // Public route, guests welcome
}

// PollsPage.tsx
<div className="polls-container">
  <h1>Community Polls</h1>
  <div className="filters">
    <input type="search" placeholder="Search polls..." />
    <select>
      <option>All Categories</option>
      <option>Case Related</option>
      <option>General</option>
      <option>Theory</option>
    </select>
    <select>
      <option>Most Recent</option>
      <option>Most Voted</option>
      <option>Trending</option>
    </select>
  </div>
  
  <div className="polls-grid">
    {allPolls.map(poll => (
      <PollCard poll={poll} key={poll.id} />
    ))}
  </div>
</div>
```

**Revenue Model:**
- Creator gets 70% (0.70€ from 1€ poll)
- Platform gets 30% (monetization revenue)
- Payments processed via Stripe

**Admin Moderation:**
- Approve/reject polls before going live
- Prevent spam, nonsensical, or inappropriate polls
- Can close polls early if problematic
- View approval history

**Gamification:**
- Badge: "Poll Creator" (created first poll)
- Badge: "Influencer" (poll got 100+ votes)
- Badge: "Voice of the Community" (poll got 500+ votes)
- Reputation boost for creating popular polls
- Points earned when poll is created

---

### [ ] 15. Evidence Upvoting System
**Time:** 120 min  
**Location:** CaseDetail.tsx, CaseComments.tsx

```sql
-- Create table
CREATE TABLE evidence_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id UUID REFERENCES comments(id),
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comment_id, user_id)
);
```

```typescript
// CaseComments: Add upvote button
<div className="evidence-item">
  <button onClick={() => likeEvidence(comment.id)} className="upvote">
    👍 {comment.likes || 0}
  </button>
  <p>{comment.content}</p>
</div>

// Sort comments by likes
const sortedComments = comments.sort((a, b) => (b.likes || 0) - (a.likes || 0));
```

---

### [ ] 16. Community Voting/Theories
**Time:** 180 min  
**Location:** CaseDetail.tsx - new "Theories" tab

```sql
-- Create table
CREATE TABLE case_theories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID REFERENCES cases(id),
  user_id UUID REFERENCES auth.users(id),
  theory_type TEXT, -- e.g., "UFO", "Weather Balloon", "Unknown"
  description TEXT,
  votes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE theory_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  theory_id UUID REFERENCES case_theories(id),
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(theory_id, user_id)
);
```

```typescript
// CaseDetail.tsx: New "Theories" tab
<section className="theories">
  <h3>Community Theories</h3>
  
  {/* Theory voting display */}
  {theoryVotes.map(theory => (
    <div className="theory">
      <button onClick={() => voteTheory(theory.id)}>
        👍 {theory.votes}
      </button>
      <span className="percentage">
        {Math.round((theory.votes / totalVotes) * 100)}% believe {theory.theory_type}
      </span>
      <p>{theory.description}</p>
    </div>
  ))}
  
  {/* Submit new theory */}
  <textarea placeholder="Submit your theory..." />
  <select>
    <option value="UFO">UFO</option>
    <option value="Weather Balloon">Weather Balloon</option>
    <option value="Unknown">Unknown</option>
  </select>
  <button onClick={submitTheory}>Submit Theory</button>
</section>
```

---

### [ ] 17. Investigator Team Analytics
**Time:** 90 min  
**Location:** InvestigatorDashboard.tsx

```typescript
// Add metrics section
<section className="team-analytics">
  <div className="metric">
    <h4>Cases per Member</h4>
    <BarChart data={membersWithCaseCounts} />
  </div>
  
  <div className="metric">
    <h4>Average Resolution Time</h4>
    <p>{avgResolutionTime} days</p>
  </div>
  
  <div className="metric">
    <h4>Success Rate by Category</h4>
    <PieChart data={successRateByCategory} />
  </div>
  
  <div className="metric">
    <h4>Team Contribution</h4>
    <ProgressBar members={teamMembers} />
  </div>
</section>
```

---

## PHASE 4: POLISH & OPTIMIZATION (3-4 weeks)

### [ ] 17. Case Submission Templates (USER Feature)
**Time:** 90 min  
**Location:** SubmitCaseForm.tsx

```sql
-- Create table
CREATE TABLE case_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  form_fields JSONB, -- Pre-filled fields
  created_by UUID REFERENCES auth.users(id),
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

```typescript
// SubmitCaseForm.tsx: Add template selector
<div className="template-selector">
  <label>Start from template (optional)</label>
  <select onChange={(e) => loadTemplate(e.target.value)}>
    <option value="">Create from scratch</option>
    <option value="ufo">UFO Sighting Checklist</option>
    <option value="cryptid">Cryptid Encounter Guide</option>
    <option value="paranormal">Paranormal Activity Report</option>
    <option value="supernatural">Supernatural Event Form</option>
  </select>
</div>

// When selected, pre-fill form fields with template guidance
// Help users provide complete, structured information
```

---

### [ ] 18. Investigation Procedure Templates (INVESTIGATOR Feature)
**Time:** 90 min  
**Location:** CaseFolder.tsx

```sql
-- Create table
CREATE TABLE investigation_procedures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT,
  step_order INTEGER,
  description TEXT,
  required_evidence TEXT[],
  checklist_items JSONB,
  created_by UUID REFERENCES auth.users(id),
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

```typescript
// CaseFolder.tsx: Add procedure guide sidebar
<div className="investigation-procedure">
  <h4>Investigation Procedure</h4>
  <select onChange={(e) => loadProcedure(e.target.value)}>
    <option value="">No procedure</option>
    <option value="standard-ufo">Standard UFO Investigation</option>
    <option value="cryptid-hunt">Cryptid Investigation Protocol</option>
    <option value="paranormal-check">Paranormal Evidence Collection</option>
  </select>
  
  {procedure && (
    <div className="procedure-steps">
      {procedure.checklist_items.map((item, i) => (
        <div key={i} className="step">
          <input type="checkbox" />
          <p>{item.description}</p>
          <small>Required: {item.required_evidence.join(', ')}</small>
        </div>
      ))}
    </div>
  )}
</div>
```

---

### [ ] 19. Bulk Admin Operations
**Time:** 150 min  
**Location:** AdminDashboard.tsx

---

### [ ] 20. User Behavior Timeline (Admin)
**Time:** 120 min  
**Location:** AdminDashboard.tsx - new "User Activity" tab

---

### [ ] 21. Analytics Export (PDF/CSV)
**Time:** 90 min  
**Location:** AdminDashboard.tsx

---

### [ ] 22. Global Notification Panel
**Time:** 60 min  
**Location:** Navbar.tsx

---

## 📅 RECOMMENDED SCHEDULE

### Week 1 (40 hours)
- [ ] Phase 1: Quick Wins (1-5)
- [ ] 6. Similar Cases Widget
- [ ] 7. Case Trending Indicator
- [ ] 9. Case Progress Percentage

### Week 2 (40 hours)
- [ ] 8. Forum Moderation UI
- [ ] 10. Case Bookmark System
- [ ] 11. Geographic Heatmap
- [ ] 12. Trend Analysis Chart

### Week 3+ (Ongoing)
- [ ] 13-20. Major features & polish

---

## 🎯 IMPACT SCORECARD

| Feature | Effort | User Impact | Admin Impact | Priority |
|---------|--------|------------|-------------|----------|
| Follow System | 30m | HIGH | - | 🔴 |
| Reputation Display | 15m | MEDIUM | - | 🟡 |
| Difficulty Ratings | 45m | MEDIUM | MEDIUM | 🟡 |
| Login Streaks | 30m | HIGH | - | 🔴 |
| Badges | 30m | MEDIUM | - | 🟡 |
| Similar Cases | 45m | MEDIUM | - | 🟡 |
| Trending Indicator | 30m | LOW | - | 🟢 |
| Forum Moderation | 60m | - | HIGH | 🔴 |
| Progress Bar | 30m | LOW | - | 🟢 |
| Case Bookmarks | 60m | MEDIUM | - | 🟡 |
| Heatmap | 120m | - | MEDIUM | 🟡 |
| Trends Chart | 90m | - | MEDIUM | 🟡 |
| Evidence Voting | 120m | HIGH | - | 🔴 |
| Community Theories | 180m | HIGH | - | 🔴 |
| User Polls (Monetized) | 200m | HIGH | MEDIUM | 🔴 |
| Team Analytics | 90m | HIGH | - | 🟡 |
| Case Submission Templates | 90m | HIGH | - | 🔴 |
| Investigation Procedures | 90m | HIGH | - | 🔴 |
| Bulk Admin Operations | 150m | - | HIGH | 🔴 |
| User Behavior Timeline | 120m | - | MEDIUM | 🟡 |
| Analytics Export | 90m | - | MEDIUM | 🟡 |
| Notification Panel | 60m | HIGH | - | 🔴 |

**Total Effort:** ~2000 minutes (~33 days of focused work)

---

## ⚠️ KEY INSIGHT

**Most data is already being collected - only UI implementation is missing.**

Examples:
- user_challenges → Streaks tracked but not displayed
- user_badges → Badges earned but not shown
- user_follows → Follow relationships exist but no UI
- analytics_events.country → Geography tracked but not visualized
- case_comments → Evidence collected but not voted on

**New Monetization Feature:**
- **User Polls** (Task 14b) - Users pay 1€-15€ to create surveys visible on landing page
- Platform earns 30%, creator keeps 70%
- High engagement + revenue opportunity

