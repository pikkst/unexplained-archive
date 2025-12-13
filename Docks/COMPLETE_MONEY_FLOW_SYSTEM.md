# 💰 TÄIELIK RAHAVOO SÜSTEEM
## Selge, Hallatav, Kasumlik

---

## 🎯 PÕHIMÕTTED

1. **Kasutajale mugav** - lihtne mõista, õiglased tasud
2. **Serverile hallatav** - automaatne, skaleeruv, reconciliation
3. **Omanikule selge** - kasum vs operations täiesti eraldi

---

## 💵 TASUDE STRUKTUUR (Revised)

### Platform Fees
```typescript
const FEES = {
  // Deposits (wallet funding)
  DEPOSIT_FEE: 0.00,           // 0% - tasuta (Stripe fees kanname ise)
  
  // Case donations
  CASE_DONATION_FEE: 0.10,     // 10% platform fee
  
  // Escrow release
  ESCROW_RELEASE_FEE: 0.10,    // 10% investigatorile makstakse 90%
  
  // Withdrawals
  WITHDRAWAL_FEE_PERCENT: 0.02, // 2%
  WITHDRAWAL_FEE_MIN: 1.00,     // min €1
  WITHDRAWAL_FEE_MAX: 10.00,    // max €10
  
  // Platform donations
  PLATFORM_DONATION_FEE: 0.00,  // 0% - 100% läheb platvormile
  
  // Minimums
  MIN_DEPOSIT: 5.00,
  MIN_WITHDRAWAL: 10.00,
  MIN_CASE_DONATION: 1.00,
  MIN_PLATFORM_DONATION: 1.00,
}
```

---

## 📊 KÕIK RAHAVOOD (Complete Flow Chart)

### FLOW 1: Kasutaja lisab raha (Deposit)

```
┌──────────────────────────────────────────────┐
│  KASUTAJA                                     │
│  Krediitkaart: €100                          │
└───────────────────┬──────────────────────────┘
                    │
                    │ Stripe Checkout
                    ▼
┌──────────────────────────────────────────────┐
│  STRIPE PAYMENT                               │
│  Amount: €100                                 │
│  Stripe fee: €1.65 (1.4% + €0.25)           │
│  Net: €98.35                                  │
└───────────────────┬──────────────────────────┘
                    │
                    │ Webhook: checkout.session.completed
                    ▼
┌──────────────────────────────────────────────┐
│  OPERATIONS ACCOUNT                           │
│  Balance: +€98.35                             │
│                                               │
│  DB Updates:                                  │
│    wallets.balance: +€100                    │ ← Kasutaja näeb €100
│    platform_costs: +€1.65                    │ ← Stripe fee (cost)
│    transactions:                              │
│      - type: 'deposit'                       │
│      - amount: €100                          │
│      - stripe_fee: €1.65                     │
└──────────────────────────────────────────────┘

TULEMUS:
✅ Kasutaja wallet: +€100 (täiskaetud)
✅ Operations kontol: €98.35 (real money)
✅ Platform cost: €1.65 (Stripe fee)
```

### FLOW 2: Kasutaja dooneerib case'ile rahakotist

```
┌──────────────────────────────────────────────┐
│  KASUTAJA                                     │
│  Wallet: €100                                 │
│  Dooneerib case'ile: €50                     │
└───────────────────┬──────────────────────────┘
                    │
                    │ DB Transaction (instant)
                    ▼
┌──────────────────────────────────────────────┐
│  DATABASE TRANSACTION                         │
│                                               │
│  BEGIN;                                       │
│    -- Deduct from user wallet                │
│    wallets.balance: €100 → €50               │
│                                               │
│    -- Add to case escrow (90%)               │
│    case_escrow: +€45                         │
│                                               │
│    -- Platform fee (10%)                     │
│    platform_revenue: +€5                     │
│                                               │
│    -- Log transaction                        │
│    transactions:                              │
│      - user_id: donor                        │
│      - type: 'case_donation'                 │
│      - amount: €50                           │
│      - fee: €5                               │
│      - net: €45                              │
│      - case_id: xxx                          │
│  COMMIT;                                      │
└───────────────────┬──────────────────────────┘
                    │
                    │ Nightly batch (23:30)
                    ▼
┌──────────────────────────────────────────────┐
│  STRIPE INTERNAL TRANSFER                     │
│  Operations → Revenue: €5                    │
└──────────────────────────────────────────────┘

TULEMUS:
✅ Kasutaja wallet: €100 → €50
✅ Case escrow: +€45 (locked until resolved)
✅ Platform revenue: +€5 (10% fee)
✅ NO Stripe API call (instant!)
✅ Operations balance: unchanged (€98.35)
```

