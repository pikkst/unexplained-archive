# ✅ Promotional Campaigns - Deployment Checklist

## Pre-Deployment Verification

### ✅ Files Created
- [x] `/supabase/migrations/20251217_promotional_campaigns.sql`
- [x] `/supabase/migrations/20251217_campaign_tracking_functions.sql`
- [x] `/supabase/functions/generate-campaign-content/index.ts`
- [x] `/src/components/CampaignManager.tsx`
- [x] `/src/components/PromotionalBanner.tsx`
- [x] Updated `/src/components/AdminDashboard.tsx`
- [x] Updated `/src/components/LandingPage.tsx`

### ✅ Documentation Created
- [x] `PROMOTIONAL_CAMPAIGNS_GUIDE.md` (600+ lines)
- [x] `CAMPAIGNS_QUICK_START.md`
- [x] `CAMPAIGNS_IMPLEMENTATION_SUMMARY.md`
- [x] `CAMPAIGNS_README.md`
- [x] `CAMPAIGNS_VISUAL_GUIDE.md`
- [x] `CAMPAIGNS_DEPLOYMENT_CHECKLIST.md` (this file)

## Deployment Steps

### Step 1: Database Setup ⏱️ 5 minutes

#### A. Apply Migrations
```bash
cd /workspaces/unexplained-archive

# Option 1: Using Supabase CLI (Recommended)
supabase db push

# Option 2: Manual SQL execution
psql $DATABASE_URL -f supabase/migrations/20251217_promotional_campaigns.sql
psql $DATABASE_URL -f supabase/migrations/20251217_campaign_tracking_functions.sql
```

#### B. Verify Tables Created
```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE '%campaign%';

-- Expected output:
-- promotional_campaigns
-- promo_codes
-- campaign_redemptions
-- campaign_analytics
-- campaign_ai_content
```

#### C. Verify Functions Created
```sql
-- Check if functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%campaign%';

-- Expected output:
-- redeem_promo_code
-- get_user_active_benefits
-- track_campaign_impression
-- track_campaign_click
-- track_campaign_conversion
-- get_campaign_dashboard_stats
-- update_campaign_analytics (trigger function)
```

#### D. Verify RLS Policies
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename LIKE '%campaign%';

-- All should show: rowsecurity = true
```

**Status**: [ ] Complete

---

### Step 2: Gemini API Configuration ⏱️ 3 minutes

#### A. Get API Key
1. Visit: https://makersuite.google.com/app/apikey
2. Sign in with Google account
3. Click "Create API Key"
4. Copy the key

#### B. Set in Supabase
```bash
# Using Supabase CLI
supabase secrets set GEMINI_API_KEY=your_actual_key_here

# Or via Supabase Dashboard:
# 1. Go to Project Settings
# 2. Click on "Edge Functions"
# 3. Add secret: GEMINI_API_KEY
```

#### C. Verify Secret Set
```bash
supabase secrets list
# Should show: GEMINI_API_KEY (value hidden)
```

**Status**: [ ] Complete

---

### Step 3: Deploy Edge Function ⏱️ 2 minutes

#### A. Deploy Function
```bash
cd /workspaces/unexplained-archive
supabase functions deploy generate-campaign-content
```

#### B. Test Function
```bash
# Test with curl
curl -i --location --request POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/generate-campaign-content' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"prompt":"Create a test banner","contentType":"banner_text"}'
```

#### C. Check Function Logs
```bash
supabase functions logs generate-campaign-content
# Should show successful deployment
```

**Status**: [ ] Complete

---

### Step 4: Frontend Build ⏱️ 5 minutes

#### A. Install Dependencies (if needed)
```bash
npm install
```

#### B. Build Application
```bash
npm run build
```

#### C. Verify Build
```bash
# Check dist folder created
ls -la dist/

# Should contain index.html and assets
```

#### D. Test Locally
```bash
npm run dev

# Open http://localhost:5173
# Navigate to /admin (as admin user)
# Check "Campaigns" tab exists
```

**Status**: [ ] Complete

---

### Step 5: Admin Access Verification ⏱️ 3 minutes

#### A. Create Admin User (if needed)
```sql
-- Update existing user to admin
UPDATE profiles 
SET role = 'admin' 
WHERE id = 'YOUR_USER_ID';

