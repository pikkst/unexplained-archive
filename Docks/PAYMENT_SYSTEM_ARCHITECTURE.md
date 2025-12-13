# Payment System Architecture - Unexplained Archive

## 🎯 Rahavoo Loogika (ESCROW Süsteem)

### Põhimõte
**Kõik maksed lähevad ESCROW'sse** - hoitakse platformi wallet'is kuni lahendus on kinnitatud.
**Kolm võimalust raha vabastamiseks:**
1. ✅ Kasutaja kinnitab lahenduse → Raha läheb investigaatorile
2. ❌ Kasutaja lükkab tagasi → Admin review või kogukonna hääletamine
3. ⏱️ Timeout (90 päeva) → Automaatne tagasimakse

---

## 💳 ESCROW Voog

### Donation Flow (ESCROW):
```
Kasutaja → Stripe Payment → Platform Wallet (ESCROW) → 
Case Reward Pool (näidatakse, aga held) →
[Resolution] →
├─ Approved → Investigaatori Wallet (-15% fee)
├─ Rejected → Admin Review
│   ├─ Admin Approves → Investigaatori Wallet
│   ├─ Admin Refunds → Tagasi kasutajale (-5% handling fee)
│   └─ Community Vote (7 päeva) → Majority decision
└─ Timeout → Auto-refund (-5% handling fee)
```

---

## 💳 Maksevood

### 1. **DONATSIOONID (Juhtumitele)**

#### Stsenaarium:
Kasutaja tahab lisada juhtumile preemiaraha.

#### Protsess:
```
Kasutaja → Klikkib "Donate €20" → Stripe Payment Modal →
Makse edukas → Raha läheb otse juhtumi reward pool'i →
Platform Fee (10%) → Ülejääk jääb escrow'sse
```

#### Implementatsioon:
- **Frontend**: Donation nupp avab Stripe Checkout
- **Backend**: Supabase Edge Function loob Payment Intent
- **Database**: 
  - `transactions` tabel: `type='donation', status='completed'`
  - `cases` tabel: `reward` field suureneb
  - Platform võtab 10% tasu

#### Kood:
```typescript
// Kasutaja klikib "Donate"
const handleDonate = async (caseId: string, amount: number) => {
  // Loome Stripe sessiooni ILMA wallet'ita
  const { data } = await supabase.functions.invoke('create-donation-session', {
    body: { caseId, amount }
  });
  
  // Suuname Stripe Checkout'i
  window.location.href = data.checkoutUrl;
};
```

---

### 2. **TELLIMUSED (Subscriptions)**

#### Stsenaarium:
Investigaator tahab upgrade'ida PRO'ks või kasutaja tahab erifunktsioone.

#### Maksevood:
- **Investigator PRO**: €29.99/kuu
  - Unlimited AI generations
  - Priority case assignment
  - Advanced analytics
  - Translation tools (tasuta)

- **User PREMIUM**: €9.99/kuu
  - Unlimited AI image generations
  - Early access to features
  - Ad-free experience

#### Protsess:
```
Kasutaja → Vali plaan → Stripe Checkout (recurring) →
Edukas → Subscription aktiveerimine DB's →
Igakuine auto-renewal Stripe Webhook'iga
```

#### Implementatsioon:
- **Frontend**: Subscription Plans page
- **Backend**: Stripe Subscription API + Webhooks
- **Database**: `subscriptions` tabel koos `stripe_subscription_id`

#### Kood:
```typescript
// Kasutaja valib plaani
const handleSubscribe = async (planId: string) => {
  const { data } = await supabase.functions.invoke('create-subscription-session', {
    body: { 
      userId: user.id,
      planId, // 'investigator_pro' või 'user_premium'
      priceId: 'price_xxx' // Stripe Price ID
    }
  });
  
  window.location.href = data.checkoutUrl;
};
```

---

### 3. **INVESTIGAATORI TASUD (Payouts via ESCROW)**

#### Stsenaarium 1: Kasutaja Kinnitab Lahenduse ✅
```
Case RESOLVED → Kasutaja vaatab lahendust → 
Klikkib "Accept & Rate" → 
ESCROW vabastatakse → Reward - 15% fee → Investigaatori Wallet →
Case status: CLOSED
```

**Database Flow:**
```sql
-- Kasutaja kinnitab
SELECT release_escrow_to_investigator(case_id, submitter_id);

-- Automaatselt:
-- 1. Platform wallet balance -= reward
-- 2. Investigator wallet balance += (reward * 0.85)
-- 3. Platform fee recorded (15%)
-- 4. Case status → CLOSED
-- 5. Transactions marked as 'released'
```

