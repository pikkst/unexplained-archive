# 🎯 LIHTSUSTATUD STRIPE ARHITEKTUUR
## 2 Kontot + Serveri Hallatavad Rahakotid

---

## 📊 ARHITEKTUUR ÜLEVAADE

### ❌ MITTE SEE (Liiga keeruline):
```
- Iga kasutaja = 1 Stripe Connect account
- Stripe haldab kõike
- Palju bürokraatiat, verification, compliance
```

### ✅ VAID SEE (Lihtne ja toimiv):
```
┌─────────────────────────────────────────┐
│         STRIPE ACCOUNTS (2)              │
├─────────────────────────────────────────┤
│                                          │
│  1️⃣  OPERATIONS ACCOUNT                 │
│      - Kasutajate wallet balances       │
│      - Escrow funds (case donations)    │
│      - Withdrawals pool                 │
│                                          │
│  2️⃣  REVENUE ACCOUNT                    │
│      - Platform fees                    │
│      - Platform donations               │
│      - Net profit                       │
│                                          │
└─────────────────────────────────────────┘
            │
            │ Server haldab kõiki kasutajaid
            ▼
┌─────────────────────────────────────────┐
│      DATABASE (Virtual Wallets)          │
├─────────────────────────────────────────┤
│  User A: €100  → Operations kontol      │
│  User B: €50   → Operations kontol      │
│  Case Escrow: €200 → Operations kontol  │
│  Platform Revenue: €50 → Revenue kontol │
└─────────────────────────────────────────┘
```

---

## 💰 RAHAVOOD (Real Implementation)

### FLOW 1: Kasutaja lisab raha rahakotti

```
┌─────────────┐
│  Kasutaja   │ Tahab €100 oma rahakotti
└──────┬──────┘
       │
       │ 1. Checkout Session
       ▼
┌─────────────────────────────────────────┐
│  Stripe Checkout                         │
│  Amount: €100                            │
│  Destination: OPERATIONS ACCOUNT         │
└──────────┬──────────────────────────────┘
           │
           │ 2. Payment Success
           ▼
┌─────────────────────────────────────────┐
│  OPERATIONS ACCOUNT                      │
│  Balance: +€100                          │
│                                          │
│  Webhook → DB Update:                   │
│    wallets.balance: +€100               │
│    transactions: type='deposit'         │
└─────────────────────────────────────────┘

TULEMUS:
✅ €100 on füüsiliselt Operations kontol
✅ DB näitab kasutajale: Wallet €100
✅ No Stripe fees to user (või lisad 3% fee)
```

### FLOW 2: Kasutaja dooneerib case'ile rahakotist

```
┌─────────────┐
│  Kasutaja   │ Wallet: €100, dooneerib €50
└──────┬──────┘
       │
       │ 1. Internal transfer (NO Stripe API call)
       ▼
┌─────────────────────────────────────────┐
│  DATABASE TRANSACTION                    │
│                                          │
│  BEGIN;                                  │
│    wallets.balance: €100 → €50          │
│    case_escrow: +€45 (90%)              │
│    platform_revenue: +€5 (10% fee)      │
│  COMMIT;                                 │
└──────────┬──────────────────────────────┘
           │
           │ 2. Nightly reconciliation
           ▼
┌─────────────────────────────────────────┐
│  INTERNAL STRIPE TRANSFER                │
│  (happens daily, not per transaction)   │
│                                          │
│  stripe.transfers.create({              │
│    amount: 500, // €5                   │
│    source: 'operations_account',        │
│    destination: 'revenue_account',      │
│  })                                      │
└─────────────────────────────────────────┘

TULEMUS:
✅ Kohene DB update (user sees instant change)
✅ NO Stripe API call per donation
✅ Öise batch transfer fees → revenue account
✅ Operations account balance = SUM(all wallets + escrows)
```

### FLOW 3: Case resolved → Investigator saab raha

```
┌─────────────┐
│    Case     │ Status: resolved, Escrow: €90
└──────┬──────┘
       │
       │ 1. Release escrow
       ▼
┌─────────────────────────────────────────┐
│  DATABASE TRANSACTION                    │
│                                          │
│  BEGIN;                                  │
│    case_escrow: €90 → €0                │
│    investigator_wallet: +€76.50 (85%)   │
│    platform_revenue: +€13.50 (15%)      │
│  COMMIT;                                 │
└──────────┬──────────────────────────────┘
           │
           │ Raha on nüüd investigatori walletis
           │ Reaalselt ikka Operations kontol
           ▼

Investigator saab raha kasutada:
  a) Withdraw → pangakontole
  b) Donate teistele case'idele
  c) Platform donation
```