-- Or via Supabase Dashboard:
-- 1. Go to Table Editor
-- 2. Find profiles table
-- 3. Find your user
-- 4. Set role to 'admin'
```

#### B. Verify Admin Access
1. Log in to your app
2. Navigate to `/admin`
3. Should see Admin Dashboard
4. Check for "Campaigns" tab
5. Click "Campaigns"
6. Should see CampaignManager component

**Status**: [ ] Complete

---

### Step 6: Create Test Campaign ⏱️ 5 minutes

#### A. Create Campaign via UI
1. Go to Admin → Campaigns
2. Click "Create Campaign"
3. Fill in:
   ```
   Name: Test Campaign
   Description: Testing the system
   Type: Free Credits
   Free Credits: 5
   Max Redemptions: 10
   Target: All Users
   Banner Text: 🧪 Test promotion - 5 free credits!
   CTA Button: Claim Test Credits
   Requires Code: No
   ```
4. Click "Create Campaign"
5. Should see success message

#### B. Launch Campaign
1. Find "Test Campaign" in list
2. Click "Launch" button
3. Status should change to "ACTIVE"

#### C. Verify on Landing Page
1. Log out (or open incognito window)
2. Visit landing page
3. Should see promotional banner at top
4. Banner should show: "🧪 Test promotion - 5 free credits!"

**Status**: [ ] Complete

---

### Step 7: Test Redemption Flow ⏱️ 3 minutes

#### A. Test User Redemption
1. Log in as regular user (not admin)
2. Visit landing page
3. Click "Claim Test Credits" on banner
4. Should see success message
5. Check user profile/wallet for 5 new credits

#### B. Verify Database Record
```sql
-- Check redemption was created
SELECT * FROM campaign_redemptions 
WHERE user_id = 'TEST_USER_ID' 
ORDER BY created_at DESC 
LIMIT 1;

-- Should show new record with:
-- - campaign_id matching test campaign
-- - benefit_type = 'free_credits'
-- - benefit_value containing 5 credits
```

#### C. Verify Analytics Tracked
```sql
-- Check analytics recorded
SELECT * FROM campaign_analytics 
WHERE campaign_id = 'TEST_CAMPAIGN_ID' 
AND date = CURRENT_DATE;

-- Should show:
-- - impressions > 0
-- - clicks > 0
-- - redemptions = 1
```

**Status**: [ ] Complete

---

### Step 8: Test AI Content Generation ⏱️ 3 minutes

#### A. Generate Test Content
1. In Campaign Manager, click "Create Campaign"
2. Click "Generate with AI" button
3. Select "Banner Text"
4. Enter prompt: "Create exciting test banner"
5. Click "Generate"
6. Should see generated text appear
7. Click "Apply to Campaign"

#### B. Verify in Database
```sql
-- Check AI content was logged
SELECT * FROM campaign_ai_content 
ORDER BY generated_at DESC 
LIMIT 1;

-- Should show:
-- - content_type = 'banner_text'
-- - prompt = your prompt
-- - generated_content = AI output
-- - ai_model = 'gemini-2.0-flash-exp'
```

**Status**: [ ] Complete

---

### Step 9: Test Promo Code System ⏱️ 3 minutes

#### A. Create Promo Code
1. Go to test campaign
2. Click "Codes" button
3. Enter:
   ```
   Code: TESTCODE
   Max Uses: 5
   Max Per User: 1
   ```
4. Click "Create Promo Code"

#### B. Test Code Redemption
1. Create new campaign requiring code
2. Set requires_code = true
3. Launch campaign
4. As user, enter "TESTCODE"
5. Should successfully redeem

#### C. Verify Code Limits
```sql
-- Check code usage
SELECT code, current_uses, max_uses 
FROM promo_codes 
WHERE code = 'TESTCODE';

-- current_uses should increment with each redemption
```

**Status**: [ ] Complete

---

### Step 10: Production Deployment ⏱️ 10 minutes

#### A. Deploy to Production
```bash
# Deploy to your hosting platform
# Example for Vercel:
vercel --prod

# Example for Netlify:
netlify deploy --prod