#### Stsenaarium 2: Kasutaja Lükkab Tagasi ❌
```
Case RESOLVED → Kasutaja vaatab lahendust →
Klikkib "Reject & Request More Info" →
Case status: DISPUTED → Admin saab notification
```

**Admin Options:**
1. **Approve Resolution** (investigaator oli õigus):
   ```sql
   SELECT admin_resolve_dispute_release(case_id, admin_id, 'Admin reviewed and approved');
   -- Result: Same as user approval
   ```

2. **Refund Submitter** (investigaator ei teinud tööd korralikult):
   ```sql
   SELECT admin_resolve_dispute_refund(case_id, admin_id, 'Work not satisfactory');
   -- Result: 
   -- - Refund 95% to submitter (5% handling fee)
   -- - Investigator reputation -50
   -- - Case CLOSED
   ```

3. **Send to Community Vote** (admin ei ole kindel):
   ```sql
   SELECT send_case_to_community_vote(case_id, admin_id, 7);
   -- Result:
   -- - Case status: VOTING
   -- - 7-day voting period
   -- - Community decides
   ```

#### Stsenaarium 3: Kogukonna Hääletamine 🗳️
```
DISPUTED → Admin sends to vote →
Community members vote (7 days) →
├─ >50% For Investigator → Release escrow
└─ >50% For Refund → Refund submitter + penalty investigator
```

**Voting Process:**
```sql
-- User casts vote
SELECT cast_community_vote(case_id, voter_id, 'investigator'); -- or 'refund'

-- After 7 days (automated or manual trigger)
SELECT finalize_community_vote(case_id);
-- Counts votes and executes decision
```

#### Stsenaarium 4: Timeout (90 päeva) ⏱️
```
Case created → 90 days pass → No resolution →
Auto-refund to submitter (95%) →
Case CLOSED
```
```

---

### 4. **TAGASIMAKSED (Refunds)**

#### Stsenaarium 1: Juhtumit ei lahенdata
```
Case deadline ületatud → Automaatne refund donoritele →
Platform säilitab 5% handling fee
```

#### Stsenaarium 2: Vaidlustamine (Dispute)
```
Kasutaja ei ole rahul → Dispute → Community voting →
Kui community nõustub → Partial refund (50-100%)
```

#### Implementatsioon:
```typescript
// Automaatne refund expired cases jaoks
CREATE OR REPLACE FUNCTION auto_refund_expired_cases()
RETURNS void AS $$
BEGIN
  -- Find expired unresolved cases
  FOR case_record IN 
    SELECT * FROM cases 
    WHERE status IN ('OPEN', 'INVESTIGATING')
    AND created_at < NOW() - INTERVAL '90 days'
  LOOP
    -- Refund donors (95% - 5% handling fee)
    INSERT INTO transactions (
      type, amount, case_id, status
    )
    SELECT 
      'refund',
      amount * 0.95,
      case_record.id,
      'pending'
    FROM transactions
    WHERE case_id = case_record.id 
    AND type = 'donation';
    
    -- Close case
    UPDATE cases SET status = 'CLOSED' WHERE id = case_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

---

### 5. **WALLET DEPOSITS (Ainult Investigaatorid)**

#### Stsenaarium:
Investigaator tahab oma wallet'ist välja võtta raha.

#### Miinimumid:
- Min withdrawal: €50
- Max withdrawal/päevas: €1000
- Processing time: 3-5 tööpäeva

#### Protsess:
```
Investigaator → Taotleb withdrawal →
Admin kinnitab (või automaatne kui verifitseeritud) →
Stripe Connect payout → Bank account
```

#### KYC Requirements:
- Peab olema verified investigator
- Esitatud ID verification
- Bank account connected via Stripe

---

## 🏗️ Database Schema Updates

### Platform Wallet (ESCROW)
```sql
-- Platform wallet with fixed UUID
INSERT INTO wallets (id, user_id, balance)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  (admin_user_id),
  0
);
```

### Transactions Tabel (Extended)
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL, -- 'donation', 'case_reward', 'refund', 'platform_fee', 'vote', 'dispute'
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  
  -- Stripe references
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  stripe_refund_id TEXT,
  stripe_session_id TEXT,
  
  -- Escrow tracking
  escrow_status TEXT, -- 'held', 'released', 'refunded'
  
  -- Internal references
  user_id UUID REFERENCES profiles(id),
  case_id UUID REFERENCES cases(id),
  to_wallet_id UUID REFERENCES wallets(id),
  from_wallet_id UUID REFERENCES wallets(id),
  
  status TEXT DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Cases Tabel Metadata Extensions