### FLOW 4: Investigator võtab raha välja

```
┌─────────────────┐
│  Investigator   │ Wallet: €200, tahab €150 välja
└────────┬────────┘
         │
         │ 1. Withdrawal request
         ▼
┌─────────────────────────────────────────┐
│  WITHDRAWAL QUEUE                        │
│  - Check minimum: €50                   │
│  - Apply fee: €3 (2%)                   │
│  - Net payout: €147                     │
└──────────┬──────────────────────────────┘
           │
           │ 2. Daily batch processing (16:00)
           ▼
┌─────────────────────────────────────────┐
│  STRIPE PAYOUT API                       │
│                                          │
│  stripe.payouts.create({                │
│    amount: 14700, // €147               │
│    currency: 'eur',                     │
│    destination: bank_account,           │
│    method: 'instant', // või 'standard'│
│  })                                      │
│                                          │
│  Operations account: -€150              │
│  Revenue account: +€3 (fee)             │
└──────────┬──────────────────────────────┘
           │
           │ 3. Payout completed (2 hours või instant)
           ▼
┌─────────────────────────────────────────┐
│  INVESTIGATOR BANK ACCOUNT               │
│  Balance: +€147                          │
│                                          │
│  DB Update:                              │
│    wallet.balance: €200 → €50           │
│    transactions: type='withdrawal'      │
└─────────────────────────────────────────┘

TULEMUS:
✅ €147 investigatori pangakontol
✅ €3 platform fee → revenue account
✅ Operations account balance väheneb €150
```

### FLOW 5: Platform donation (direct)

```
┌─────────────┐
│  Kasutaja   │ Tahab annetada €50 platvormile
└──────┬──────┘
       │
       │ Option A: From wallet
       ▼
┌─────────────────────────────────────────┐
│  INTERNAL TRANSFER                       │
│  wallet: -€50                            │
│  platform_revenue: +€50                  │
│                                          │
│  Nightly batch:                          │
│    Operations → Revenue: €50             │
└─────────────────────────────────────────┘

       │ Option B: Direct payment (new money)
       ▼
┌─────────────────────────────────────────┐
│  STRIPE CHECKOUT                         │
│  Amount: €50                             │
│  Destination: REVENUE ACCOUNT            │
│                                          │
│  Payment success:                        │
│    Revenue account: +€50                 │
│    DB: platform_revenue: +€50            │
└─────────────────────────────────────────┘

TULEMUS:
✅ Option A: Wallet raha → Revenue (batch)
✅ Option B: Uus raha → Revenue (kohe)
```

---

## 🏗️ DATABASE SCHEMA

### Wallets Table (No Stripe Connection)
```sql
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  balance DECIMAL(10,2) DEFAULT 0.00,
  reserved DECIMAL(10,2) DEFAULT 0.00, -- Pending withdrawals
  lifetime_earned DECIMAL(10,2) DEFAULT 0.00,
  lifetime_donated DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NO stripe_account_id needed!
```

### Withdrawal Requests (Queue System)
```sql
CREATE TABLE withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  amount DECIMAL(10,2) NOT NULL,
  fee DECIMAL(10,2) NOT NULL,
  net_amount DECIMAL(10,2) NOT NULL,
  
  -- Bank details (collected from user)
  bank_name TEXT NOT NULL,
  iban TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  
  -- Stripe payout
  stripe_payout_id TEXT UNIQUE,
  
  -- Timing
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Error handling
  failure_reason TEXT,
  retry_count INT DEFAULT 0
);
```

### Stripe Accounts (Only 2 records)
```sql
CREATE TABLE stripe_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_type TEXT UNIQUE, -- 'operations' või 'revenue'
  stripe_account_id TEXT UNIQUE NOT NULL,
  
  -- Balance tracking
  available_balance DECIMAL(10,2) DEFAULT 0.00,
  pending_balance DECIMAL(10,2) DEFAULT 0.00,
  
  -- Reconciliation
  db_balance DECIMAL(10,2) DEFAULT 0.00, -- Calculated from DB
  last_reconciled_at TIMESTAMPTZ,
  reconciliation_diff DECIMAL(10,2) DEFAULT 0.00, -- Should be 0!
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initial data:
INSERT INTO stripe_accounts (account_type, stripe_account_id) VALUES
  ('operations', 'acct_OPERATIONS_ID'),
  ('revenue', 'acct_REVENUE_ID');
```

