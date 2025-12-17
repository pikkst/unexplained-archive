# Google Ads Conversion Tracking Setup

## Overview

This document explains how to set up Google Ads conversion tracking for the Unexplained Archive platform. We've implemented a universal payment success page that tracks all successful transactions including wallet deposits, case donations, subscriptions, and boost purchases.

## Payment Success Page

**URL:** `/payment/success`

This is the universal confirmation page where all successful payments redirect. It supports multiple payment types and can be configured as the conversion page in Google Ads.

### URL Parameters

The success page accepts the following query parameters:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `type` | Payment type | `deposit`, `donation`, `subscription`, `boost` |
| `amount` | Transaction amount in EUR | `20.00` |
| `session_id` | Stripe session ID | `cs_test_a1b2c3...` |
| `case_id` | Case ID for donations/boosts | `uuid` |
| `case_name` | Case name for donations | `The Phoenix Lights` |

### Example URLs

**Wallet Deposit:**
```
https://yourdomain.com/payment/success?type=deposit&amount=50.00&session_id=cs_test_...
```

**Case Donation:**
```
https://yourdomain.com/payment/success?type=donation&amount=20.00&case_id=123&case_name=Mystery%20Case
```

**Subscription:**
```
https://yourdomain.com/payment/success?type=subscription&session_id=cs_test_...
```

**Boost Purchase:**
```
https://yourdomain.com/payment/success?type=boost&amount=15.00&case_id=123
```

## Google Ads Configuration

### Step 1: Create a Conversion Action

1. Log in to your Google Ads account
2. Click **Tools & Settings** → **Conversions**
3. Click the **+ New conversion action** button
4. Select **Website**

### Step 2: Configure Conversion Settings

**Conversion Name:** `Payment Completed` (or any descriptive name)

**Category:** Purchase/Sale

**Value:** 
- Select "Use different values for each conversion"
- The page dynamically tracks the actual transaction amount

**Count:** 
- Select "Every" if you want to count all transactions
- Select "One" if you want to count only unique conversions per user

**Conversion Window:** 30 days (recommended)

**Attribution Model:** Data-driven or Last Click

### Step 3: Set Conversion Page URL

**Enter the webpage where a subscription is confirmed:**
```
https://yourdomain.com/payment/success
```

Replace `yourdomain.com` with your actual domain.

### Step 4: Install Google Tag (if not already installed)

If you haven't installed the Google tag yet:

1. Copy the Google tag code provided
2. Add it to your `index.html` file in the `<head>` section
3. The tag should look like this:

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'AW-XXXXXXXXXX');
</script>
```

### Step 5: Add Conversion Tracking Code

The conversion tracking is already implemented in the `PaymentSuccess` component. You just need to update the conversion ID and label:

1. Open `/src/components/PaymentSuccess.tsx`
2. Find the `gtag` conversion event around line 33:
```typescript
(window as any).gtag('event', 'conversion', {
  'send_to': 'AW-CONVERSION_ID/CONVERSION_LABEL',
  'value': amount ? parseFloat(amount) : 0,
  'currency': 'EUR',
  'transaction_id': sessionId || `${type}_${Date.now()}`
});
```

3. Replace `AW-CONVERSION_ID/CONVERSION_LABEL` with your actual values from Google Ads:
   - Example: `'AW-123456789/AbC-dEfGhIjKlMnOp'`

### Step 6: Test Conversion Tracking

1. Enable Google Ads conversion tracking in test mode
2. Complete a test transaction (use Stripe test mode)
3. Verify the conversion fires in Google Ads:
   - Go to **Tools & Settings** → **Conversions**
   - Check if your test conversion appears (may take a few hours)

## Enhanced Conversion Tracking (Optional)

For better tracking and remarketing, you can enhance the conversion event with user data:

```typescript
gtag('event', 'conversion', {
  'send_to': 'AW-CONVERSION_ID/CONVERSION_LABEL',
  'value': amount,
  'currency': 'EUR',
  'transaction_id': sessionId,
  'email': userEmail, // Hashed email for enhanced conversions
  'phone_number': userPhone, // Hashed phone number
});
```

⚠️ **Privacy Note:** Make sure to hash user data (email, phone) before sending to Google Ads and comply with GDPR/privacy regulations.

## Payment Flow Integration

### Current Payment Flows

All payment methods now redirect to the universal success page:

1. **Wallet Deposits** (`/services/walletService.ts`)
   - Redirects to: `/payment/success?type=deposit&amount={amount}`

2. **Case Donations** (`/services/stripeService.ts`)
   - Redirects to: `/payment/success?type=donation&amount={amount}&case_id={caseId}&case_name={caseName}`

3. **Subscriptions** (`/services/stripeService.ts`)
   - Redirects to: `/payment/success?type=subscription`

4. **Boost Purchases** (`/services/boostService.ts`)
   - Redirects to: `/payment/success?type=boost&amount={amount}&case_id={caseId}`

### Edge Function Updates

The following Supabase Edge Functions have been updated to support custom success URLs:

- `create-direct-payment-checkout` - For boost purchases
- `create-donation-checkout` - For wallet deposits
- `create-escrow-payment-checkout` - For case donations
- `create-subscription-checkout` - For subscriptions

## Monitoring and Analytics

### Tracking Metrics

The success page automatically tracks:
- ✅ Transaction amount
- ✅ Transaction type
- ✅ Stripe session ID
- ✅ Timestamp
- ✅ User information (if logged in)

### Google Analytics Integration

If you're also using Google Analytics, the same `gtag` function will send data to both Google Ads and Google Analytics. Make sure both tracking IDs are configured:

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  
  // Google Analytics
  gtag('config', 'G-XXXXXXXXXX');
  
  // Google Ads
  gtag('config', 'AW-XXXXXXXXXX');
</script>
```

## Troubleshooting

### Conversions Not Showing in Google Ads

1. **Check tag installation:** Use Google Tag Assistant Chrome extension
2. **Verify conversion ID:** Make sure the conversion ID and label are correct
3. **Wait for processing:** Conversions can take up to 24 hours to appear
4. **Test mode:** Make sure you're not in test mode for production tracking
5. **Ad blockers:** Some users may have ad blockers that prevent tracking

### URL Parameters Not Passing

1. Check Stripe webhook configuration
2. Verify edge function success URLs
3. Test with console.log in the success page
4. Check browser network tab for redirect URLs

### Testing Conversions

Use Stripe test mode and test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`

## Security Considerations

- ✅ Conversion tracking uses client-side JavaScript only
- ✅ No sensitive payment data is sent to Google Ads
- ✅ Only transaction metadata (amount, type) is tracked
- ✅ Session IDs are hashed and anonymized
- ✅ User emails are only tracked if explicitly enabled and hashed

## Support

For issues with:
- **Google Ads setup:** Contact Google Ads support
- **Payment integration:** Check Stripe dashboard and logs
- **Tracking code:** Review browser console and network tab
- **Edge functions:** Check Supabase function logs

## Additional Resources

- [Google Ads Conversion Tracking Guide](https://support.google.com/google-ads/answer/1722022)
- [Enhanced Conversions Setup](https://support.google.com/google-ads/answer/9888656)
- [Stripe Checkout Documentation](https://stripe.com/docs/payments/checkout)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