```sql
-- Cases now track escrow and dispute status
UPDATE cases SET metadata = '{
  "escrow_status": "held",
  "awaiting_submitter_approval": true,
  "resolved_at": "2025-12-05T12:00:00Z",
  
  -- If disputed:
  "dispute_raised_at": "2025-12-05T14:00:00Z",
  "dispute_raised_by": "user_uuid",
  "rejection_reason": "Text...",
  "awaiting_admin_review": true,
  
  -- If voting:
  "voting_started_at": "2025-12-05T15:00:00Z",
  "voting_ends_at": "2025-12-12T15:00:00Z",
  "votes_for_investigator": 42,
  "votes_for_refund": 18,
  
  -- Final resolution:
  "admin_resolved_by": "admin_uuid",
  "resolution_decision": "approved", // or "refunded"
  "investigator_penalized": false
}';
```

### Subscriptions Tabel
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) UNIQUE,
  plan_type TEXT NOT NULL, -- 'investigator_pro', 'user_premium'
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  
  status TEXT DEFAULT 'active', -- 'active', 'canceled', 'past_due'
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Wallets Tabel (Ainult Investigaatorid)
```sql
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) UNIQUE,
  balance DECIMAL(10,2) DEFAULT 0 CHECK (balance >= 0),
  
  -- Stripe Connect
  stripe_account_id TEXT, -- For payouts
  stripe_account_verified BOOLEAN DEFAULT false,
  
  -- Limits
  total_earned DECIMAL(10,2) DEFAULT 0,
  total_withdrawn DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only investigators can have wallets
ALTER TABLE wallets ADD CONSTRAINT wallets_investigator_only 
CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = user_id 
    AND profiles.role IN ('investigator', 'admin')
  )
);
```

---

## 🔒 Platform Fees

| Transaction Type | Platform Fee | Notes |
|-----------------|--------------|--------|
| Donations | 10% | Võetakse kohe donation'ist |
| Case Resolution | 15% | Võetakse investigaatori tasust |
| Subscriptions | 0% | Täielik tulu platformile |
| Refunds | 5% handling fee | Ei tagastata täismahus |
| Withdrawals | €2 + 2% | Processing fee |

---

## 🚀 Implementation Priority

### Phase 1: Core Payment Flow (1 nädal)
1. ✅ Stripe Checkout donatsioonide jaoks
2. ✅ Direct payment (ei vaja wallet'i)
3. ✅ Case reward pool update
4. ✅ Platform fee calculation

### Phase 2: Subscriptions (1 nädal)
1. ✅ Subscription plans UI
2. ✅ Stripe Subscriptions integration
3. ✅ Webhook handlers (subscription events)
4. ✅ Feature access control based on subscription

### Phase 3: Investigator Payouts (1 nädal)
1. ✅ Wallet system investigaatoritele
2. ✅ Auto-payout case resolution'il
3. ✅ Withdrawal requests
4. ✅ Stripe Connect setup

### Phase 4: Refunds & Disputes (1 nädal)
1. ✅ Auto-refund expired cases
2. ✅ Dispute resolution flow
3. ✅ Community voting integration
4. ✅ Partial refunds

---

## 📊 Revenue Model

### Monthly Recurring Revenue (MRR)
- Investigator PRO: €29.99 × N subscribers
- User PREMIUM: €9.99 × M subscribers

### Transaction Fees
- Donation fees: 10% of all donations
- Case resolution fees: 15% of investigator payouts

### Example Calculation:
```
Monthly Stats:
- 100 Investigator PRO: €2,999
- 500 User PREMIUM: €4,995
- €10,000 donations → €1,000 fee
- €5,000 payouts → €750 fee

Total Monthly Revenue: €9,744
```

---

## 🔐 Security & Compliance

### PCI DSS Compliance
- ✅ Stripe handles all card data
- ✅ No card numbers stored in database
- ✅ Stripe Checkout + webhooks

### Anti-Fraud
- Rate limiting donations (max 5/day per user)
- Suspicious activity detection
- Manual review for withdrawals >€500

### Data Protection (GDPR)
- User can delete account → refund pending transactions
- Transaction history retained for 7 years (legal requirement)
- Payment data encryption at rest

---

Koostatud: 2025-12-05
Platform: Unexplained Archive
Payment Provider: Stripe