# Example for GitHub Pages:
npm run build
git add dist/
git commit -m "Deploy campaigns system"
git push origin main
```

#### B. Verify Production URLs
- [ ] Frontend loads: https://your-domain.com
- [ ] Admin accessible: https://your-domain.com/admin
- [ ] Campaigns tab visible
- [ ] Banner shows on landing page
- [ ] Edge function reachable

#### C. Production Test
1. Create real campaign
2. Test user flow
3. Verify analytics tracking
4. Check database records
5. Test on mobile devices

**Status**: [ ] Complete

---

## Post-Deployment Verification

### System Health Checks

#### Database Health
```sql
-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename LIKE '%campaign%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

#### Edge Function Health
```bash
# Check function status
supabase functions list

# Check recent logs
supabase functions logs generate-campaign-content --tail
```

#### RLS Policy Check
```sql
-- Verify policies working
-- As admin, should see all campaigns:
SELECT COUNT(*) FROM promotional_campaigns;

-- As regular user, should only see active campaigns:
SET ROLE authenticated;
SELECT COUNT(*) FROM promotional_campaigns WHERE status = 'active';
```

**Status**: [ ] Complete

---

## Create First Real Campaign

### Recommended First Campaign: "First 100 Users"

```yaml
Campaign Details:
  name: "First 100 Users Special"
  description: "Welcome offer for our first 100 community members"
  campaign_type: "free_credits"
  free_credits: 10
  max_redemptions: 100
  target_user_segment: "first_100"
  requires_code: false
  start_date: NOW()
  end_date: NOW() + 30 days
  
  banner_text: "🎉 Be one of the first 100 users and get 10 FREE investigation credits!"
  landing_page_text: "Join our growing community of mystery enthusiasts. As one of our first 100 members, you'll receive 10 complimentary investigation credits to start your journey into the unexplained."
  cta_button_text: "Claim Your Free Credits"
```

**Action Items**:
1. [ ] Create campaign via admin UI
2. [ ] Review generated banner
3. [ ] Test redemption flow
4. [ ] Launch campaign (set to active)
5. [ ] Share on social media
6. [ ] Monitor redemptions daily

---

## Monitoring & Analytics

### Daily Checks (5 minutes)
- [ ] Check campaign redemption counts
- [ ] Review conversion rates
- [ ] Monitor for any errors in logs
- [ ] Verify analytics tracking working

### Weekly Reviews (15 minutes)
- [ ] Analyze campaign performance
- [ ] Calculate ROI per campaign
- [ ] Review user feedback
- [ ] Adjust campaigns if needed

### Monthly Reports (30 minutes)
- [ ] Generate comprehensive report
- [ ] Calculate total ROI
- [ ] Plan next month's campaigns
- [ ] A/B test results analysis

---

## Troubleshooting Guide

### Issue: Campaign Not Showing on Landing Page

**Check**:
1. Campaign status is "active"
2. Current date between start_date and end_date
3. User is logged in (if required)
4. User meets target segment criteria
5. Max redemptions not reached
6. Clear browser cache

**Solution**:
```sql
-- Debug query
SELECT 
    id, name, status, 
    start_date, end_date,
    current_redemptions, max_redemptions
FROM promotional_campaigns
WHERE status = 'active'
AND NOW() BETWEEN start_date AND end_date;
```

### Issue: Promo Code Not Working

**Check**:
1. Code is active (is_active = true)
2. Current date between valid_from and valid_until
3. Max uses not exceeded
4. User hasn't exceeded per-user limit
5. Code spelled correctly (case-sensitive)

**Solution**:
```sql
-- Debug promo code
SELECT 
    code, is_active,
    current_uses, max_uses,
    valid_from, valid_until
FROM promo_codes
WHERE code = 'YOUR_CODE';
```

### Issue: AI Generation Failing

**Check**:
1. GEMINI_API_KEY is set correctly
2. Edge function is deployed
3. API key has remaining quota
4. Network connectivity to Google AI

**Solution**:
```bash
# Check function logs
supabase functions logs generate-campaign-content

# Test API key manually
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=$GEMINI_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"contents":[{"parts":[{"text":"test"}]}]}'
```

### Issue: Analytics Not Tracking

**Check**:
1. Campaign redemption trigger is working
2. Functions have correct permissions
3. Database has write access

**Solution**:
```sql
-- Check if trigger exists
SELECT tgname FROM pg_trigger 
WHERE tgname = 'campaign_redemption_analytics';

-- Manually track test impression
SELECT track_campaign_impression('CAMPAIGN_ID');
```

---

## Security Checklist

