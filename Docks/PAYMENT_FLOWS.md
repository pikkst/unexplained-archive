# 💳 Payment Flows - Unexplained Archive

## 📊 Overview

The platform supports **4 payment flows**:

| Flow | Method | Source | Destination | Fee | Purpose |
|------|--------|--------|-------------|-----|---------|
| **Wallet Deposit** | 💳 Stripe | Bank | User Wallet | 0% | Add funds to wallet |
| **Case Donation (Stripe)** | 💳 Stripe | Bank | Case Escrow | 10% | Support case investigation |
| **Platform Donation (Stripe)** | 💳 Stripe | Bank | Platform | 0% | Support platform development |
| **Wallet Donation** | 💰 Wallet | User Wallet | Case/Platform | 0% | Internal transfer |

---

## 1️⃣ Wallet Deposit Flow

**Purpose:** User adds money to their wallet balance using a credit card.

```
USER clicks "Deposit Funds"
    ↓
Frontend calls stripeService.createDepositCheckout(amount, userId)
    ↓
Edge Function: create-deposit-checkout
    → Creates Stripe Checkout Session
    → Amount: €100
    → Metadata: { type: 'wallet_deposit', userId, amount }
    ↓
User pays on Stripe Checkout
    ↓
Stripe webhook: checkout.session.completed
    ↓
Edge Function: stripe-webhook
    → Detects type === 'wallet_deposit'
    → Calls: add_wallet_balance(userId, amount)
    ↓
Database:
    ✅ wallets.balance += €100
    ✅ transactions: { type: 'deposit', amount: 100, status: 'completed' }
    ↓
Result: User wallet = +€100
        Stripe account = +€100
```

**Key Points:**
- ✅ **0% platform fee** - Full amount goes to user wallet
- ✅ Direct to Operations Stripe account
- ✅ User can withdraw later (with withdrawal fee)

---

## 2️⃣ Case Donation via Stripe

**Purpose:** User donates to a specific case's reward pool using a credit card.

```
USER clicks "Donate €50 to Case"
    ↓
Frontend calls stripeService.createDonationPayment(caseId, amount, userId)
    ↓
Edge Function: create-escrow-payment-checkout
    → Validates case exists and is active
    → Calculates fees:
        Platform Fee: €5 (10%)
        Net Amount: €45
    → Creates Stripe Checkout Session
    → Metadata: { type: 'donation', caseId, amount: 50, platformFee: 5, netAmount: 45 }
    ↓
User pays on Stripe Checkout
    ↓
Stripe webhook: checkout.session.completed
    ↓
Edge Function: stripe-webhook
    → Detects type === 'donation' && caseId !== 'platform'
    → Calls: increment_case_escrow(caseId, netAmount: 45)
    → Records platform fee: €5
    ↓
Database:
    ✅ cases.reward += €45 (shown to users)
    ✅ case_escrow.locked_amount += €45 (held until resolved)
    ✅ transactions: { type: 'donation', case_id, amount: 50, status: 'completed' }
    ✅ platform_revenue: { amount: 5, type: 'donation' }
    ↓
Result: Case reward pool = +€45 (net)
        Platform revenue = +€5 (fee)
        Stripe account = +€50 (total)
```

**Key Points:**
- ✅ **10% platform fee** - Platform earns €5 per €50 donation
- ✅ Net amount goes to case escrow (locked until resolved)
- ✅ Money released when case is resolved
- ✅ Platform provides infrastructure, moderation, dispute resolution

**Why 10% fee?**
- Infrastructure costs (servers, database, CDN)
- Payment processing overhead
- Moderation and support
- Dispute resolution services
- Platform development

---

## 3️⃣ Platform Donation via Stripe

**Purpose:** User donates directly to support platform development using a credit card.

```
USER clicks "Support Platform - €50"
    ↓
Frontend calls stripeService.createDonationPayment('platform', amount, userId)
    ↓
Edge Function: create-escrow-payment-checkout
    → Detects caseId === 'platform'
    → Platform donation: 0% fee
    → Net Amount: €50 (full amount)
    → Metadata: { type: 'donation', caseId: 'platform', amount: 50, platformFee: 0, netAmount: 50 }
    ↓
User pays on Stripe Checkout
    ↓
Stripe webhook: checkout.session.completed
    ↓
Edge Function: stripe-webhook
    → Detects type === 'donation' && caseId === 'platform'
    → Records full amount as platform revenue
    ↓
Database:
    ✅ transactions: { type: 'platform_donation', amount: 50, status: 'completed' }
    ✅ platform_revenue: { amount: 50, type: 'platform_donation' }
    ↓
Result: Platform revenue = +€50 (full amount)
        Stripe account = +€50
```

**Key Points:**
- ✅ **0% platform fee** - ALL money goes to platform
- ✅ Direct support for development
- ✅ No middleman - full donation to platform
- ✅ Used for: hosting, development, features, support

**Why 0% fee?**
- This IS platform revenue - no need for fee
- Direct support from community
- Encourages platform donations
- Transparent funding model

---

## 4️⃣ Wallet Donations (Internal Transfers)

**Purpose:** User donates from their wallet balance to a case or platform.

### 4a. Wallet → Case Donation

```
USER clicks "Donate from Wallet - €50"
    ↓
Frontend calls walletService.donateToCase(userId, caseId, amount)
    ↓
Database RPC: donate_from_wallet(userId, caseId, amount)
    → Checks wallet balance >= amount
    → Deducts from user wallet
    → Adds to case reward (NO FEE)
    ↓
Database:
    ✅ wallets.balance -= €50
    ✅ cases.reward += €50 (full amount!)
    ✅ transactions: { type: 'wallet_donation', from_wallet_id, case_id, amount: 50 }
    ↓
Result: User wallet = -€50
        Case reward = +€50 (full amount, no fee)
        Stripe account = unchanged
```