### FLOW 3: Case lahendatud → Investigator saab raha

```
┌──────────────────────────────────────────────┐
│  ADMIN/AUTO                                   │
│  Märgib case status = 'resolved'            │
└───────────────────┬──────────────────────────┘
                    │
                    │ Trigger: on_case_resolved()
                    ▼
┌──────────────────────────────────────────────┐
│  DATABASE TRANSACTION                         │
│                                               │
│  BEGIN;                                       │
│    -- Get escrow amount                      │
│    escrow_amount = €45                       │
│                                               │
│    -- Calculate split (investigator gets 90%)│
│    investigator_share = €40.50 (90%)         │
│    platform_share = €4.50 (10%)              │
│                                               │
│    -- Release escrow                         │
│    case_escrow: €45 → €0                     │
│                                               │
│    -- Add to investigator wallet             │
│    investigator_wallet: +€40.50              │
│                                               │
│    -- Platform revenue                       │
│    platform_revenue: +€4.50                  │
│                                               │
│    -- Log transaction                        │
│    transactions:                              │
│      - type: 'escrow_release'                │
│      - investigator_id: xxx                  │
│      - amount: €45                           │
│      - investigator_share: €40.50            │
│      - platform_fee: €4.50                   │
│      - case_id: xxx                          │
│  COMMIT;                                      │
└───────────────────┬──────────────────────────┘
                    │
                    │ Notification
                    ▼
┌──────────────────────────────────────────────┐
│  INVESTIGATOR                                 │
│  Wallet: +€40.50                              │
│  "Case solved! €40.50 added to your wallet" │
└──────────────────────────────────────────────┘

TULEMUS:
✅ Investigator wallet: +€40.50 (can withdraw või donate)
✅ Platform revenue: +€4.50 (10% release fee)
✅ Total platform revenue from this case: €5 + €4.50 = €9.50 (19% of €50)
```

### FLOW 4: Platform donation (rahakotist)

```
┌──────────────────────────────────────────────┐
│  KASUTAJA                                     │
│  Wallet: €50                                  │
│  Annetab platvormile: €20                    │
└───────────────────┬──────────────────────────┘
                    │
                    │ DB Transaction
                    ▼
┌──────────────────────────────────────────────┐
│  DATABASE TRANSACTION                         │
│                                               │
│  BEGIN;                                       │
│    wallets.balance: €50 → €30                │
│    platform_revenue: +€20                    │
│                                               │
│    transactions:                              │
│      - type: 'platform_donation'             │
│      - amount: €20                           │
│      - fee: €0                               │ ← 0% fee!
│  COMMIT;                                      │
└───────────────────┬──────────────────────────┘
                    │
                    │ Nightly batch
                    ▼
┌──────────────────────────────────────────────┐
│  STRIPE INTERNAL TRANSFER                     │
│  Operations → Revenue: €20                   │
└──────────────────────────────────────────────┘

TULEMUS:
✅ Kasutaja wallet: €50 → €30
✅ Platform revenue: +€20 (100%!)
✅ Operations balance: -€20 (reserved for platform)
```

### FLOW 5: Investigator võtab raha välja