### Pre-Launch Security Review
- [x] RLS policies enabled on all tables
- [x] Admin-only access to campaign creation
- [x] User eligibility checked server-side
- [x] Promo code validation server-side
- [x] Usage limits enforced in database
- [x] API key stored in secrets (not code)
- [x] No sensitive data in frontend
- [x] SQL injection prevention (parameterized queries)

### Ongoing Security
- [ ] Monitor for abuse patterns
- [ ] Review redemption rates for anomalies
- [ ] Check for automated bot activity
- [ ] Audit admin access logs
- [ ] Rotate API keys periodically

---

## Performance Checklist

### Database Performance
- [x] Indexes created on foreign keys
- [x] Indexes on commonly queried columns
- [x] RLS policies optimized
- [ ] Monitor query performance
- [ ] Set up connection pooling if needed

### Frontend Performance
- [ ] Lazy load campaign components
- [ ] Cache active campaigns (5 min TTL)
- [ ] Optimize image sizes
- [ ] Minify JavaScript bundle
- [ ] Enable gzip compression

### Edge Function Performance
- [ ] Set appropriate timeout (5-10s)
- [ ] Implement response caching
- [ ] Monitor invocation costs
- [ ] Rate limit if needed

---

## Success Criteria

### Launch Success (Week 1)
- [ ] ✅ All systems deployed and operational
- [ ] ✅ First campaign live and accepting redemptions
- [ ] ✅ Analytics tracking correctly
- [ ] ✅ No critical errors in logs
- [ ] ✅ At least 10 successful redemptions

### Short-term Success (Month 1)
- [ ] 🎯 100+ campaign redemptions
- [ ] 🎯 15%+ new user growth
- [ ] 🎯 20%+ trial-to-paid conversion
- [ ] 🎯 Positive ROI on campaigns
- [ ] 🎯 5+ active campaigns running

### Long-term Success (Quarter 1)
- [ ] 🏆 500+ total redemptions
- [ ] 🏆 30%+ user growth from campaigns
- [ ] 🏆 200%+ average ROI
- [ ] 🏆 Automated campaign system
- [ ] 🏆 Referral program launched

---

## Final Checklist

### Before Going Live
- [ ] All database migrations applied
- [ ] Edge function deployed and tested
- [ ] Admin access verified
- [ ] Test campaign created and redeemed
- [ ] AI generation tested
- [ ] Promo code system tested
- [ ] Production build successful
- [ ] Mobile responsive verified
- [ ] Documentation reviewed
- [ ] Team trained on system

### Go-Live Actions
- [ ] Deploy to production
- [ ] Create first real campaign
- [ ] Launch "First 100 Users" offer
- [ ] Announce on social media
- [ ] Send email to existing users
- [ ] Monitor for first hour
- [ ] Respond to user feedback

### Post-Launch (First 24 Hours)
- [ ] Check redemption rate every 2 hours
- [ ] Monitor error logs
- [ ] Verify analytics data
- [ ] Collect user feedback
- [ ] Make adjustments if needed
- [ ] Document any issues

---

## Emergency Contacts & Rollback

### If Critical Issue Occurs

1. **Pause All Campaigns**:
```sql
UPDATE promotional_campaigns 
SET status = 'paused' 
WHERE status = 'active';
```

2. **Disable Banner Display**:
```typescript
// In PromotionalBanner.tsx, add at top:
if (true) return null; // Emergency disable
```

3. **Check Logs**:
```bash
supabase functions logs generate-campaign-content --tail
```

4. **Rollback Database** (if needed):
```bash
supabase db reset
# Then reapply migrations except campaigns
```

### Support Resources
- Documentation: `/docs/PROMOTIONAL_CAMPAIGNS_GUIDE.md`
- Quick Start: `/docs/CAMPAIGNS_QUICK_START.md`
- Supabase Docs: https://supabase.com/docs
- Gemini AI Docs: https://ai.google.dev/docs

---

## ✅ Final Sign-Off

**Deployment Date**: _______________

**Deployed By**: _______________

**System Status**:
- [ ] All checks passed
- [ ] Ready for production
- [ ] Team notified
- [ ] Monitoring enabled

**Notes**:
_______________________________________________________
_______________________________________________________
_______________________________________________________

---

**🎉 Congratulations! Your promotional campaign system is now live!**

Monitor closely for the first 24-48 hours and be ready to make adjustments based on real user behavior. Good luck! 🚀
