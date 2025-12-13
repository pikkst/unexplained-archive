# 🚀 Quick Start - Deploy Stripe Edge Functions

## Step 1: Install Supabase CLI

```powershell
# Using Scoop (recommended)
scoop install supabase

# OR using npm
npm install -g supabase
```

## Step 2: Login and Link Project

```powershell
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref hbkuximdpvxmcdlkniwi
```

## Step 3: Set Secrets in Supabase Dashboard

**Go to:** https://supabase.com/dashboard/project/hbkuximdpvxmcdlkniwi/settings/functions

Click **"Manage secrets"** and add:

1. **STRIPE_SECRET_KEY**
   - Get from: https://dashboard.stripe.com/test/apikeys
   - Example: `sk_test_51Sb2aMJ4T6aD44NK...`

2. **STRIPE_WEBHOOK_SECRET** (you'll get this in Step 5)
   - Example: `whsec_...`

## Step 4: Deploy Edge Functions

```powershell
# Deploy all functions at once
supabase functions deploy create-donation-checkout
supabase functions deploy create-subscription-checkout  
supabase functions deploy stripe-webhook
supabase functions deploy request-withdrawal
```

## Step 5: Setup Stripe Webhook

1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click **"Add endpoint"**
3. Enter webhook URL:
   ```
   https://hbkuximdpvxmcdlkniwi.supabase.co/functions/v1/stripe-webhook
   ```
4. Select these events:
   - ✅ `checkout.session.completed`
   - ✅ `payment_intent.succeeded`
   - ✅ `payment_intent.payment_failed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`

5. Click **"Add endpoint"**
6. Copy the **Signing secret** (starts with `whsec_`)
7. Add it to Supabase secrets as `STRIPE_WEBHOOK_SECRET`

## Step 6: Run Database Setup

Open Supabase SQL Editor:
https://supabase.com/dashboard/project/hbkuximdpvxmcdlkniwi/sql/new

Copy and run: `setup-stripe-database-functions.sql`

## Step 7: Test Payment Flow

1. Start your dev server: `npm run dev`
2. Login as a user
3. Go to any case and click **"Donate"**
4. Use Stripe test card: `4242 4242 4242 4242`
5. Check Supabase logs to see payment processing

## ✅ Verification Checklist

- [ ] Supabase CLI installed and logged in
- [ ] Project linked to `hbkuximdpvxmcdlkniwi`
- [ ] `STRIPE_SECRET_KEY` added to Supabase secrets
- [ ] All 4 Edge Functions deployed successfully
- [ ] Stripe webhook endpoint created
- [ ] `STRIPE_WEBHOOK_SECRET` added to Supabase secrets
- [ ] Database functions created (`setup-stripe-database-functions.sql` run)
- [ ] Test donation works with test card

## 🐛 Troubleshooting

**Functions not deploying?**
```powershell
# Check you're logged in
supabase projects list

# Check link status
supabase status
```

**Payments not working?**
- Check browser console (F12) for errors
- View function logs: `supabase functions logs create-donation-checkout`
- Check Stripe dashboard: https://dashboard.stripe.com/test/payments

**Webhook not receiving events?**
- Verify webhook URL is correct
- Check signing secret matches Supabase secret
- View Stripe webhook logs: https://dashboard.stripe.com/test/webhooks

## 📚 Stripe Test Cards

- **Success:** `4242 4242 4242 4242`
- **Decline:** `4000 0000 0000 0002`
- **3D Secure:** `4000 0025 0000 3155`

Use any future expiry date (e.g., 12/34) and any 3-digit CVC.

## 🔗 Important Links

- Supabase Dashboard: https://supabase.com/dashboard/project/hbkuximdpvxmcdlkniwi
- Stripe Dashboard: https://dashboard.stripe.com/test/dashboard
- Edge Functions Logs: https://supabase.com/dashboard/project/hbkuximdpvxmcdlkniwi/logs/edge-functions
- Webhook Logs: https://dashboard.stripe.com/test/webhooks
