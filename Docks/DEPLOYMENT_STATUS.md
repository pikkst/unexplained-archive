# ✅ DEPLOYMENT STATUS

## Completed Steps:

### 1. ✅ Supabase CLI Setup
- Logged in via `npx supabase`
- Project linked to `hbkuximdpvxmcdlkniwi`

### 2. ✅ Edge Functions Deployed
- ✅ `create-donation-checkout` - Deployed
- ✅ `stripe-webhook` - Deployed  
- ✅ `request-withdrawal` - Deployed

View functions: https://supabase.com/dashboard/project/hbkuximdpvxmcdlkniwi/functions

## Next Steps:

### Step 3: Add Stripe Secret Key ⚠️

1. Go to: https://dashboard.stripe.com/test/apikeys
2. Copy your **Secret key** (starts with `sk_test_...`)
3. Run this command:

```powershell
npx supabase secrets set STRIPE_SECRET_KEY="sk_test_YOUR_KEY_HERE"
```

**IMPORTANT:** Replace `YOUR_KEY_HERE` with your actual Stripe secret key!

### Step 4: Run SQL Setup ⚠️

1. Open: https://supabase.com/dashboard/project/hbkuximdpvxmcdlkniwi/sql/new
2. Copy content from: `setup-stripe-database-functions.sql`
3. Click **Run** to create database functions

### Step 5: Setup Stripe Webhook ⚠️

**After adding STRIPE_SECRET_KEY, add webhook:**

1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click **"Add endpoint"**
3. Enter webhook URL:
   ```
   https://hbkuximdpvxmcdlkniwi.supabase.co/functions/v1/stripe-webhook
   ```
4. Select events:
   - ✅ `checkout.session.completed`
   - ✅ `payment_intent.succeeded`
   - ✅ `payment_intent.payment_failed`

5. Click **"Add endpoint"**
6. Copy **Signing secret** (starts with `whsec_...`)
7. Add to Supabase:
   ```powershell
   npx supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_YOUR_SECRET_HERE"
   ```

### Step 6: Test Donation Flow ✅

1. Start dev server: `npm run dev`
2. Login as user
3. Navigate to any case
4. Click **"Donate"**
5. Use test card: `4242 4242 4242 4242`
6. Verify payment completes

## Quick Commands Reference:

```powershell
# View deployed functions
npx supabase functions list

# View function logs
npx supabase functions logs create-donation-checkout

# View all secrets (without values)
npx supabase secrets list

# Set a secret
npx supabase secrets set SECRET_NAME="value"
```

## Troubleshooting:

**Deposit button does nothing?**
- Check browser console (F12) for errors
- Verify `STRIPE_SECRET_KEY` is set
- Check function logs: `npx supabase functions logs create-donation-checkout`

**Payment not completing?**
- Verify SQL functions are created (`setup-stripe-database-functions.sql`)
- Check Stripe dashboard: https://dashboard.stripe.com/test/payments
- View webhook events: https://dashboard.stripe.com/test/webhooks

## Current Status Summary:

| Task | Status |
|------|--------|
| Supabase CLI installed | ✅ Done |
| Project linked | ✅ Done |
| Edge Functions deployed | ✅ Done |
| STRIPE_SECRET_KEY set | ⚠️ TODO |
| Database functions created | ⚠️ TODO |
| Stripe webhook configured | ⚠️ TODO |
| Webhook secret set | ⚠️ TODO |

**Next immediate action:** Add your Stripe secret key!
