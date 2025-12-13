# 🚀 PREMIUM SERVICES - DEPLOYMENT GUIDE

## Overview
This deployment adds 3 premium revenue streams:
1. **Investigator Pro Subscription** (€15/month)
2. **Featured Case Boost** (€5-50)
3. **Background Verification** (€25-50 one-time)

---

## 📋 DEPLOYMENT CHECKLIST

### Phase 1: Database Setup (10 min)

```bash
# 1. Run setup-premium-services.sql in Supabase SQL Editor
```

This creates:
- ✅ `boost_pricing` table with 3 tiers
- ✅ `background_checks` table
- ✅ Enhanced `featured_cases` table
- ✅ Pro member fields in `profiles`
- ✅ All necessary functions and RLS policies

Verify tables:
```sql
SELECT * FROM boost_pricing;
-- Should return 3 rows: 24h, 7d, 30d

SELECT * FROM background_checks LIMIT 1;
-- Should work without errors
```

### Phase 2: Edge Functions Deployment (15 min)

```bash
# Navigate to project root
cd unexplained-archive

# Deploy boost checkout function
supabase functions deploy purchase-boost-checkout

# Deploy verification checkout function  
supabase functions deploy request-verification-checkout

# Update stripe-webhook (already deployed, just redeploy with changes)
supabase functions deploy stripe-webhook
```

### Phase 3: Environment Variables

Ensure these are set in Supabase Dashboard → Edge Functions → Secrets:

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Phase 4: Stripe Setup (20 min)

#### 1. Create Products in Stripe Dashboard:

**Investigator Pro Subscription:**
- Product Name: "Investigator Pro Monthly"
- Price: €15.00/month recurring
- Description: "Unlimited AI tools, priority support, verified badge"
- Copy Price ID: `price_xxx` (needed for code)

**Case Boosts** (already handled via dynamic pricing in DB)

**Background Checks** (already handled via dynamic pricing in DB)

#### 2. Configure Webhook Endpoint:

```
URL: https://xxx.supabase.co/functions/v1/stripe-webhook
Events to listen for:
- checkout.session.completed
- payment_intent.succeeded
- payment_intent.payment_failed
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted
```

Copy webhook secret and add to Supabase secrets.

### Phase 5: Frontend Integration (30 min)

#### 1. Update subscription service prices:

```typescript
// src/services/subscriptionService.ts
export const SUBSCRIPTION_PLANS = {
  investigator_pro: {
    id: 'investigator_pro',
    name: 'Investigator Pro',
    price: 15.00, // ✅ Already correct
    stripePriceId: 'price_xxx', // Add your Stripe Price ID
    // ...
  }
};
```

#### 2. Add boost and verification services (already created):
- ✅ `src/services/boostService.ts`
- ✅ `src/services/verificationService.ts`

#### 3. Import services where needed:

```typescript
import { boostService } from '../services/boostService';
import { verificationService } from '../services/verificationService';
```

---

## 💡 USAGE EXAMPLES

### 1. Purchase Case Boost

```typescript
// In CaseDetailPage.tsx
import { boostService } from '../services/boostService';

const handleBoost = async (boostType: string) => {
  // Option A: Pay with Stripe (new money)
  const result = await boostService.purchaseBoost(
    caseId,
    user.id,
    boostType
  );
  
  if (result?.url) {
    window.location.href = result.url; // Redirect to Stripe
  }

  // Option B: Pay with wallet balance
  const success = await boostService.purchaseBoostWithWallet(
    caseId,
    user.id,
    boostType
  );
  
  if (success) {
    alert('Boost activated!');
  }
};

// Check if case is boosted
const isBoosted = await boostService.isCaseBoosted(caseId);

// Get boost details
const boost = await boostService.getCaseBoost(caseId);
```

### 2. Request Background Verification

```typescript
// In InvestigatorProfile.tsx
import { verificationService } from '../services/verificationService';

const handleRequestVerification = async () => {
  // Option A: Pay with Stripe
  const result = await verificationService.requestVerification(
    user.id,
    'standard' // or 'premium'
  );
  
  if (result?.url) {
    window.location.href = result.url;
  }

  // Option B: Pay with wallet
  const success = await verificationService.requestVerificationWithWallet(
    user.id,
    'standard'
  );
};

// Check verification status
const status = await verificationService.getVerificationStatus(user.id);

// Display badge
const badgeProps = verificationService.getBadgeProps(status);
if (badgeProps.show) {
  return (
    <div className={`badge ${badgeProps.color}`}>
      {badgeProps.icon} {badgeProps.label}
    </div>
  );
}
```

### 3. Display Pro Badge

```typescript
// In UserProfile.tsx
const { is_pro_member, pro_since } = profile;

{is_pro_member && (
  <div className="flex items-center gap-2 px-3 py-1 bg-yellow-400/10 border border-yellow-400 rounded-full">
    <Crown className="w-4 h-4 text-yellow-400" />
    <span className="text-yellow-400 font-semibold">PRO</span>
  </div>
)}
```