```
┌──────────────────────────────────────────────┐
│  INVESTIGATOR                                 │
│  Wallet: €200                                 │
│  Withdrawal request: €150                    │
└───────────────────┬──────────────────────────┘
                    │
                    │ Request withdrawal
                    ▼
┌──────────────────────────────────────────────┐
│  WITHDRAWAL CALCULATION                       │
│                                               │
│  Amount: €150                                 │
│  Fee (2%): €3                                │
│  Net payout: €147                             │
└───────────────────┬──────────────────────────┘
                    │
                    │ Reserve balance
                    ▼
┌──────────────────────────────────────────────┐
│  DATABASE                                     │
│                                               │
│  wallets.balance: €200 → €50                 │
│  wallets.reserved: €0 → €150                 │
│                                               │
│  withdrawal_requests:                         │
│    - status: 'pending'                       │
│    - amount: €150                            │
│    - fee: €3                                 │
│    - net: €147                               │
│    - iban: EE123...                          │
└───────────────────┬──────────────────────────┘
                    │
                    │ Daily batch (16:00)
                    ▼
┌──────────────────────────────────────────────┐
│  STRIPE PAYOUT                                │
│                                               │
│  stripe.payouts.create({                     │
│    amount: 14700, // €147                    │
│    destination: bank_account                 │
│  })                                           │
│                                               │
│  Operations account: -€150                   │
└───────────────────┬──────────────────────────┘
                    │
                    │ Payout completed (2-3 days)
                    ▼
┌──────────────────────────────────────────────┐
│  INVESTIGATOR BANK                            │
│  Balance: +€147                               │
│                                               │
│  DB Update:                                   │
│    wallets.reserved: €150 → €0               │
│    platform_revenue: +€3                     │ ← Withdrawal fee
│                                               │
│    transactions:                              │
│      - type: 'withdrawal'                    │
│      - amount: €150                          │
│      - fee: €3                               │
│      - net: €147                             │
└──────────────────────────────────────────────┘

TULEMUS:
✅ Investigator bank: +€147
✅ Platform revenue: +€3 (2% withdrawal fee)
✅ Operations balance: -€150
```

### FLOW 6: Direct platform donation (uus raha)

```
┌──────────────────────────────────────────────┐
│  KASUTAJA                                     │
│  Krediitkaart: €50                           │
│  Annetab platvormile                         │
└───────────────────┬──────────────────────────┘
                    │
                    │ Stripe Checkout
                    ▼
┌──────────────────────────────────────────────┐
│  STRIPE PAYMENT                               │
│  Amount: €50                                  │
│  Stripe fee: €0.95 (1.4% + €0.25)           │
│  Net: €49.05                                  │
└───────────────────┬──────────────────────────┘
                    │
                    │ Payment to REVENUE account (directly!)
                    ▼
┌──────────────────────────────────────────────┐
│  REVENUE ACCOUNT                              │
│  Balance: +€49.05                             │
│                                               │
│  DB Updates:                                  │
│    platform_revenue: +€50                    │
│    platform_costs: +€0.95                    │ ← Stripe fee
│                                               │
│    transactions:                              │
│      - type: 'direct_platform_donation'      │
│      - amount: €50                           │
│      - stripe_fee: €0.95                     │
└──────────────────────────────────────────────┘

TULEMUS:
✅ Revenue account: +€49.05 (real money)
✅ Platform revenue: +€50 (accounting)
✅ Platform cost: €0.95 (Stripe fee)
✅ NO wallet involved (direct to revenue)
```

---

## 💼 BALANCE TRACKING

