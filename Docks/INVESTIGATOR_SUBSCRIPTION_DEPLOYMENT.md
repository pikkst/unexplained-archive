# 🚀 INVESTIGATOR SUBSCRIPTION DEPLOYMENT GUIDE

## ✅ PRE-DEPLOYMENT CHECKLIST

### 1. DATABASE SETUP
```bash
# Run migration in Supabase SQL Editor
# File: supabase/migrations/20251212000001_investigator_subscriptions.sql
```

- [ ] Run migration
- [ ] Verify tables created: `subscription_plans`, `subscription_credits`, `subscription_usage_log`, `subscription_transactions`
- [ ] Verify functions created: `initialize_subscription_credits`, `check_subscription_credits`, `deduct_subscription_credits`
- [ ] Check seed data: 3 plans (basic, premium, pro) inserted

### 2. STRIPE SETUP

#### Create Products & Prices
```bash
# Go to Stripe Dashboard → Products

# Create 3 Products:
1. Investigator Basic
2. Investigator Premium  
3. Investigator Pro

# For each product, create 3 prices:
- Monthly (recurring)
- Yearly (recurring)
- One-time (one-time)
```

**Pricing:**
| Plan | Monthly | Yearly | One-time |
|------|---------|--------|----------|
| Basic | €9.99 | €95.90 | €14.99 |
| Premium | €24.99 | €239.90 | €59.99 |
| Pro | €49.99 | €479.90 | €149.99 |

- [ ] Products created
- [ ] Prices created (9 total)
- [ ] Copy Stripe Price IDs
- [ ] Update `subscription_plans` table with `stripe_price_id_{monthly|yearly|onetime}` (if adding these fields)

#### Configure Webhooks
```bash
# Stripe Dashboard → Developers → Webhooks

# Add endpoint:
https://YOUR_PROJECT.supabase.co/functions/v1/stripe-webhook

# Select events:
✅ checkout.session.completed
✅ customer.subscription.created
✅ customer.subscription.updated
✅ customer.subscription.deleted
✅ invoice.payment_succeeded
✅ payment_intent.succeeded
✅ payment_intent.payment_failed
```

- [ ] Webhook endpoint added
- [ ] Events selected
- [ ] Webhook secret copied
- [ ] Secret added to Supabase: `STRIPE_WEBHOOK_SECRET`

### 3. EDGE FUNCTIONS DEPLOYMENT

```bash
# Deploy subscription functions
cd supabase

# Deploy subscribe function
supabase functions deploy subscribe

# Deploy cancel-subscription function
supabase functions deploy cancel-subscription

# Set environment variables
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set APP_URL=https://your-app.com
```

- [ ] `subscribe` function deployed
- [ ] `cancel-subscription` function deployed
- [ ] Stripe keys set
- [ ] APP_URL set

### 4. FRONTEND DEPLOYMENT

#### Add Routes
```typescript
// src/App.tsx or router config

import { InvestigatorSubscriptionPlans } from './components/InvestigatorSubscriptionPlans';
import { SubscriptionManagement } from './components/SubscriptionManagement';

// Add routes:
<Route path="/subscription/plans" element={<InvestigatorSubscriptionPlans />} />
<Route path="/subscription/manage" element={<SubscriptionManagement />} />
```

- [ ] Routes added
- [ ] Components imported
- [ ] Navigation links added (header/sidebar)

#### Update AI Tools Panel
File already updated with credit checks:
- [ ] Verify `AIToolsPanel.tsx` imported `subscriptionService`
- [ ] Test credit display
- [ ] Test "Subscribe to Use" button

### 5. ENVIRONMENT VARIABLES

```bash
# .env or Vercel/Netlify environment
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

- [ ] Stripe publishable key set
- [ ] Supabase URL set
- [ ] Supabase anon key set

---

## 📋 STEP-BY-STEP DEPLOYMENT

### STEP 1: Database Migration
```sql
-- In Supabase SQL Editor, run:
supabase/migrations/20251212000001_investigator_subscriptions.sql
```

✅ Expected output:
- 4 tables created
- 3 plans inserted
- 6 functions created
- RLS policies enabled

### STEP 2: Create Stripe Products
1. Go to Stripe Dashboard → Products
2. Click "Add product"
3. Name: "Investigator Basic"
4. Description: "50 AI credits/month"
5. Add pricing:
   - €9.99/month (recurring)
   - €95.90/year (recurring)
   - €14.99 (one-time)
6. Repeat for Premium and Pro

### STEP 3: Deploy Edge Functions
```bash
cd supabase
supabase functions deploy subscribe
supabase functions deploy cancel-subscription

# Verify deployment
supabase functions list
```

### STEP 4: Configure Webhook
1. Stripe Dashboard → Developers → Webhooks
2. Add endpoint URL
3. Select events (see checklist above)
4. Copy webhook secret
5. Add to Supabase secrets

### STEP 5: Frontend Build & Deploy
```bash
npm run build