**Key Points:**
- ✅ **0% fee** - Full amount to case
- ✅ Internal transfer (no Stripe involved)
- ✅ Instant transaction
- ✅ No payment processing costs

### 4b. Wallet → Platform Donation

```
USER clicks "Support Platform from Wallet - €50"
    ↓
Frontend calls supabase.rpc('process_platform_donation', { userId, amount })
    ↓
Database RPC: process_platform_donation(userId, amount)
    → Checks wallet balance >= amount
    → Deducts from user wallet
    → Records as platform revenue
    ↓
Database:
    ✅ wallets.balance -= €50
    ✅ transactions: { type: 'platform_wallet_donation', from_wallet_id, amount: 50 }
    ✅ platform_revenue: { amount: 50, type: 'wallet_donation' }
    ↓
Result: User wallet = -€50
        Platform revenue = +€50
        Stripe account = unchanged
```

**Key Points:**
- ✅ **0% fee** - Full amount to platform
- ✅ Internal transfer
- ✅ User already paid Stripe fee on deposit
- ✅ No double-charging

---

## 🔑 Fee Comparison

| Payment Type | Fee | Reason |
|--------------|-----|--------|
| **Wallet Deposit** | 0% | User is loading their own money |
| **Case Donation (Stripe)** | 10% | Platform provides services |
| **Platform Donation (Stripe)** | **0%** | Direct platform support |
| **Wallet → Case** | 0% | Internal, no processing cost |
| **Wallet → Platform** | 0% | Internal, fee already paid on deposit |

### 💡 Philosophy:

1. **Platform donations get 0% fee** because:
   - Money goes directly to platform development
   - No intermediary service
   - Encourages platform support
   - Transparent funding

2. **Case donations get 10% fee** because:
   - Platform provides infrastructure
   - Moderation and dispute resolution
   - Escrow management
   - Payment security
   - Community tools

3. **Wallet transfers get 0% fee** because:
   - Internal database operation
   - No Stripe processing
   - User already paid fee on deposit
   - Encourages wallet usage

---

## 💰 Stripe Account Balance

**What's in your Stripe account:**

```
Stripe Balance = 
    All Wallet Deposits
  + All Case Donations (full amount)
  + All Platform Donations (full amount)
  - All Withdrawals
```

**User wallet balances (in database):**

```
Total User Wallets = SUM(wallets.balance)
```

**Locked in case escrows:**

```
Total Locked = SUM(case_escrow.locked_amount)
```

**Platform revenue:**

```
Platform Revenue = 
    10% of Case Donations (Stripe)
  + 0% of Platform Donations (Stripe) = 100%
  + 0% of Wallet donations
```

---

## ⚠️ Important Notes

### Money Flow Rules:

1. **Stripe → Wallet Deposit:**
   - Full amount to user wallet
   - User can withdraw later (with fee)

2. **Stripe → Case Donation:**
   - 90% to case escrow (locked)
   - 10% to platform revenue
   - Released when case resolved

3. **Stripe → Platform Donation:**
   - 100% to platform revenue
   - Immediate, not locked

4. **Wallet → Any:**
   - 100% to destination
   - No fees, internal transfer

### Edge Cases:

- If user deposits €100 then donates €50 to case from wallet:
  - Stripe has €100
  - User wallet has €50
  - Case gets €50 (no fee)
  - Platform earned nothing from this donation

- If user donates €50 to case via Stripe:
  - Stripe has €50
  - Case gets €45
  - Platform earns €5

### Withdrawal:

- Users can withdraw wallet balance
- Withdrawal fee: €2 + 2% (covers Stripe payout fee)
- Minimum withdrawal: €50

---

## 🎯 Recommendations

### For Users:

- **Support platform directly?** → Use "Platform Donation" (0% fee, 100% to platform)
- **Support specific case?** → Use Stripe donation if you want to contribute with fees, OR deposit to wallet then donate (0% fee)
- **Need wallet funds?** → Use "Wallet Deposit"

### For Platform:

1. **Monitor escrow balance** - Ensure Stripe balance >= locked escrow
2. **Track platform revenue** - 10% from case donations + 100% from platform donations
3. **Escrow release** - Automate or manual release when cases resolved

---

## 📊 Example Scenarios

### Scenario 1: User wants to support platform

**Option A: Stripe Donation**
- User pays €50
- Platform gets €50 (0% fee)
- ✅ Best for one-time platform support

**Option B: Wallet then donate**
- User deposits €50 to wallet (0% fee)
- User donates €50 to platform from wallet (0% fee)
- Platform gets €50
- ✅ Same result, more steps

### Scenario 2: User wants to support a case

**Option A: Stripe Donation**
- User pays €50
- Case gets €45 (10% fee)
- Platform gets €5
- ✅ Quick, one-time donation

**Option B: Wallet deposit then donate**
- User deposits €50 to wallet (0% fee)
- User donates €50 to case from wallet (0% fee)
- Case gets €50 (full amount!)
- Platform gets €0 from this
- ✅ Better for case, but platform earns nothing

### Scenario 3: Investigator earns reward

- Case is solved
- Reward pool: €200
- Released from escrow
- Transferred to investigator wallet
- Investigator withdraws: €200 - (€2 + 2%) = €194 received

---

## 🔐 Security & Compliance

- All Stripe payments are PCI-compliant
- Webhook signature verification required
- Escrow funds are locked until case resolution
- All transactions logged with timestamps
- Stripe provides dispute resolution
- Platform never stores card details

---

**Last Updated:** 2025-12-14  
**Version:** 2.0