### Operations Account (Kasutajate raha)
```sql
CREATE OR REPLACE FUNCTION calculate_operations_balance()
RETURNS TABLE(
  total_wallets DECIMAL(10,2),
  total_escrow DECIMAL(10,2),
  total_reserved DECIMAL(10,2),
  expected_balance DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- All user wallet balances
    (SELECT COALESCE(SUM(balance), 0) FROM wallets),
    
    -- All active case escrows
    (SELECT COALESCE(SUM(amount), 0) FROM case_escrow WHERE status = 'active'),
    
    -- All pending withdrawals
    (SELECT COALESCE(SUM(amount), 0) FROM withdrawal_requests 
     WHERE status IN ('pending', 'processing')),
    
    -- Total = wallets + escrow + reserved
    (SELECT COALESCE(SUM(balance), 0) FROM wallets) +
    (SELECT COALESCE(SUM(amount), 0) FROM case_escrow WHERE status = 'active') +
    (SELECT COALESCE(SUM(amount), 0) FROM withdrawal_requests 
     WHERE status IN ('pending', 'processing'));
END;
$$ LANGUAGE plpgsql;
```

### Revenue Account (Platform kasum)
```sql
CREATE OR REPLACE FUNCTION calculate_revenue_balance()
RETURNS TABLE(
  case_fees DECIMAL(10,2),
  release_fees DECIMAL(10,2),
  withdrawal_fees DECIMAL(10,2),
  platform_donations DECIMAL(10,2),
  direct_donations DECIMAL(10,2),
  total_revenue DECIMAL(10,2),
  total_costs DECIMAL(10,2),
  net_profit DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- Case donation fees (10%)
    (SELECT COALESCE(SUM(amount * 0.10), 0) 
     FROM transactions 
     WHERE transaction_type = 'case_donation'),
    
    -- Escrow release fees (10%)
    (SELECT COALESCE(SUM(amount * 0.10), 0) 
     FROM transactions 
     WHERE transaction_type = 'escrow_release'),
    
    -- Withdrawal fees (2%)
    (SELECT COALESCE(SUM(fee), 0) 
     FROM withdrawal_requests 
     WHERE status = 'completed'),
    
    -- Platform donations from wallets
    (SELECT COALESCE(SUM(amount), 0) 
     FROM transactions 
     WHERE transaction_type = 'platform_donation'),
    
    -- Direct platform donations (credit card)
    (SELECT COALESCE(SUM(amount), 0) 
     FROM transactions 
     WHERE transaction_type = 'direct_platform_donation'),
    
    -- Total revenue
    (SELECT COALESCE(SUM(amount), 0) 
     FROM transactions 
     WHERE transaction_type IN ('platform_fee', 'withdrawal_fee', 
                                'platform_donation', 'direct_platform_donation')),
    
    -- Total Stripe costs
    (SELECT COALESCE(SUM(stripe_fee), 0) 
     FROM transactions 
     WHERE stripe_fee > 0),
    
    -- Net profit = revenue - costs
    (SELECT COALESCE(SUM(amount), 0) 
     FROM transactions 
     WHERE transaction_type IN ('platform_fee', 'withdrawal_fee', 
                                'platform_donation', 'direct_platform_donation')) -
    (SELECT COALESCE(SUM(stripe_fee), 0) 
     FROM transactions 
     WHERE stripe_fee > 0);
END;
$$ LANGUAGE plpgsql;
```

---

## 📈 KASUMLIKKUSE NÄIDE

### Stsenaarium: 1 Case, €100 donation

```
KASUTAJA FLOW:
1. Deposit €100 → wallet €100
   - Operations account: +€98.35
   - Platform cost: €1.65 (Stripe)

2. Donate €100 to case
   - Wallet: €100 → €0
   - Case escrow: +€90
   - Platform revenue: +€10 (10% fee)

3. Case resolved
   - Investigator wallet: +€81 (90% of €90)
   - Platform revenue: +€9 (10% of €90)

4. Investigator withdraws €81
   - Investigator bank: +€79.38
   - Platform revenue: +€1.62 (2% fee)

PLATFORM BALANCE:
- Total revenue: €10 + €9 + €1.62 = €20.62
- Total costs: €1.65 (Stripe deposit fee)
- Net profit: €18.97

KASUMLIKKUS: 18.97% of €100
```

### Stsenaarium: Direct platform donation €50