# Deploy to your hosting (Vercel/Netlify/etc)
vercel --prod
```

### STEP 6: Test End-to-End

#### Test 1: Stripe Payment (Monthly)
```
1. Navigate to /subscription/plans
2. Click "Telli Kaardiga" on Basic plan
3. Use Stripe test card: 4242 4242 4242 4242
4. Complete checkout
5. Verify webhook received
6. Check subscription in DB
7. Check credits initialized
```

#### Test 2: Wallet Payment
```
1. Add €20 to wallet
2. Navigate to /subscription/plans
3. Click "Telli Rahakotist"
4. Verify instant activation
5. Check wallet balance deducted
6. Check credits granted
```

#### Test 3: AI Tool with Credits
```
1. Open case
2. Click "AI Tools"
3. Verify credits displayed
4. Run image analysis
5. Check credits deducted
6. Verify usage log created
```

#### Test 4: Credit Limit
```
1. Use Basic plan (50 credits)
2. Run tools until credits exhausted
3. Try to run tool with 0 credits
4. Verify error message shown
5. Verify upgrade prompt displayed
```

#### Test 5: Cancel Subscription
```
1. Navigate to /subscription/manage
2. Click "Tühista Tellimus"
3. Verify status: "canceled_at_period_end"
4. Wait for period end (or test with short period)
5. Verify subscription deactivated
6. Verify credits disabled
```

---

## 🔄 MONTHLY CRON JOB

Set up automated credit resets:

```bash
# Supabase Dashboard → Edge Functions → Cron

# Add cron job (runs daily at midnight):
supabase functions deploy reset-credits --schedule "0 0 * * *"
```

**Function code:**
```typescript
// supabase/functions/reset-credits/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Reset monthly credits
  const { data, error } = await supabase.rpc('reset_monthly_subscription_credits');
  
  if (error) {
    return new Response(JSON.stringify({ error }), { status: 500 });
  }

  console.log(`Reset ${data} subscriptions`);
  
  // Expire one-time packs
  const { data: expired } = await supabase.rpc('expire_onetime_subscriptions');
  console.log(`Expired ${expired} one-time packs`);

  return new Response(JSON.stringify({ reset: data, expired }), { status: 200 });
});
```

---

## 🐛 TROUBLESHOOTING

### "No active subscription" error
```sql
-- Check user subscription
SELECT * FROM subscriptions WHERE user_id = 'xxx' AND status = 'active';

-- Check credits
SELECT * FROM subscription_credits WHERE user_id = 'xxx';
```

### Webhook not receiving events
```bash
# Test locally with Stripe CLI
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook

# Trigger test event
stripe trigger checkout.session.completed
```

### Credits not deducting
```sql
-- Check deduction function
SELECT deduct_subscription_credits(
  'user-id'::uuid,
  'ai_analyze_image',
  2,
  'case-id'::uuid
);

-- Check usage log
SELECT * FROM subscription_usage_log WHERE user_id = 'xxx' ORDER BY created_at DESC LIMIT 10;
```

### Stripe product not found
```typescript
// Add stripe_product_id to subscription_plans table
ALTER TABLE subscription_plans ADD COLUMN stripe_product_id TEXT;

UPDATE subscription_plans SET stripe_product_id = 'prod_XXX' WHERE plan_code = 'basic';
```

---

## 📊 ANALYTICS & MONITORING

### Key Metrics to Track

```sql
-- Active subscriptions by plan
SELECT plan_type, COUNT(*) as count
FROM subscriptions
WHERE status = 'active'
GROUP BY plan_type;

-- Monthly Recurring Revenue (MRR)
SELECT SUM(price) as mrr
FROM subscriptions
WHERE status = 'active' AND billing_cycle = 'monthly';

-- Credit usage by tool
SELECT tool_name, COUNT(*) as usage_count, SUM(credits_cost) as total_credits
FROM subscription_usage_log
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY tool_name
ORDER BY usage_count DESC;

-- Churn rate (last 30 days)
SELECT COUNT(*) as canceled_subs
FROM subscriptions
WHERE status = 'cancelled'
AND updated_at >= NOW() - INTERVAL '30 days';
```

### Dashboard Queries
```sql
-- Revenue breakdown
SELECT 
  DATE_TRUNC('month', created_at) as month,
  plan_code,
  SUM(amount) as revenue
FROM subscription_transactions
WHERE status = 'completed'
GROUP BY month, plan_code
ORDER BY month DESC;
```

---

## ✅ POST-DEPLOYMENT CHECKLIST

- [ ] All database tables exist and populated
- [ ] Stripe products & prices created
- [ ] Webhook endpoint configured
- [ ] Edge functions deployed
- [ ] Frontend routes working
- [ ] Test subscription (Stripe) completed
- [ ] Test subscription (Wallet) completed
- [ ] AI tools credit check working
- [ ] Cancel subscription flow tested
- [ ] Cron job scheduled
- [ ] Analytics dashboard setup
- [ ] Documentation updated
- [ ] Team trained on new system

---

## 📞 SUPPORT

### Common User Questions

**Q: Kuidas krediidid töötavad?**
A: Iga AI tööriista kasutus kulutab 1-5 krediiti. Basic: 50/kuu, Premium/Pro: piiramatu.

**Q: Kas saan plaani vahetada?**
A: Jah, upgrade kohe aktiivne, downgrade järgmisel tsüklil.

**Q: Mis juhtub kui krediidid saavad otsa?**
A: Pead ootama järgmist reset'i (kuu algus) või upgrade'ima Premium/Pro plaanile.

**Q: Kas saan tühistada?**
A: Jah, igal ajal. Tellimus jääb aktiivseks kuni perioodi lõpuni.

---

**Last Updated:** December 12, 2025  
**Version:** 1.0  
**Status:** ✅ Ready for Deployment