### Daily Transfers Log
```sql
CREATE TABLE internal_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_date DATE NOT NULL,
  
  -- What was transferred
  fees_collected DECIMAL(10,2) DEFAULT 0.00, -- Platform fees from operations
  donations_collected DECIMAL(10,2) DEFAULT 0.00, -- Direct platform donations
  total_amount DECIMAL(10,2) NOT NULL,
  
  -- Stripe transfer
  stripe_transfer_id TEXT UNIQUE,
  
  -- Status
  status TEXT DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔄 BALANCE RECONCILIATION

### Operations Account Balance Formula
```sql
-- What Operations account SHOULD contain:
SELECT 
  -- All user wallets
  (SELECT COALESCE(SUM(balance), 0) FROM wallets) +
  
  -- All case escrows
  (SELECT COALESCE(SUM(amount), 0) FROM case_escrow WHERE status = 'active') +
  
  -- Pending withdrawals
  (SELECT COALESCE(SUM(amount), 0) FROM withdrawal_requests WHERE status IN ('pending', 'processing'))
  
  AS expected_operations_balance;

-- Compare with actual Stripe balance
SELECT 
  available_balance + pending_balance AS actual_stripe_balance
FROM stripe_accounts 
WHERE account_type = 'operations';

-- Difference should be 0 (or within €1 due to rounding)
```

### Revenue Account Balance Formula
```sql
-- What Revenue account SHOULD contain:
SELECT 
  COALESCE(SUM(amount), 0) 
FROM transactions 
WHERE transaction_type IN ('platform_fee', 'platform_donation', 'withdrawal_fee')
  AS expected_revenue_balance;

