# 🔍 UNEXPLAINED ARCHIVE - PÕHJALIK PLATVORMAUDIT

**Kuupäev:** 13. detsember 2025  
**Status:** Tootmis-valmis (v1.0)

---

## 📋 ROLLID & JUURDEPÄÄS

| Roll | Kirjeldus | Leitud | Puudu | Märkused |
|------|-----------|--------|-------|----------|
| **GUEST** | Sisselogimata külalis | ✅ | - | Juurdepääs avalikele lehtedele |
| **USER** | Tavakasutaja | ✅ | - | Saab juhtumeid luua, kommenteerida |
| **INVESTIGATOR** | Uurija | ✅ | ⚠️ | Vajab parandusi |
| **ADMIN** | Administraator | ✅ | ⚠️ | Basistoolid olemas, täiendused vajalikud |

---

## 🎯 KÜLALISE KOGEMUS (Guest/Unauthenticated)

### ✅ OLEMAS
- [x] Landing page - **LandingPage.tsx** - Hästi tehtud, atraktiivne
- [x] Case exploration - **ExploreCases.tsx** - Filtreerimine, sorteerimine
- [x] Interactive map - **CaseMap.tsx** - Kasutajasõbralik
- [x] Forum read-only - **Forum.tsx** - Saab vaadata teemasid (kommenteerimine keelatud)
- [x] Leaderboard - **Leaderboard.tsx** - Näeb top uurijaid
- [x] Case details view - **CaseDetail.tsx** - Saab lugeda juhtumeid
- [x] About/Contact - **StaticPages.tsx** - Infolehed
- [x] Authentication modal - **AuthModal.tsx** - Login/register

### ⚠️ PUUDU VÕI VAJAB PARANDUST
1. **Case difficulty rating** - Ei ole kuvatav (★★★★★)
   - Tuleks CaseDetail.tsx-le lisada
   
2. **"Similar cases" widget** - Pole olemas
   - Seotud juhtumite soovitus puudub
   - Tegelik feature: CaseDetail kuvatakse kommentaarid, aga soovitused puuduvad

3. **Case trending indicator** - Pole nähtav
   - Millist juhtumit kõige rohkem vaadatakse
   
4. **Analytics tracking** - ✅ OLEMAS
   - useAnalytics.ts - Jälgib külastajaid
   - Nüüdsest ka geolocation (riik) jälgitud

### 🔴 MÄRKUSED
- Forum on read-only - korrektselt piiranguga
- Map filter on nüüd mobile-optimeeritud
- Külalis ei pääse wallet/submit-case lehtedele (korrektselt)

---

## 👤 TAVAKASUTAJA (USER)

### ✅ OLEMAS
- [x] Profile page - **UserProfile.tsx** - Saab muuta nime, bio, avatari
- [x] Case submission - **SubmitCaseForm.tsx** - Koos geolokatsiooni valikuga
- [x] Case editing - CaseFolder-i osana
- [x] Wallet system - **Wallet.tsx** - Deposit/withdraw
- [x] Forum participation - Saab kommenteerida ja luua teemasid
- [x] Comments on cases - **CaseComments.tsx** - Saab tõendeid lisada
- [x] Messages/Inbox - **Inbox.tsx** - DM teiste kasutajatega
- [x] Leaderboard participation - Nägime punkte ja positsiooni
- [x] Donate feature - **DonationPage.tsx** - Saab raha heaks otstarbeks anda
- [x] Investigator application - **InvestigatorApplicationForm.tsx** - Saab kandideerida

### ⚠️ PUUDU VÕI VAJAB PARANDUST

1. **User profile - PUBLIC URL** 
   - ✅ OLEMAS: `/profile/:username` - avalik profiil
   - ⚠️ PUUDU: Follow nupp (saaks jälgida teisi kasutajaid)
     - user_follows tabel on olemas, aga UI on puudu
     - Follow/Unfollow funktsioon pole UserProfile-l nähtav

2. **Case bookmarking/saving**
   - ❌ PUUDU: "Save for later" funktsioon
   - Ei ole UI nuppu või tabelit

3. **Daily challenges/login streaks**
   - ✅ Tabel: user_challenges (olemas)
   - ❌ UI on puudu UserProfile-lt
   - AdminDashboard näitab ainult admin-le

4. **Achievement badges**
   - ✅ Tabel: user_badges (olemas)
   - ❌ UI näitamine puudu

5. **Notification system**
   - ✅ Tabel: notifications (olemas)
   - ⚠️ UI: Navbar näitab bell icon, aga sisaldus pole nähtav
   - Inbox sees olemas teately, aga globaalne notification panel puudub

6. **History/reading list**
   - ❌ PUUDU: "Vaadatud juhtumid" tracking
   - Tabel case_views pole nähtav

7. **Reputation/points display**
   - ✅ reputation väli profiles-tabelis
   - ❌ UI näitamine puudu

### 🟡 VARJATUD FEATURES (Olemas, aga raskesti leitav)
- Investigator subscription - `/subscription/plans` route
- Team collaboration - Kujul rewardSplitModal, aga UI pole selge

