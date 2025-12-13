# Supabase Edge Functions Setup Guide

## 📁 Created Functions

1. **create-donation-checkout** - Create Stripe payment session for donations
2. **create-subscription-checkout** - Create subscription payment session
3. **stripe-webhook** - Handle Stripe webhook events
4. **request-withdrawal** - Process withdrawal requests

## 🚀 Deployment Steps

### 1. Install Supabase CLI

```bash
# Windows (PowerShell)
scoop install supabase

# Or use npm
npm install -g supabase
```

### 2. Login to Supabase

```bash
supabase login
```

### 3. Link Your Project

```bash
supabase link --project-ref hbkuximdpvxmcdlkniwi
```

### 4. Set Environment Variables in Supabase Dashboard

Go to: https://supabase.com/dashboard/project/hbkuximdpvxmcdlkniwi/settings/functions

Add these secrets:
- `STRIPE_SECRET_KEY` = `sk_test_...` (your Stripe secret key)
- `STRIPE_WEBHOOK_SECRET` = `whsec_...` (from Stripe webhook settings)

### 5. Deploy Functions

```bash
# Deploy all functions
supabase functions deploy create-donation-checkout
supabase functions deploy create-subscription-checkout
supabase functions deploy stripe-webhook
supabase functions deploy request-withdrawal
```

### 6. Configure Stripe Webhook

1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click "Add endpoint"
3. Enter URL: `https://hbkuximdpvxmcdlkniwi.supabase.co/functions/v1/stripe-webhook`
4. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy the webhook signing secret and add to Supabase secrets

## 📝 Required Database Functions

Add these to your Supabase SQL editor:

```sql
-- Increment case escrow
CREATE OR REPLACE FUNCTION increment_case_escrow(case_id UUID, amount DECIMAL)
RETURNS VOID AS $$
BEGIN
  UPDATE cases 
  SET current_escrow = current_escrow + amount
  WHERE id = case_id;
END;
$$ LANGUAGE plpgsql;

-- Add wallet balance
CREATE OR REPLACE FUNCTION add_wallet_balance(wallet_id UUID, amount DECIMAL)
RETURNS VOID AS $$
BEGIN
  UPDATE wallets 
  SET balance = balance + amount
  WHERE id = wallet_id;
END;
$$ LANGUAGE plpgsql;
```

## 🧪 Testing

### Test Donation Checkout

```bash
curl -X POST https://hbkuximdpvxmcdlkniwi.supabase.co/functions/v1/create-donation-checkout \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "caseId": "uuid-here",
    "amount": 20,
    "userId": "user-uuid",
    "successUrl": "http://localhost:5173/cases/uuid?donation=success",
    "cancelUrl": "http://localhost:5173/cases/uuid?donation=canceled"
  }'
```

## 🔐 Security Notes

1. **Never commit** `STRIPE_SECRET_KEY` to Git
2. **Always validate** webhook signatures in production
3. **Use Stripe test mode** for development
4. **Verify user authentication** in all functions

## 📊 Monitoring

- View function logs: `supabase functions logs create-donation-checkout`
- Check Stripe dashboard: https://dashboard.stripe.com/test/logs
- Monitor Supabase logs: https://supabase.com/dashboard/project/hbkuximdpvxmcdlkniwi/logs

## 🐛 Troubleshooting

### Function not found
- Make sure functions are deployed: `supabase functions list`
- Check function name matches exactly in code

### CORS errors
- Verify `corsHeaders` are included in all responses
- Check browser console for specific CORS error

### Webhook not receiving events
- Verify webhook URL is correct in Stripe dashboard
- Check webhook signing secret matches Supabase secret
- Ensure endpoint is listening for correct events

### Payment not processing
- Check Stripe dashboard for payment status
- View function logs for errors
- Verify database functions exist (increment_case_escrow, add_wallet_balance)

## 📚 Additional Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Deno Deploy](https://deno.com/deploy)
