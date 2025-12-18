# Stripe Webhook Setup - Fix 401 Error

## Problem
Stripe webhook returns **401 Unauthorized** error when trying to process payments. This prevents wallet deposits and donations from being recorded in the database.

## Root Cause
The `stripe-webhook` edge function is protected by JWT authentication, but Stripe webhooks need to be **publicly accessible** (no authentication required).

## Solution

### Step 1: Configure Supabase Edge Function as Public

1. Go to **Supabase Dashboard**: https://supabase.com/dashboard/project/plyyjvbemdsubmnvudvr
2. Navigate to **Edge Functions** → **stripe-webhook**
3. Click on **Settings** or **Configuration**
4. Find **"Verify JWT"** setting
5. **Disable JWT verification** for this function

**OR** update via Supabase CLI config:

Add to `supabase/config.toml`:

```toml
[functions.stripe-webhook]
verify_jwt = false
```

Then redeploy:
```bash
npx supabase functions deploy stripe-webhook
```

### Step 2: Verify Stripe Webhook Configuration

1. Go to **Stripe Dashboard**: https://dashboard.stripe.com/webhooks
2. Check if webhook endpoint exists:
   ```
   https://plyyjvbemdsubmnvudvr.supabase.co/functions/v1/stripe-webhook
   ```

3. Required events to listen to:
   - ✅ `checkout.session.completed`
   - ✅ `payment_intent.succeeded`
   - ✅ `payment_intent.payment_failed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`

4. Copy the **Signing Secret** and add it to Supabase environment variables:
   - Name: `STRIPE_WEBHOOK_SECRET`
   - Value: `whsec_...` (from Stripe dashboard)

### Step 3: Test the Webhook

1. Go to Stripe Dashboard → Webhooks → Your webhook
2. Click **"Send test webhook"**
3. Select event type: `checkout.session.completed`
4. Click **Send test webhook**
5. Check response - should be **200 OK** (not 401)

### Step 4: Check Supabase Environment Variables

Make sure these are set in **Supabase Dashboard → Project Settings → Edge Functions → Manage secrets**:

```
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_OPERATIONS_ACCOUNT_ID=acct_... (optional)
SUPABASE_URL=https://plyyjvbemdsubmnvudvr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## Verification Steps

### 1. Check Function Logs
```bash
# View recent logs
supabase functions logs stripe-webhook --tail
```

### 2. Test Deposit Flow

1. User deposits €10
2. Check Supabase logs for webhook call
3. Should see: `Webhook received: POST /functions/v1/stripe-webhook`
4. Should return **200 OK** (not 401)
5. Check database for transaction:

```sql
SELECT * FROM transactions 
WHERE transaction_type = 'deposit' 
ORDER BY created_at DESC 
LIMIT 5;

SELECT * FROM wallets 
WHERE updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC;
```

## Current Status

❌ **Issue**: Webhook returns 401 (JWT verification blocking it)
🔧 **Fix Needed**: Disable JWT verification for stripe-webhook function
⏳ **Pending**: Manual configuration in Supabase Dashboard

## After Fix

Once JWT verification is disabled:
1. ✅ Stripe webhooks will work
2. ✅ Deposits will be recorded in database
3. ✅ Wallet balances will update
4. ✅ Transaction history will show
5. ✅ Users will see money in their wallet

## Alternative: Use Deno.serve with proper headers

If JWT verification can't be disabled, modify the function to explicitly handle public access:

```typescript
Deno.serve(async (req) => {
  // Add public access header
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
      } 
    });
  }
  
  // Process webhook...
});
```

But the cleanest solution is to disable JWT verification for webhook endpoints.