-- Compare with actual Stripe balance
SELECT available_balance 
FROM stripe_accounts 
WHERE account_type = 'revenue';
```

### Daily Reconciliation Job
```typescript
// Run daily at 23:00
async function reconcileAccounts() {
  // 1. Get Operations balance
  const { data: opsCalc } = await supabase.rpc('calculate_operations_balance');
  const opsStripe = await stripe.balance.retrieve({ stripeAccount: 'acct_OPERATIONS_ID' });
  
  const opsDiff = opsStripe.available[0].amount / 100 - opsCalc.total;
  
  // 2. Get Revenue balance
  const { data: revCalc } = await supabase.rpc('calculate_revenue_balance');
  const revStripe = await stripe.balance.retrieve({ stripeAccount: 'acct_REVENUE_ID' });
  
  const revDiff = revStripe.available[0].amount / 100 - revCalc.total;
  
  // 3. Update reconciliation table
  await supabase.from('stripe_accounts').update({
    available_balance: opsStripe.available[0].amount / 100,
    db_balance: opsCalc.total,
    reconciliation_diff: opsDiff,
    last_reconciled_at: new Date().toISOString()
  }).eq('account_type', 'operations');
  
  // 4. Alert if difference > €1
  if (Math.abs(opsDiff) > 1) {
    await sendAlertToAdmin(`Operations account mismatch: €${opsDiff}`);
  }
  
  if (Math.abs(revDiff) > 1) {
    await sendAlertToAdmin(`Revenue account mismatch: €${revDiff}`);
  }
}
```

---

## 🚀 EDGE FUNCTIONS (Simplified)

### 1. `wallet-deposit` - Add money to wallet
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Stripe from 'https://esm.sh/stripe@12.0.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
})

serve(async (req) => {
  const { userId, amount } = await req.json() // amount in EUR
  
  // Create Checkout Session → OPERATIONS account
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: { name: 'Wallet Deposit' },
        unit_amount: Math.round(amount * 100), // Convert to cents
      },
      quantity: 1,
    }],
    metadata: {
      type: 'wallet_deposit',
      user_id: userId,
    },
    success_url: `${req.headers.get('origin')}/wallet?success=true`,
    cancel_url: `${req.headers.get('origin')}/wallet?canceled=true`,
  })
  
  return new Response(JSON.stringify({ url: session.url }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

### 2. `stripe-webhook` - Handle payments
```typescript
serve(async (req) => {
  const sig = req.headers.get('stripe-signature')!
  const body = await req.text()
  
  const event = stripe.webhooks.constructEvent(
    body,
    sig,
    Deno.env.get('STRIPE_WEBHOOK_SECRET')!
  )
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    
    if (session.metadata.type === 'wallet_deposit') {
      // Add to user wallet in DB
      await supabase.rpc('add_wallet_balance', {
        p_user_id: session.metadata.user_id,
        p_amount: session.amount_total / 100,
      })
      
      // Log transaction
      await supabase.from('transactions').insert({
        user_id: session.metadata.user_id,
        transaction_type: 'deposit',
        amount: session.amount_total / 100,
        stripe_payment_id: session.payment_intent,
      })
    }
  }
  
  return new Response(JSON.stringify({ received: true }))
})
```

### 3. `request-withdrawal` - Queue withdrawal
```typescript
serve(async (req) => {
  const { userId, amount, bankDetails } = await req.json()
  
  // 1. Check wallet balance
  const { data: wallet } = await supabase
    .from('wallets')
    .select('balance')
    .eq('user_id', userId)
    .single()
  
  if (wallet.balance < amount) {
    return new Response(JSON.stringify({ error: 'Insufficient balance' }), {
      status: 400
    })
  }
  
  // 2. Calculate fee (2%)
  const fee = amount * 0.02
  const netAmount = amount - fee
  
  // 3. Reserve balance (so user can't spend it)
  await supabase.rpc('reserve_wallet_balance', {
    p_user_id: userId,
    p_amount: amount
  })
  
  // 4. Create withdrawal request
  const { data } = await supabase.from('withdrawal_requests').insert({
    user_id: userId,
    amount,
    fee,
    net_amount: netAmount,
    bank_name: bankDetails.bankName,
    iban: bankDetails.iban,
    account_holder: bankDetails.accountHolder,
    status: 'pending'
  }).select().single()
  
  return new Response(JSON.stringify({ 
    requestId: data.id,
    netAmount,
    estimatedTime: '2-3 business days'
  }))
})
```

### 4. `process-withdrawals` - Daily batch job
```typescript
// Cron: Run daily at 16:00 EET
serve(async (req) => {
  // 1. Get all pending withdrawals
  const { data: requests } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })
  
  for (const request of requests) {
    try {
      // 2. Update status
      await supabase.from('withdrawal_requests')
        .update({ status: 'processing', processed_at: new Date().toISOString() })
        .eq('id', request.id)
      
      // 3. Create Stripe payout
      const payout = await stripe.payouts.create({
        amount: Math.round(request.net_amount * 100),
        currency: 'eur',
        method: 'standard', // või 'instant' (kiirem, kallim)
        destination: request.iban, // Requires bank account setup in Stripe
        metadata: {
          user_id: request.user_id,
          request_id: request.id,
        }
      })
      
      // 4. Update DB
      await supabase.from('withdrawal_requests').update({
        stripe_payout_id: payout.id,
        status: 'completed',
        completed_at: new Date().toISOString()
      }).eq('id', request.id)
      
      // 5. Deduct from wallet
      await supabase.rpc('process_withdrawal', {
        p_user_id: request.user_id,
        p_amount: request.amount,
        p_fee: request.fee
      })
      
    } catch (error) {
      // Handle failed payout
      await supabase.from('withdrawal_requests').update({
        status: 'failed',
        failure_reason: error.message,
        retry_count: request.retry_count + 1
      }).eq('id', request.id)
      
      // Unreserve balance
      await supabase.rpc('unreserve_wallet_balance', {
        p_user_id: request.user_id,
        p_amount: request.amount
      })
    }
  }
  
  return new Response(JSON.stringify({ processed: requests.length }))
})
```

### 5. `transfer-fees-to-revenue` - Nightly transfer
```typescript
// Cron: Run daily at 23:30 EET
serve(async (req) => {
  const today = new Date().toISOString().split('T')[0]
  
  // 1. Calculate today's fees
  const { data } = await supabase
    .from('transactions')
    .select('amount')
    .in('transaction_type', ['platform_fee', 'withdrawal_fee'])
    .gte('created_at', `${today}T00:00:00`)
    .lt('created_at', `${today}T23:59:59`)
  
  const totalFees = data.reduce((sum, t) => sum + parseFloat(t.amount), 0)
  
  if (totalFees > 0) {
    // 2. Create Stripe transfer: Operations → Revenue
    const transfer = await stripe.transfers.create({
      amount: Math.round(totalFees * 100),
      currency: 'eur',
      source_transaction: 'operations_account',
      destination: 'revenue_account',
      description: `Daily fees transfer ${today}`
    })
    
    // 3. Log transfer
    await supabase.from('internal_transfers').insert({
      transfer_date: today,
      fees_collected: totalFees,
      total_amount: totalFees,
      stripe_transfer_id: transfer.id,
      status: 'completed',
      completed_at: new Date().toISOString()
    })
  }
  
  return new Response(JSON.stringify({ transferred: totalFees }))
})
```

---

## 📋 IMPLEMENTATION CHECKLIST

### Phase 1: Database Setup
- [ ] Create `withdrawal_requests` table
- [ ] Create `stripe_accounts` table
- [ ] Create `internal_transfers` table
- [ ] Add `reserved` column to `wallets` table
- [ ] Create reconciliation functions
- [ ] Create withdrawal helper functions

### Phase 2: Stripe Setup
- [ ] Create 2nd Stripe account (või use test/live split)
- [ ] Set up bank account for payouts
- [ ] Configure webhook endpoints
- [ ] Test payout API in test mode

### Phase 3: Edge Functions
- [ ] Deploy `wallet-deposit`
- [ ] Deploy `stripe-webhook`
- [ ] Deploy `request-withdrawal`
- [ ] Deploy `process-withdrawals` (cron)
- [ ] Deploy `transfer-fees-to-revenue` (cron)

### Phase 4: Frontend
- [ ] Wallet deposit flow
- [ ] Withdrawal request form (bank details)
- [ ] Withdrawal history page
- [ ] Balance display (available vs reserved)

### Phase 5: Testing
- [ ] Test deposit €10 → check Operations balance
- [ ] Test donation → check fee calculation
- [ ] Test withdrawal → check payout received
- [ ] Test reconciliation → check diff = 0
- [ ] Load test: 100 concurrent deposits

### Phase 6: Monitoring
- [ ] Set up daily reconciliation alerts
- [ ] Monitor failed payouts
- [ ] Track withdrawal processing time
- [ ] Stripe balance dashboard

---

## 💡 KEY ADVANTAGES

| Feature | With Connect (❌) | With 2 Accounts (✅) |
|---------|-------------------|----------------------|
| **Setup Time** | 2-3 weeks | 2-3 days |
| **User Onboarding** | KYC per user | None |
| **Compliance** | Heavy | Light |
| **Stripe Fees** | 2.9% + Connect fee | 1.4% + €0.25 |
| **Control** | Limited | Full |
| **Payouts** | Instant possible | Standard (2-3 days) |
| **Reconciliation** | Complex | Simple |
| **Tax Reporting** | Stripe handles | You handle |

---

## 🚨 IMPORTANT NOTES

### 1. Bank Account Setup
Stripe payouts vajab, et sul oleks seadistatud bank accounts:
```typescript
// Add bank account to Operations account (for payouts)
const bankAccount = await stripe.accounts.createExternalAccount(
  'acct_OPERATIONS_ID',
  {
    external_account: {
      object: 'bank_account',
      country: 'EE',
      currency: 'eur',
      account_holder_name: 'Your Company Name',
      account_holder_type: 'company',
      routing_number: 'SWIFT_CODE',
      account_number: 'IBAN'
    }
  }
)
```

### 2. Payout Timing
- **Standard**: 2-3 tööpäeva, tasuta
- **Instant**: 30 min, +1% fee (max €10)

Soovitan: Standard payouts + process daily at 16:00

### 3. Minimum Amounts
```typescript
const LIMITS = {
  MIN_DEPOSIT: 5.00,      // €5 minimum deposit
  MIN_WITHDRAWAL: 10.00,  // €10 minimum withdrawal
  WITHDRAWAL_FEE: 0.02,   // 2% fee
}
```

### 4. Reserve for Failed Payouts
Mõned payoutid võivad failida (vale IBAN, insufficient funds):
- Raha jääb `reserved` staatusesse
- User saab teavituse
- Saab retry või cancel withdrawal

---

## ✅ NEXT STEPS

Kas see arhitektuur sobib? See on:
- ✅ **Lihtsam** kui Connect
- ✅ **Odavam** (vähem fees)
- ✅ **Kiirem** implementeerida
- ✅ **Piisavalt turvaline**
- ✅ **Skaleeruv** kuni 10,000+ kasutajani

Alustan implementeerimist? 🚀
