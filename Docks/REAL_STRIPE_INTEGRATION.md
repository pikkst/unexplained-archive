# 🚀 TÄIELIK STRIPE INTEGRATSIOON - Real Money Flow

## 🎯 EESMÄRK
Muuta kõik rahavood reaalseks Stripe'i kaudu, mitte ainult DB raamatupidamine.

---

## 📋 VAJALIKUD SAMMUD

### 1️⃣ STRIPE CONNECT SETUP (Escrow & Payouts)

#### Miks Stripe Connect?
- **Escrow** - Raha hoitakse sinu Stripe kontol kuni case resolved
- **Splits** - Automaatne jaotamine (platform fee + investigator payout)
- **Payouts** - Otse investigators panka

#### Setup Steps:

```typescript
// 1. Create Connected Account (investigator)
const account = await stripe.accounts.create({
  type: 'express', // või 'standard' kui tahad rohkem kontrolli
  country: 'EE', // Estonia
  email: investigator.email,
  capabilities: {
    card_payments: { requested: true },
    transfers: { requested: true },
  },
});

// 2. Create Account Link (onboarding)
const accountLink = await stripe.accountLinks.create({
  account: account.id,
  refresh_url: 'https://yoursite.com/reauth',
  return_url: 'https://yoursite.com/return',
  type: 'account_onboarding',
});

// Investigator läheb accountLink.url → täidab Stripe onboarding
```

---

## 💰 UUED RAHAVOOD (REAL MONEY)

### FLOW 1: Case Donation → Stripe Escrow

```
┌─────────────┐
│  Kasutaja   │ Dooneerib €100 case'ile
└──────┬──────┘
       │
       │ 1. Create Checkout Session with destination_charge
       ▼
┌─────────────────────────────────────────┐
│  create-donation-checkout Function       │
│                                          │
│  stripe.checkout.sessions.create({      │
│    mode: 'payment',                     │
│    payment_intent_data: {               │
│      application_fee_amount: 1000,      │ // €10 platform fee (10%)
│      transfer_data: {                   │
│        destination: 'platform_account'  │ // Sinu Stripe konto
│      },                                  │
│    },                                    │
│  })                                      │
└──────────┬──────────────────────────────┘
           │
           │ 2. Payment succeeds
           ▼
┌─────────────────────────────────────────┐
│         STRIPE WEBHOOK                   │
│  payment_intent.succeeded                │
│                                          │
│  Raha on nüüd sinu Stripe kontol:       │
│    €100 - €10 fee = €90 escrow          │
│    €10 on platform balance              │
│                                          │
│  DB Update:                              │
│    case_escrow: +€90                    │
│    platform_revenue: +€10               │
└──────────┬──────────────────────────────┘
           │
           │ 3. Case resolved → Payout
           ▼
┌─────────────────────────────────────────┐
│  release_escrow_to_investigator()        │
│                                          │
│  stripe.transfers.create({              │
│    amount: 7650, // €76.50 (85% of €90) │
│    currency: 'eur',                     │
│    destination: investigator_account_id,│
│    description: 'Case solved reward',   │
│  })                                      │
│                                          │
│  €76.50 → Investigator Stripe Account   │
│  €13.50 → Platform (10% + 15% release)  │
└─────────────────────────────────────────┘

TULEMUS: 
- €90 hoitakse sinu Stripe kontol (escrow)
- €10 platform fee kohe
- Case resolved → €76.50 investigatorile
- €13.50 platform (kokku €23.50 tulu)
```

### FLOW 2: Platform Donation → Stripe Payment

```
┌─────────────┐
│  Kasutaja   │ Dooneerib €50 platvormile
└──────┬──────┘
       │
       │ 1. Create Payment Intent (NOT through wallet)
       ▼
┌─────────────────────────────────────────┐
│  create-platform-donation Function       │
│                                          │
│  stripe.paymentIntents.create({         │
│    amount: 5000, // €50                 │
│    currency: 'eur',                     │
│    metadata: {                           │
│      type: 'platform_donation',         │
│      user_id: xxx                       │
│    }                                     │
│  })                                      │
└──────────┬──────────────────────────────┘
           │
           │ 2. Payment succeeds
           ▼
┌─────────────────────────────────────────┐
│         STRIPE WEBHOOK                   │
│  payment_intent.succeeded                │
│                                          │
│  €50 → Sinu Stripe kontol               │
│                                          │
│  DB Update:                              │
│    platform_revenue: +€50               │
│    transactions: type='donation'        │
└─────────────────────────────────────────┘

TULEMUS: €50 otse platvormile, 100% tulu
```

### FLOW 3: Investigator Withdrawal → Stripe Payout

```
┌─────────────────┐
│  Investigator   │ Wallet: €200
└────────┬────────┘
         │
         │ 1. Request withdrawal €150
         ▼
┌─────────────────────────────────────────┐
│  request-withdrawal Function             │
│                                          │
│  1. Check wallet balance >= €150        │
│  2. Check Stripe Connect verified       │
│  3. Create payout request                │
└──────────┬──────────────────────────────┘
           │
           │ 2. Admin approves (või auto)
           ▼
┌─────────────────────────────────────────┐
│  process-withdrawal Function             │
│                                          │
│  stripe.transfers.create({              │
│    amount: 14700, // €147 (€3 fee)      │
│    currency: 'eur',                     │
│    destination: investigator_account,   │
│  })                                      │
│                                          │
│  DB Update:                              │
│    wallet: €200 → €50                   │
│    transaction: type='withdrawal'       │
│    platform_revenue: +€3 (fee)          │
└─────────────────────────────────────────┘

TULEMUS: 
- Investigator Stripe account: +€147
- €147 auto-transferred to bank
- Platform: +€3 withdrawal fee
```