---

## 🔬 UURIJA (INVESTIGATOR)

### ✅ OLEMAS
- [x] Case assignment - AdminDashboard kaudu
- [x] Case management - **CaseFolder.tsx** - Intake, Evidence, Journal, Docs, Report
- [x] Investigation log - JOURNAL tab koos timeline-ga
- [x] Wallet/rewards - Sama nagu USER + earns reward
- [x] Subscription plans - **InvestigatorSubscriptionPlans.tsx** - 3 taset
- [x] Team creation & collaboration - **TeamDashboard.tsx**
- [x] Reward split - **RewardSplitModal.tsx** - Jaga masin tiimiga
- [x] Background checks - Admin teeb, investigator näeb status
- [x] Case resolution submission - Final Report tab

### ⚠️ PUUDU VÕI VAJAB PARANDUST

1. **Investigator dashboard analytics**
   - ✅ OLEMAS: **InvestigatorDashboard.tsx**
   - ✅ Näitab: Assigned cases, resolved count, stats
   - ⚠️ PUUDU: 
     - Cases completed per month timeline
     - Average resolution time
     - Team member contributions tracking
     - Case success rate by category

2. **Case progress visibility**
   - ⚠️ Case status on olemas, aga percentage pole nähtav
   - Soovitus: Lisa progress bar (30% complete)

3. **Investigation templates**
   - ❌ PUUDU: Ettemallid uutele juhtumitele
   - Oleks hea kiirustamiseks

4. **Bulk operations**
   - ❌ PUUDU: Valida 10 juhtumit ja toimida korraga
   - Praegu ainult üks korraga

5. **Case notes/documentation system**
   - ✅ Investigation log on olemas
   - ⚠️ Aga dokumendisüsteem on liiga primitiivne
   - PDF export pole automaatne

6. **Evidence tagging**
   - ❌ PUUDU: Tõendite märgistamine (DNA, Video, Witness)
   - Üldised tõendid, kuid ei ole kategooriaid

7. **Subscription features visibility**
   - ✅ Plaan näidatakse
   - ⚠️ Aga subscriptioni planides olevate features-te kasutamine ei ole nähtav
   - Nt: API access, analytics, team members - ei ole UI-s

### 🟡 VARJATUD FEATURES
- Team management - TeamManagementPanel.tsx olemas, aga raskesti leitav
- Verification status - Admin approval näidatakse, aga request form pole piisav

---

## ⚙️ ADMIN DASHBOARD

### ✅ OLEMAS
- [x] Overview tab - Stats, page views, traffic sources
- [x] Analytics - **Analytics & SEO** tab
  - ✅ Page views, unique visitors, traffic sources
  - ✅ Top pages, top countries (nüüdsest, geolocation lisatud)
  - ✅ Bounce rate, avg session
  
- [x] Content management - **Content Management** tab
  - ✅ Case moderation
  - ✅ Comment moderation
  - ⚠️ Forum moderation - pole nähtav

- [x] User applications - **Applications** tab
  - ✅ Investigator approvals
  - ✅ Background check reviews
  - ⚠️ User bans pole nähtav

- [x] Transactions tab
  - ✅ Wallet transactions näitamine
  - ✅ Filtreerimine kuupäeva järgi
  - ⚠️ Revenue analytics puudub

### ⚠️ PUUDU VÕI VAJAB PARANDUST