```
KASUTAJA FLOW:
1. Donate €50 directly (credit card)
   - Revenue account: +€49.05
   - Platform revenue: +€50
   - Platform cost: €0.95 (Stripe)

PLATFORM BALANCE:
- Total revenue: €50
- Total costs: €0.95
- Net profit: €49.05

KASUMLIKKUS: 98.1% of €50
```

---

## 🗄️ TÄIELIK DATABASE SCHEMA

### Enhanced Transactions Table
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Who & What
  user_id UUID REFERENCES auth.users(id),
  transaction_type TEXT NOT NULL, -- deposit, case_donation, escrow_release, 
                                  -- platform_donation, direct_platform_donation,
                                  -- withdrawal, refund
  
  -- Amounts
  amount DECIMAL(10,2) NOT NULL,           -- Gross amount
  fee DECIMAL(10,2) DEFAULT 0.00,          -- Platform fee
  stripe_fee DECIMAL(10,2) DEFAULT 0.00,   -- Stripe processing fee
  net_amount DECIMAL(10,2),                -- Net amount (amount - fee)
  
  -- References
  case_id UUID REFERENCES cases(id),
  investigator_id UUID REFERENCES profiles(id),
  withdrawal_request_id UUID REFERENCES withdrawal_requests(id),
  
  -- Stripe
  stripe_payment_id TEXT,
  stripe_payout_id TEXT,
  stripe_transfer_id TEXT,
  
  -- Status & Metadata
  status TEXT DEFAULT 'completed', -- pending, completed, failed, refunded
  description TEXT,
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Backward compatibility
  type TEXT GENERATED ALWAYS AS (transaction_type) STORED
);

-- Indexes
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_case ON transactions(case_id);
CREATE INDEX idx_transactions_created ON transactions(created_at);
```

### Platform Financials Table
```sql
CREATE TABLE platform_financials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Revenue breakdown
  case_donation_fees DECIMAL(10,2) DEFAULT 0.00,
  escrow_release_fees DECIMAL(10,2) DEFAULT 0.00,
  withdrawal_fees DECIMAL(10,2) DEFAULT 0.00,
  platform_donations DECIMAL(10,2) DEFAULT 0.00,
  direct_donations DECIMAL(10,2) DEFAULT 0.00,
  total_revenue DECIMAL(10,2) DEFAULT 0.00,
  
  -- Costs
  stripe_fees DECIMAL(10,2) DEFAULT 0.00,
  refunds DECIMAL(10,2) DEFAULT 0.00,
  total_costs DECIMAL(10,2) DEFAULT 0.00,
  
  -- Profit
  net_profit DECIMAL(10,2) DEFAULT 0.00,
  profit_margin DECIMAL(5,2) DEFAULT 0.00, -- Percentage
  
  -- Volume metrics
  total_deposits DECIMAL(10,2) DEFAULT 0.00,
  total_withdrawals DECIMAL(10,2) DEFAULT 0.00,
  total_donations DECIMAL(10,2) DEFAULT 0.00,
  active_cases INT DEFAULT 0,
  completed_cases INT DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generate monthly reports
