# 🚀 Edge Function Deployment Guide

## Quick Deploy - Wallet Deposit Fix

The wallet deposit function has been fixed in code but needs to be deployed to Supabase.

### Deploy the Fixed Function

```bash
# Deploy the updated create-deposit-checkout function
npx supabase functions deploy create-deposit-checkout --project-ref plyyjvbemdsubmnvudvr
```

**What this does:**
- Uploads the updated function code to Supabase
- The fix includes the `stripeAccount` parameter
- Should resolve the 500 error immediately

---

## Deploy All Payment Functions

If you want to deploy all payment-related functions:

```bash
# Core payment functions
npx supabase functions deploy create-deposit-checkout --project-ref plyyjvbemdsubmnvudvr
npx supabase functions deploy create-escrow-payment-checkout --project-ref plyyjvbemdsubmnvudvr
npx supabase functions deploy stripe-webhook --project-ref plyyjvbemdsubmnvudvr
npx supabase functions deploy request-withdrawal --project-ref plyyjvbemdsubmnvudvr

# Subscription functions
npx supabase functions deploy create-subscription-checkout --project-ref plyyjvbemdsubmnvudvr
npx supabase functions deploy subscribe --project-ref plyyjvbemdsubmnvudvr
npx supabase functions deploy cancel-subscription --project-ref plyyjvbemdsubmnvudvr
npx supabase functions deploy resume-subscription --project-ref plyyjvbemdsubmnvudvr

# Premium services
npx supabase functions deploy purchase-boost-checkout --project-ref plyyjvbemdsubmnvudvr
npx supabase functions deploy request-verification-checkout --project-ref plyyjvbemdsubmnvudvr
```

---

## Prerequisites

### 1. Install Supabase CLI

```bash
# Using npm
npm install -g supabase

# Or using Homebrew (macOS)
brew install supabase/tap/supabase
```

### 2. Login to Supabase

```bash
npx supabase login
```

This will open a browser window for authentication.

### 3. Link Your Project

```bash
npx supabase link --project-ref plyyjvbemdsubmnvudvr
```

---

## Deployment Methods

### Method 1: Supabase Dashboard (Manual)

1. Go to: https://supabase.com/dashboard/project/plyyjvbemdsubmnvudvr/functions
2. Find `create-deposit-checkout`
3. Click "Deploy"
4. Paste the code from `supabase/functions/create-deposit-checkout/index.ts`
5. Click "Deploy Function"

✅ **Easiest for single function**
❌ Slower for multiple functions

### Method 2: Supabase CLI (Recommended)

```bash
# Deploy single function
npx supabase functions deploy create-deposit-checkout --project-ref plyyjvbemdsubmnvudvr

# Deploy with verification
npx supabase functions deploy create-deposit-checkout --project-ref plyyjvbemdsubmnvudvr --verify-jwt
```

✅ **Fast and reliable**
✅ Can deploy multiple at once
✅ Automated deployment

### Method 3: GitHub Actions (Automated)

The repository has a GitHub Actions workflow at `.github/workflows/deploy.yml`.

**To trigger automatic deployment:**
```bash
git push origin main
```

The workflow will automatically deploy on push to main branch.

---

## Verify Deployment

### 1. Check Supabase Dashboard

Go to: https://supabase.com/dashboard/project/plyyjvbemdsubmnvudvr/functions/create-deposit-checkout

Look for:
- ✅ Status: Active
- ✅ Last deployed: Recent timestamp
- ✅ Version: Should match your code

### 2. Test the Function

```bash
# Test with curl
curl -X POST 'https://plyyjvbemdsubmnvudvr.supabase.co/functions/v1/create-deposit-checkout' \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 10,
    "userId": "test-user-id"
  }'
```

Expected response:
```json
{
  "sessionId": "cs_test_...",
  "checkoutUrl": "https://checkout.stripe.com/..."
}
```

### 3. Check Logs

```bash
# View real-time logs
npx supabase functions logs create-deposit-checkout --project-ref plyyjvbemdsubmnvudvr
```

Look for:
- ✅ No errors
- ✅ "Creating Stripe Checkout session" message
- ✅ Successful return with sessionId

---

## Common Issues

### Issue 1: "Function not found"

**Solution:**
```bash
npx supabase link --project-ref plyyjvbemdsubmnvudvr
npx supabase functions deploy create-deposit-checkout --project-ref plyyjvbemdsubmnvudvr
```

### Issue 2: "Unauthorized"

**Solution:**
```bash
npx supabase login
# Follow the browser authentication
```

### Issue 3: "Environment variables not set"

**Solution:**
Go to Supabase Dashboard → Edge Functions → Settings
Ensure these are set:
- `STRIPE_SECRET_KEY`
- `STRIPE_OPERATIONS_ACCOUNT_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Issue 4: Still getting 500 error after deployment

**Solution:**
1. Check edge function logs
2. Verify Stripe account ID is correct
3. Test with Stripe test keys first
4. Check that customer creation works

---

## Environment Variables

Ensure these are set in Supabase Dashboard:

| Variable | Description | Where to Find |
|----------|-------------|---------------|
| `STRIPE_SECRET_KEY` | Stripe API secret key | Stripe Dashboard → Developers → API Keys |
| `STRIPE_OPERATIONS_ACCOUNT_ID` | Connected account ID | Stripe Dashboard → Connect → Accounts |
| `SUPABASE_URL` | Your Supabase project URL | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | Supabase Dashboard → Settings → API |

---

## Deployment Checklist

Before deploying:

- [ ] Code is tested locally
- [ ] All environment variables are set
- [ ] Stripe account is configured
- [ ] Git changes are committed
- [ ] No syntax errors in function code

After deploying:

- [ ] Function shows "Active" in dashboard
- [ ] Test with real user flow
- [ ] Check logs for errors
- [ ] Monitor Stripe dashboard for payments
- [ ] Verify database transactions are created

---

## Quick Fix: Deploy Now

**For immediate fix of wallet deposit issue:**

```bash
# 1. Login
npx supabase login

# 2. Link project
npx supabase link --project-ref plyyjvbemdsubmnvudvr

# 3. Deploy the fixed function
npx supabase functions deploy create-deposit-checkout --project-ref plyyjvbemdsubmnvudvr

# 4. Verify
npx supabase functions logs create-deposit-checkout --project-ref plyyjvbemdsubmnvudvr --follow
```

Then test wallet deposit in the app!

---

## Need Help?

- **Supabase Docs:** https://supabase.com/docs/guides/functions
- **Edge Functions Guide:** https://supabase.com/docs/guides/functions/deploy
- **Stripe Connect Docs:** https://stripe.com/docs/connect

---

**Last Updated:** 2025-12-14  
**Status:** Ready to deploy 🚀
