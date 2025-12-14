# 💳 STRIPE PAYMENT FLOWS - Unexplained Archive

## 📊 OVERVIEW

The platform payment system supports **4 different payment flows**:

### 1️⃣ **Wallet Deposit** (User loads money into their wallet)
### 2️⃣ **Case Donation** (Stripe → Case Escrow) - **10% SERVICE FEE**
### 3️⃣ **Platform Donation via Stripe** (Bank → Platform) - **0% SERVICE FEE**
### 4️⃣ **Platform/Case Donation via Wallet** (Wallet Balance → Target) - **0% SERVICE FEE**

---

## 1️⃣ WALLET DEPOSIT (Stripe → User Wallet)

```
┌─────────────┐
│    USER     │ Wants to add €100 to their wallet
└──────┬──────┘
       │
       │ 1. Clicks "Deposit Funds"
       ▼
┌─────────────────────────────────┐
│  create-deposit-checkout Edge   │
│  Function                        │
│                                  │
│  amount: 100                     │
│  userId: xxx                     │
└─────────┬───────────────────────┘
          │
          │ 2. Loob Stripe Checkout Session
          ▼
┌─────────────────────────────────┐
│      STRIPE CHECKOUT            │
│   (Kasutaja maksab €100)        │
│                                  │
│   💳 Kaart → Stripe             │
└─────────┬───────────────────────┘
          │
          │ 3. checkout.session.completed webhook
          ▼
┌─────────────────────────────────┐
│   stripe-webhook Edge Function  │
│                                  │
│   if (type === 'wallet_deposit')│
│   {                              │
│     add_wallet_balance()         │
│     €100 → kasutaja wallet      │
│   }                              │
└─────────┬───────────────────────┘
          │
          │ 4. Database update
          ▼
┌─────────────────────────────────┐
│      SUPABASE DATABASE          │
│                                  │
│  wallets tabel:                 │
│    user_id: xxx                 │
│    balance: 0.00 → 100.00 ✅   │
│                                  │
│  transactions tabel:             │
│    type: 'deposit'              │
│    amount: 100                   │
│    status: 'completed'          │
└─────────────────────────────────┘

TULEMUS: Kasutaja wallet = €100
         Stripe konto = €100 (sinu kontol)
```

---

## 2️⃣ CASE DONATION via STRIPE (Pank → Case Escrow)

```
┌─────────────┐
│   KASUTAJA  │ Tahab annetada €50 case'ile
└──────┬──────┘
       │
       │ 1. Klikkab "Donate from Bank"
       ▼
┌─────────────────────────────────┐
│  create-donation-checkout Edge  │
│  Function                        │
│                                  │
│  caseId: 'case-uuid-123'        │
│  amount: 50                      │
│  userId: xxx                     │
│                                  │
│  Arvutab:                        │
│    Platform Fee = €5 (10%)      │
│    Net Amount = €45             │
└─────────┬───────────────────────┘
          │
          │ 2. Loob Stripe Checkout
          ▼
┌─────────────────────────────────┐
│      STRIPE CHECKOUT            │
│   (Kasutaja maksab €50)         │
│                                  │
│   💳 Kaart → Stripe             │
└─────────┬───────────────────────┘
          │
          │ 3. webhook: checkout.session.completed
          ▼
┌─────────────────────────────────┐
│   stripe-webhook Edge Function  │
│                                  │
│   if (type === 'donation') {    │
│     increment_case_escrow()     │
│     €45 → case escrow           │
│                                  │
│     Record platform fee:        │
│     €5 → platform               │
│   }                              │
└─────────┬───────────────────────┘
          │
          │ 4. Database updates
          ▼
┌─────────────────────────────────┐
│      SUPABASE DATABASE          │
│                                  │
│  case_escrow tabel:             │
│    case_id: xxx                 │
│    total_amount: 0 → 45         │
│    locked_amount: 0 → 45        │
│                                  │
│  transactions tabel:             │
│    type: 'donation'             │
│    amount: 50                    │
│    case_id: xxx                 │
│    status: 'completed'          │
│    escrow_status: 'held'        │
│                                  │
│  transactions tabel:             │
│    type: 'platform_fee'         │
│    amount: 5                     │
│    status: 'completed'          │
└─────────────────────────────────┘

TULEMUS: Case Escrow = €45 (lukustatud)
         Platform Fee = €5
         Stripe konto = €50 (sinu kontol)
```

---

## 3️⃣ PLATFORM DONATION from WALLET (Wallet → Platform)