1. **Geographic heatmap**
   - Tabel: analytics_events country väli ✅
   - Pero UI pole interaktiivne kaart - ainult "Top Countries" list
   - Soovitus: Kasutada [react-leaflet-heatmap](https://github.com/openbase/react-leaflet-heatmap)

2. **Trend analysis**
   - ❌ PUUDU: Millised kategooriad on trending
   - Milline kuul oli populaarne UFO vs Cryptid
   - Need oleks suurepärane Line chart

3. **User cohort analysis**
   - ❌ PUUDU: Millised kasutajate grupid on aktiivsed
   - Nt: "Users who joined in nov see 80% active"

4. **Content moderation queue**
   - ✅ Cases ja comments on nähtavad
   - ⚠️ Forum posts pole nähtavad - ei ole tab-i
   - ⚠️ Priority flagging puudub (urgent, high, low)

5. **User behavior timeline**
   - ❌ PUUDU: Valida user, näha tema tegevused
   - Login history, case submissions, comments timeline

6. **Bulk operations**
   - ❌ PUUDU: Bulk send email, bulk ban, bulk case assignment
   - Juba on MassNotificationPanel, aga teised puuduvad

7. **Email templates & campaigns**
   - ✅ MassNotificationPanel.tsx olemas
   - ⚠️ Template management pole nähtav

8. **Analytics export**
   - ❌ PUUDU: PDF/CSV download raporti
   - Oleks hea kuukaarte aruanded genereerida

9. **System health monitoring**
   - ❌ PUUDU: Database status, storage usage
   - API response times monitoring

10. **Fraud detection**
    - ⚠️ Admin actions tabel on olemas
    - ❌ Aga UI puudub - ei näe podisaid kasutajaid

---

## 🎮 ENGAGEMENT & FEATURES

### ✅ OLEMAS
- [x] **Leaderboard** - Top 50 uurijad
- [x] **Wallet/rewards** - Kasutajad saavad raha teenida
- [x] **Forum** - Arutelu teemad
- [x] **Comments** - Juhtumite all
- [x] **Team collaboration** - Reward split
- [x] **Subscription tiers** - 3 taset uurijatele
- [x] **Case status tracking** - OPEN, INVESTIGATING, RESOLVED jne
- [x] **AI tools** - Gemini API & image analysis
- [x] **Analytics tracking** - Külastajate jälgimine

### ⚠️ PUUDU VÕI VAJAB PARANDUST

1. **Daily login streaks**
   - ✅ user_challenges tabel
   - ❌ UI puudub - ei näe streaki mitte kuskil

2. **Badges/achievements**
   - ✅ user_badges tabel
   - ❌ UI puudub - ProBadge.tsx on liiga primitiivne

3. **Case difficulty ratings**
   - ❌ Tabel pole - ei ole kujutletud
   - ⚠️ Võiks olla suur feature

4. **Evidence voting/upvoting**
   - ❌ PUUDU: Parimad tõendid ülal
   - Oleks suurepärane engagement feature

5. **Community consensus meter**
   - ❌ PUUDU: "85% arvab, et UFO"
   - Hääletamine teooriate kohta

6. **Case theories section**
   - ❌ PUUDU: Korraldatud teooriad
   - Nüüd ainult hajutatud kommentaarid

7. **Case timeline visualization**
   - ⚠️ Investigation log on timeline-kujul
   - ❌ Aga see pole interaktiivne

---

## 🛠️ TEHNILINE SEISUND

### 📊 Database schema
- ✅ 50+ tabel
- ✅ RLS policies konfigureeritud
- ✅ Triggers & functions olemas
- ⚠️ User_follows pole täielikult UI-s implementeeritud

### 🔐 Security
- ✅ RLS policies olemas
- ✅ Role-based access control
- ✅ API proxy (Gemini)
- ⚠️ Rate limiting pole kõigile feature-dele

### 🚀 Performance
- ✅ Build size OK (~400KB gzip)
- ✅ Lazy loading implemented
- ⚠️ Map legend on mobiilist optimeeritud (juurde tehtud)
- ⚠️ Modal z-index fixed (juurde tehtud)

---

## 🎯 TOP 5 KIIRENDATUD PRIORITEETI

### 1. **Follow system UI** (30 min)
- user_follows tabel on olemas
- Lisage "Follow" nupp UserProfile-le
- Näidake "Following" kasutajate tegevusi

### 2. **User reputation display** (15 min)
- Näidake reputation skoor profiiril
- Lisage badges display

### 3. **Case difficulty ratings** (45 min)
- Lisage ★★ rating süsteem
- Näidake ExploreCases ja CaseDetail-l

### 4. **Daily challenges UI** (60 min)
- Admin on andmeid juba kogumas (user_challenges)
- Kasutaja näeb: "Login 7 päeva järjest" jne
- Rewards lisamine

### 5. **Admin: Content moderation queue** (90 min)
- Lisage forum posts moderatsioon
- Priority flagging (urgent, high, low)
- Bulk actions (approve/reject)

---

## 📝 KONKREETSED PARANDUSED (Loogiline järjekord)

### QUICK WINS (< 1 hour each)
1. ✅ **Mobile map legend** - TEHTUD
2. ✅ **Modal z-index fix** - TEHTUD  
3. ✅ **Country geolocation tracking** - TEHTUD
4. Follow button UserProfile-le
5. Reputation score näitamine

### MEDIUM (1-2 hours each)
6. Case difficulty rating system
7. Similar cases widget
8. Forum moderation UI
9. Daily challenge display
10. Badge system UI

### MAJOR (2+ hours each)
11. Geographic heatmap (analytics)
12. Trend analysis dashboard
13. User cohort analysis
14. Evidence upvoting system
15. Community voting/theories system

---

## ✅ KOKKKUVÕTE

| Aspekt | Seisund | Score |
|--------|---------|-------|
| **Külalis UX** | Väga hea | 8.5/10 |
| **Kasutaja features** | Hea, kuid puudub sotsiaalne | 7/10 |
| **Uurija tools** | Hea, vajab analytics | 7.5/10 |
| **Admin dashboard** | Basistaskid OK, puudub analüütika | 6.5/10 |
| **Engagement mechanics** | Baasil olemas, UI puudub | 6/10 |
| **Üldine readiness** | **TOOTMIS-VALMIS** | **7.3/10** |

---

**Platvorm on tootmis-valmis, kuid nõuab UI täiendusi olemasolevate features-te nähtavaks tegemiseks.**

Enim puudust on **engagement mechanics UI-s** - andmed on olemas, kuid kasutajad ei näe neid.