---

## 🛠️ IMPLEMENTATION STEPS

### STEP 1: Enable Stripe Connect

```bash
# Stripe Dashboard
1. Go to Connect → Settings
2. Enable Express/Standard accounts
3. Set up platform settings
4. Add return/refresh URLs
```

### STEP 2: Create Database Functions

```sql
-- Add Stripe Connect fields to profiles
ALTER TABLE profiles
ADD COLUMN stripe_account_id TEXT UNIQUE,
ADD COLUMN stripe_account_status TEXT DEFAULT 'pending', -- pending, active, restricted
ADD COLUMN stripe_onboarding_completed BOOLEAN DEFAULT FALSE;

-- Add to wallets
ALTER TABLE wallets
ADD COLUMN stripe_balance DECIMAL(10,2) DEFAULT 0.00; -- Real Stripe balance
```

### STEP 3: Create Supabase Edge Functions

Create these files:

```
supabase/functions/
├── create-connected-account/
│   └── index.ts          # Create Stripe Connect account
├── create-account-link/
│   └── index.ts          # Generate onboarding link
├── create-case-donation-checkout/
│   └── index.ts          # Payment with escrow
├── create-platform-donation/
│   └── index.ts          # Direct payment
├── process-payout/
│   └── index.ts          # Transfer to investigator
└── stripe-connect-webhook/
    └── index.ts          # Handle account updates
```

### STEP 4: Frontend Changes

```typescript
// 1. Investigator onboarding
async function setupStripeConnect() {
  const { data } = await supabase.functions.invoke('create-connected-account', {
    body: { userId: user.id }
  });
  
  // Redirect to Stripe onboarding
  window.location.href = data.onboardingUrl;
}

// 2. Case donation (real payment)
async function donateToCase(caseId: string, amount: number) {
  const { data } = await supabase.functions.invoke('create-case-donation-checkout', {
    body: { caseId, amount, userId: user.id }
  });
  
  // Redirect to Stripe Checkout
  window.location.href = data.checkoutUrl;
}

// 3. Withdrawal request
async function requestWithdrawal(amount: number) {
  await supabase.functions.invoke('request-withdrawal', {
    body: { userId: user.id, amount }
  });
}
```

---

## 💡 KEY FEATURES

### Escrow Handled by Stripe
- Raha on füüsiliselt sinu Stripe kontol
- Jaotamine toimub Stripe Transfers API'ga
- Automaatne 7-päevane või 90-päevane hold

### Real Money Tracking
```sql
-- Track real Stripe balances
CREATE TABLE stripe_balances (
  id UUID PRIMARY KEY,
  account_id TEXT, -- Stripe account ID
  available_balance DECIMAL(10,2),
  pending_balance DECIMAL(10,2),
  reserved_balance DECIMAL(10,2), -- Escrow
  last_synced TIMESTAMPTZ DEFAULT NOW()
);
```

### Automatic Reconciliation
```typescript
// Sync Stripe balance with DB daily
async function syncStripeBalances() {
  const balance = await stripe.balance.retrieve();
  
  await supabase.from('stripe_balances').upsert({
    account_id: 'platform',
    available_balance: balance.available[0].amount / 100,
    pending_balance: balance.pending[0].amount / 100,
  });
}
```

---

## 📊 COMPARISON: Before vs After

| Feature | Before (DB Only) | After (Real Stripe) |
|---------|------------------|---------------------|
| **Escrow** | DB field only | Real Stripe balance hold |
| **Payouts** | Manual/fake | Automatic Stripe transfers |
| **Platform Fee** | Calculated only | Actually deducted |
| **Withdrawals** | Can't happen | Real bank transfer |
| **Reconciliation** | Easy to break | Stripe is source of truth |
| **Compliance** | ⚠️ Risk | ✅ Fully compliant |
| **User Trust** | Low | High (see Stripe badge) |

---

## 🚨 IMPORTANT CONSIDERATIONS

### 1. Stripe Fees
```
- Card payments: 1.4% + €0.25
- Payouts (SEPA): €0.25
- Currency conversion: 2%
```

Calculate your real margins:
```
€100 donation:
- Stripe fee: €1.65
- Platform fee (10%): €10.00
- Net to escrow: €88.35

Release to investigator:
- Investigator gets: €75.10 (85% of €88.35)
- Platform keeps: €13.25 (15% of €88.35)
- Total platform revenue: €23.25
- Platform net (after Stripe): €21.60
```

### 2. Tax Implications
- You're handling real money → need proper accounting
- Investigators receive payouts → might need 1099/tax forms (US) or equivalent
- VAT on platform fees in EU

### 3. Reserve Requirements
Stripe might hold a % of your balance as reserve:
```
- Usually 10-20% of transaction volume
- Released after 7-90 days
```

---

## ✅ NEXT STEPS

1. **[CRITICAL]** Enable Stripe Connect in dashboard
2. **Create** all Edge Functions above
3. **Test** in Stripe test mode first
4. **Deploy** to production
5. **Monitor** real money flows

Kas teed selle täieliku integratsiooni? See nõuab umbes 2-3 päeva tööd, aga siis on raha liikumine 100% reaalne ja Stripe-compliant. 🚀