```
┌─────────────┐
│   KASUTAJA  │ Wallet balance: €100
└──────┬──────┘
       │
       │ 1. Valib DonationPage'is:
       │    Target: "Platform Support"
       │    Amount: €20
       ▼
┌─────────────────────────────────┐
│      FRONTEND (React)            │
│  DonationPage.tsx                │
│                                  │
│  if (targetCaseId === 'platform')│
│  {                               │
│    supabase.from('transactions') │
│    .insert({                     │
│      from_wallet_id: xxx,       │
│      amount: 20,                │
│      type: 'donation',          │
│      metadata: {                │
│        target: 'platform'       │
│      }                           │
│    })                            │
│  }                               │
└─────────┬───────────────────────┘
          │
          │ 2. ALTERNATIIV (kui kasutad RPC):
          │    supabase.rpc('process_platform_donation')
          ▼
┌─────────────────────────────────┐
│   process_platform_donation()    │
│   (Database Function)            │
│                                  │
│   1. Kontrollib kasutaja saldo  │
│   2. Vähendab kasutaja wallet:  │
│      €100 → €80                 │
│   3. Suurendab platform wallet: │
│      €0 → €20                   │
│   4. Loob transaction kirje     │
└─────────┬───────────────────────┘
          │
          │ 3. Database updates
          ▼
┌─────────────────────────────────┐
│      SUPABASE DATABASE          │
│                                  │
│  wallets tabel:                 │
│    user_id: xxx                 │
│    balance: 100 → 80 ⬇️        │
│                                  │
│  wallets tabel:                 │
│    user_id: NULL (platform)     │
│    balance: 0 → 20 ⬆️          │
│                                  │
│  transactions tabel:             │
│    from_wallet_id: user_xxx     │
│    to_wallet_id: platform       │
│    type: 'donation'             │
│    amount: 20                    │
│    status: 'completed'          │
│    metadata: {                   │
│      target: 'platform'         │
│    }                             │
│                                  │
│  platform_revenue tabel:         │
│    revenue_type: 'platform_fee' │
│    amount: 20                    │
└─────────────────────────────────┘

TULEMUS: Kasutaja wallet = €80
         Platform wallet = €20
         EI OLE STRIPE TEHINGUT (wallet-to-wallet)
```

---

## 🔑 VÕTME ERINEVUSED

| Aspekt | Stripe Deposit | Stripe Case Donation | Stripe Platform Donation | Wallet Case/Platform Donation |
|--------|---------------|---------------------|------------------------|------------------------------|
| **Maksemeetod** | 💳 Krediitkaart | 💳 Krediitkaart | 💳 Krediitkaart | 💰 Wallet balance |
| **Stripe kaasatud?** | ✅ Jah | ✅ Jah | ✅ Jah | ❌ EI |
| **Platform Fee** | 0% | **10%** (€5 kui €50) | **0%** | **0%** |
| **Escrow?** | ❌ Ei | ✅ Jah (lukustatud) | ❌ Ei | ✅ (case) / ❌ (platform) |
| **Raha sihtkoht** | User wallet | Case escrow | Platform revenue | Case/Platform (full) |
| **Stripe konto** | +€100 | +€50 | +€50 | €0 (internal) |
| **Miks fee?** | N/A | Infrastruktuur + teenused | **POLE - kogu raha platvormile** | Sisemine, tasuta |

### 💡 PÕHIMÕTE:
- **Platvormile otse annetused = 0% fee** - Kogu raha läheb platvormi arendamiseks
- **Juhtumitele annetused Stripe'iga = 10% fee** - Platvorm pakub infrastruktuuri
- **Wallet'ist annetused = 0% fee** - Sisemine ülekanne, ei kaasne kulusid

---

## 💰 STRIPE SALDO

**Sinu Stripe kontol:**
```
= SUM(kõik Stripe deposits) + SUM(kõik Stripe case donations)
= (User wallet deposits) + (Case donations)
```

**Raha, mida kasutajad wallet'is näevad:**
```
= SUM(wallet balances in database)
```

**Raha case escrow'des (lukustatud):**
```
= SUM(case_escrow.locked_amount)
```

**Platform tegelik tulu:**
```
= Platform wallet balance + SUM(platform_fees)
```

---

## ⚠️ OLULINE NÜANSS

### Wallet Donations EI LÄE STRIPE'i LÄBI

Kui kasutaja:
1. Paneb €100 Stripe'i kaudu → Stripe +€100, Wallet +€100 ✅
2. Dooneerib €20 platvormile wallet'ist → Stripe €0, Platform wallet +€20 ✅

**See on SISEMINE ÜLEKANNE** (wallet-to-wallet), mitte Stripe makse!

### Väljavõtmiseks (Withdrawal)

Kui kasutaja tahab raha tagasi oma panka:
```
1. User wallet: €80 → €60 (taotleb €20 withdrawal)
2. Stripe payout: €20 kasutaja pangakontole
3. Sinu Stripe saldo: -€20
```

---

## 🎯 SOOVITUSED

### Praegune probleem parandatud:
✅ `type` veerg lisatud transactions tabelisse  
✅ Wallet donation loogika parandatud (ei mõjuta teisi kasutajaid)  
✅ Platform donation funktsioon loodud

### Veel teha:
1. **Stripe Withdrawal API** - et kasutajad saaksid raha välja võtta
2. **Balance reconciliation** - kontrollida, et Stripe saldo = DB saldo
3. **Escrow release** - automaatne või manuaalne vabastamine kui case resolved

---

## 📝 KOKKUVÕTE

- **Stripe maksed** → Alati tegelik raha (€€€) sinu Stripe kontole
- **Wallet donations** → Sisemine raamatupidamine (DB transactions)
- **Escrow** → Lukustatud raha (DB), mitte eraldi Stripe hold
- **Platform Fee** → Sinu tulu (10% case donationsidest + 100% platform donations)

Kas see selgitab? 🚀