### 4. Show Boosted Cases First

```typescript
// In CaseList.tsx
import { boostService } from '../services/boostService';

const loadCases = async () => {
  // Get boosted cases first
  const boosted = await boostService.getActiveBoostedCases();
  
  // Get regular cases
  const { data: regular } = await supabase
    .from('cases')
    .select('*')
    .order('created_at', { ascending: false });
  
  // Combine: boosted first, then regular
  const allCases = [...boosted, ...regular.filter(c => 
    !boosted.find(b => b.case_id === c.id)
  )];
  
  setCases(allCases);
};
```

---

## 🧪 TESTING

### Test Case Boost Purchase:

```bash
# 1. Create a test case
# 2. Click "Boost Case" button
# 3. Select boost type (24h, 7d, 30d)
# 4. Complete Stripe test payment (card: 4242 4242 4242 4242)
# 5. Verify:
#    - Case appears in featured_cases table
#    - Transaction recorded
#    - Platform revenue logged
```

### Test Background Check:

```bash
# 1. Go to investigator profile
# 2. Click "Get Verified"
# 3. Select check type (standard/premium)
# 4. Complete Stripe test payment
# 5. Verify:
#    - Request created in background_checks table
#    - Status = 'pending'
#    - Admin can review in admin panel
```

### Test Subscription Billing:

```bash
# 1. Subscribe to Investigator Pro
# 2. Wait for webhook: customer.subscription.created
# 3. Verify:
#    - profiles.is_pro_member = TRUE
#    - subscription record created
#    - Pro badge displays
```

---

## 📊 MONITORING

### Daily Checks:

```sql
-- Total revenue today
SELECT 
  SUM(amount) as daily_revenue
FROM transactions
WHERE transaction_type IN ('case_boost', 'background_check', 'subscription')
  AND created_at >= CURRENT_DATE;

-- Active boosts
SELECT COUNT(*) as active_boosts
FROM featured_cases
WHERE status = 'active'
  AND featured_until > NOW();

-- Pending verifications
SELECT COUNT(*) as pending_checks
FROM background_checks
WHERE status = 'pending';

-- Pro subscribers
SELECT COUNT(*) as pro_members
FROM profiles
WHERE is_pro_member = TRUE;
```

### Weekly Analytics:

```sql
-- Revenue breakdown
SELECT 
  transaction_type,
  COUNT(*) as count,
  SUM(amount) as total
FROM transactions
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
  AND transaction_type IN ('case_boost', 'background_check', 'subscription')
GROUP BY transaction_type;

-- Boost ROI
SELECT 
  boost_type,
  AVG(impressions) as avg_impressions,
  AVG(clicks) as avg_clicks,
  AVG(price_paid) as avg_price
FROM featured_cases
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY boost_type;
```

---

## 🚨 TROUBLESHOOTING

### Boost not activating:
1. Check wallet balance
2. Verify case ownership
3. Check boost_pricing table exists
4. Review Supabase logs for errors

### Verification not processing:
1. Check Stripe webhook logs
2. Verify payment_intent received
3. Check background_checks table
4. Ensure admin role exists for review

### Subscription not showing:
1. Verify Stripe webhook delivered
2. Check subscriptions table
3. Verify profiles.is_pro_member updated
4. Clear frontend cache

---

## 💰 EXPECTED REVENUE (Monthly)

Based on projections:

**Year 1 (Conservative):**
- Pro subscriptions: 4 × €15 = €60/month
- Case boosts: 5 × €10 = €50/month
- Verifications: 2 × €25 = €50/month (one-time spread)
- **Total: ~€160/month**

**Year 2 (Growth):**
- Pro subscriptions: 20 × €15 = €300/month
- Case boosts: 30 × €10 = €300/month
- Verifications: 10 × €25 = €250/month
- **Total: ~€850/month**

**Year 3 (Success):**
- Pro subscriptions: 100 × €15 = €1,500/month
- Case boosts: 200 × €15 = €3,000/month
- Verifications: 50 × €25 = €1,250/month
- **Total: ~€5,750/month**

---

## ✅ GO LIVE CHECKLIST

- [ ] Database tables created and verified
- [ ] Edge functions deployed and tested
- [ ] Stripe products configured
- [ ] Webhook endpoint configured and tested
- [ ] Environment variables set
- [ ] Frontend services imported
- [ ] UI components updated
- [ ] Test purchases completed successfully
- [ ] Admin panel can review verifications
- [ ] Monitoring queries saved
- [ ] Documentation shared with team
- [ ] Backup of database schema
- [ ] Rollback plan prepared

---

## 🎉 SUCCESS METRICS

Track these KPIs weekly:

1. **Subscription MRR** (Monthly Recurring Revenue)
2. **Boost conversion rate** (boosts per 100 cases)
3. **Verification completion time** (admin review speed)
4. **Boost ROI** (clicks per euro spent)
5. **Customer retention** (subscription churn rate)

---

**Ready to deploy? Start with Phase 1! 🚀**