CREATE OR REPLACE FUNCTION generate_monthly_financial_report(
  p_year INT,
  p_month INT
)
RETURNS UUID AS $$
DECLARE
  v_report_id UUID;
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  v_start_date := make_date(p_year, p_month, 1);
  v_end_date := v_start_date + INTERVAL '1 month' - INTERVAL '1 day';
  
  INSERT INTO platform_financials (
    period_start,
    period_end,
    case_donation_fees,
    escrow_release_fees,
    withdrawal_fees,
    platform_donations,
    direct_donations,
    total_revenue,
    stripe_fees,
    total_costs,
    net_profit,
    profit_margin,
    total_deposits,
    total_withdrawals,
    total_donations,
    active_cases,
    completed_cases
  )
  SELECT
    v_start_date,
    v_end_date,
    
    -- Revenue
    COALESCE(SUM(CASE WHEN transaction_type = 'case_donation' THEN amount * 0.10 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type = 'escrow_release' THEN amount * 0.10 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type = 'withdrawal' THEN fee ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type = 'platform_donation' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type = 'direct_platform_donation' THEN amount ELSE 0 END), 0),
    
    COALESCE(SUM(CASE 
      WHEN transaction_type IN ('case_donation', 'escrow_release') THEN amount * 0.10
      WHEN transaction_type = 'withdrawal' THEN fee
      WHEN transaction_type IN ('platform_donation', 'direct_platform_donation') THEN amount
      ELSE 0 
    END), 0) AS total_revenue,
    
    -- Costs
    COALESCE(SUM(stripe_fee), 0),
    COALESCE(SUM(stripe_fee), 0) AS total_costs,
    
    -- Profit
    COALESCE(SUM(CASE 
      WHEN transaction_type IN ('case_donation', 'escrow_release') THEN amount * 0.10
      WHEN transaction_type = 'withdrawal' THEN fee
      WHEN transaction_type IN ('platform_donation', 'direct_platform_donation') THEN amount
      ELSE 0 
    END), 0) - COALESCE(SUM(stripe_fee), 0) AS net_profit,
    
    -- Profit margin
    CASE 
      WHEN SUM(amount) > 0 THEN 
        ((COALESCE(SUM(CASE 
          WHEN transaction_type IN ('case_donation', 'escrow_release') THEN amount * 0.10
          WHEN transaction_type = 'withdrawal' THEN fee
          WHEN transaction_type IN ('platform_donation', 'direct_platform_donation') THEN amount
          ELSE 0 
        END), 0) - COALESCE(SUM(stripe_fee), 0)) / SUM(amount)) * 100
      ELSE 0 
    END AS profit_margin,
    
    -- Volumes
    COALESCE(SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type = 'withdrawal' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN transaction_type IN ('case_donation', 'platform_donation', 'direct_platform_donation') THEN amount ELSE 0 END), 0),
    
    (SELECT COUNT(*) FROM cases WHERE status IN ('active', 'in_progress') 
     AND created_at BETWEEN v_start_date AND v_end_date),
    (SELECT COUNT(*) FROM cases WHERE status = 'resolved' 
     AND resolved_at BETWEEN v_start_date AND v_end_date)
    
  FROM transactions
  WHERE created_at BETWEEN v_start_date AND v_end_date + INTERVAL '1 day'
  RETURNING id INTO v_report_id;
  
  RETURN v_report_id;
END;
$$ LANGUAGE plpgsql;
```

---

## ✅ KOKKUVÕTE

### Kasutajale
- ✅ **Tasuta deposits** (platform kannab Stripe fee)
- ✅ **Õiglased tasud**: 10% case donations, 2% withdrawals
- ✅ **0% platform donations** (100% läheb platvormile)
- ✅ **Kiire**: DB transactions on instant
- ✅ **Läbipaistev**: kõik tasud on selgelt nähtavad

### Platvormile
- ✅ **Selge kasum**: Revenue account on ainult profit
- ✅ **Automaatne**: Nightly batches, reconciliation
- ✅ **Skaleeruv**: Operations handle unlimited users
- ✅ **Kontrollitav**: Daily reports, alerts
- ✅ **19% margin** case donations'ist (10% + 10%)

### Omanikule
- ✅ **Puhas raha**: Revenue account = net profit
- ✅ **Selge aruandlus**: Monthly financial reports
- ✅ **Reconciliation**: Auto-check Operations vs DB
- ✅ **Kasvupotentsiaal**: Scalable kuni 100k+ users

---

## 🚀 JÄRGMINE SAMM

Kas alustan implementeerimist selle struktuuri järgi? 

Loon:
1. ✅ Database tables & functions
2. ✅ Edge functions (5 tk)
3. ✅ Reconciliation system
4. ✅ Financial reporting
5. ✅ Frontend components

Aega: ~2 päeva. 💰
