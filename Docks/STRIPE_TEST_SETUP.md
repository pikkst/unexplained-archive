# STRIPE TEST ENVIRONMENT SETUP

## 🔧 Quick Setup Guide

### 1. Stripe Products Configuration

Login to Stripe Dashboard (test mode): https://dashboard.stripe.com/test/products

#### Product 1: Investigator Pro Subscription
- **Name:** Investigator Pro Monthly
- **Price:** €15.00 / month
- **Billing:** Recurring monthly
- **Product ID:** Save this for later (e.g., `prod_xxxxx`)
- **Price ID:** Save this for later (e.g., `price_xxxxx`)

#### Product 2: Case Boosts (handled dynamically)
- Boosts are created dynamically via Checkout API
- Prices: €5 (24h), €15 (7d), €50 (30d)
- No static product needed

#### Product 3: Background Verification (handled dynamically)
- Verification requests created dynamically
- Prices: €25 (standard), €50 (premium)
- No static product needed

---

### 2. Webhook Configuration

#### Get your Edge Function URL:
```bash
supabase functions list
# Copy the URL for stripe-webhook function
```

Typical URL format:
```
https://[project-ref].supabase.co/functions/v1/stripe-webhook
```

#### Add Webhook in Stripe Dashboard:
1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click **"Add endpoint"**
3. Enter URL: `https://[project-ref].supabase.co/functions/v1/stripe-webhook`
4. Select events to listen for:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
5. Click **"Add endpoint"**
6. **Copy the Webhook Secret** (starts with `whsec_...`)

---

### 3. Environment Variables

Add to Supabase Edge Functions secrets:

```bash
# Stripe Keys
supabase secrets set STRIPE_SECRET_KEY=sk_test_xxxxx
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Verify secrets
supabase secrets list
```

Also add to local `.env` file for development:
```env
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
```

---

### 4. Frontend Environment Variables

Add to `src/lib/stripe.ts` or environment config:

```typescript
export const STRIPE_PUBLISHABLE_KEY = 'pk_test_xxxxx';
```

Or use `.env` file:
```env
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
```

---

### 5. Deploy Edge Functions

```powershell
# Deploy all payment functions
supabase functions deploy purchase-boost-checkout
supabase functions deploy request-verification-checkout
supabase functions deploy stripe-webhook

# Verify deployment
supabase functions list
```

---

### 6. Test Card Numbers (Stripe Test Mode)

#### Successful Payment:
```
Card: 4242 4242 4242 4242
Expiry: Any future date (e.g., 12/25)
CVC: Any 3 digits (e.g., 123)
ZIP: Any valid ZIP
```

#### Payment Declined:
```
Card: 4000 0000 0000 0002
```

#### Requires Authentication (3D Secure):
```
Card: 4000 0025 0000 3155
```

---

### 7. Testing Workflow

#### Test Case Boost Purchase:
1. Create a case (as logged-in user)
2. Navigate to case detail page
3. Click "Boost This Case"
4. Select boost tier (24h/€5)
5. Choose payment method: Stripe
6. Complete checkout with test card `4242 4242 4242 4242`
7. Verify redirect back to case page
8. Check case has "BOOSTED" badge

#### Test Verification Request:
1. Login as investigator (approved status)
2. Go to Investigator Dashboard
3. Click "Get Verified"
4. Select Standard (€25)
5. Choose payment method: Stripe
6. Complete checkout with test card
7. Verify badge appears after admin approval

#### Test Webhook Delivery:
1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click on your webhook endpoint
3. View "Events sent" tab
4. Check for successful deliveries
5. Click "Send test webhook" to manually trigger

---

### 8. Database Verification

After successful payment, verify database records:

```sql
-- Check transactions
SELECT * FROM transactions 
WHERE transaction_type IN ('case_boost', 'background_check')
ORDER BY created_at DESC 
LIMIT 10;

-- Check active boosts
SELECT * FROM featured_cases 
WHERE status = 'active' 
AND featured_until > NOW();

-- Check verification requests
SELECT * FROM background_checks 
WHERE status = 'pending' 
ORDER BY created_at DESC;

-- Check platform revenue
SELECT * FROM platform_revenue 
ORDER BY created_at DESC 
LIMIT 10;
```

---

### 9. Common Issues & Solutions

#### Issue: Webhook not receiving events
**Solution:**
- Verify URL is correct (no typos)
- Check Edge Function is deployed
- Verify webhook secret is set correctly
- Test webhook manually in Stripe Dashboard

#### Issue: Payment succeeds but boost not activated
**Solution:**
- Check webhook logs in Stripe Dashboard
- Check Edge Function logs: `supabase functions logs stripe-webhook`
- Verify RLS policies allow insert

#### Issue: "Insufficient wallet balance" error
**Solution:**
- Make sure to select "Credit Card" payment method
- Or deposit funds to wallet first

#### Issue: Verification badge not showing
**Solution:**
- Admin must approve verification first
- Check `background_checks` table status
- Refresh page after approval

---

### 10. Monitoring & Logs

#### View Edge Function Logs:
```powershell
# Real-time logs
supabase functions logs stripe-webhook --tail

# View boost checkout logs
supabase functions logs purchase-boost-checkout --tail

# View verification checkout logs
supabase functions logs request-verification-checkout --tail
```

#### View Stripe Events:
- Dashboard → Developers → Events
- Filter by event type
- View request/response data

---

## 🎯 Quick Start Checklist

- [ ] Create Investigator Pro product in Stripe
- [ ] Add webhook endpoint with `checkout.session.completed` event
- [ ] Copy webhook secret
- [ ] Set Stripe secrets in Supabase
- [ ] Deploy all 3 Edge Functions
- [ ] Test boost purchase with test card
- [ ] Test verification request
- [ ] Verify database records
- [ ] Check webhook delivery in Stripe Dashboard

---

## 📞 Support

If issues persist:
1. Check Edge Function logs
2. Check Stripe webhook delivery logs
3. Verify database RLS policies
4. Test with `curl` to webhook URL

Test webhook manually:
```powershell
curl -X POST https://[project-ref].supabase.co/functions/v1/stripe-webhook `
  -H "Content-Type: application/json" `
  -H "stripe-signature: test" `
  -d '{"type":"checkout.session.completed"}'
```
