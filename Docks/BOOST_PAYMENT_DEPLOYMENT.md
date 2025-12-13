## BOOST PAYMENT SYSTEM - DEPLOYMENT GUIDE

Täielik töötav boost süsteem koos Stripe ja Wallet maksete käsitlemisega.

### ✅ Mida see sisaldab:

1. **Täielik maksete süsteem**
   - Stripe checkout (juba olemas `purchase-boost-checkout`)
   - Stripe webhook käsitlemine (juba olemas `stripe-webhook`)
   - Wallet maksed (täielik transaction tracking)
   - Platform revenue tracking

2. **Analytics & Tracking**
   - Impression tracking (kui boost näidatakse)
   - Click tracking (kui boost'i klikitakse)
   - CTR (Click-Through Rate) arvutamine
   - ROI analytics kasutajale

3. **Database Functions**
   - `purchase_case_boost()` - täielik boost ost koos rahaülekandega
   - `track_boost_impression()` - impressioni loendur
   - `track_boost_click()` - kliki loendur
   - `get_user_boost_analytics()` - kasutaja analytics
   - `expire_old_boosts()` - automaatne aegunud boost'ide märkimine

---

## 📋 DEPLOYMENT SAMMUD

### 1. Käivita Database Migratsioonid (JÄRJEST!)

```sql
-- Samm 1: Paranda tabelite struktuur
fix-featured-cases-schema.sql

-- Samm 2: Ühenda hinnad üheks süsteemiks  
fix-boost-pricing-unified.sql

-- Samm 3: Loo täielik maksmise süsteem
complete-boost-payment-system.sql
```

### 2. Kontrolli Stripe Seadeid

Supabase Edge Functions vajab järgmisi environment variables:

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Funktsioonid mis peavad olemas olema:
- ✅ `purchase-boost-checkout` (juba olemas)
- ✅ `stripe-webhook` (juba olemas)

### 3. Testi Süsteemi

#### Test 1: Wallet Payment
```typescript
// Frontend test
const result = await boostService.purchaseBoostWithWallet(
  'case-id',
  'user-id',
  '24h' // või '7d' või '30d'
);
console.log(result); // peaks olema true
```

#### Test 2: Stripe Payment
```typescript
const result = await boostService.purchaseBoost(
  'case-id',
  'user-id',
  '24h'
);
// Peaks suunama Stripe checkout'i
window.location.href = result.url;
```

#### Test 3: Analytics
```typescript
const analytics = await boostService.getUserBoostAnalytics('user-id');
console.log(analytics);
// Näitab: case_title, impressions, clicks, ctr, price_paid
```

---

## 🔄 KUIDAS SÜSTEEM TÖÖTAB

### Wallet Payment Flow:
```
1. Kasutaja klikib "Purchase with Wallet"
2. Frontend kutsub: boostService.purchaseBoostWithWallet()
3. Supabase RPC: purchase_case_boost(p_stripe_payment_id: NULL)
4. Database:
   ✅ Kontrollib wallet balance
   ✅ Võtab raha kasutaja wallet'ist
   ✅ Lisab raha platform wallet'i
   ✅ Loob transaction kirje
   ✅ Aktiveerib boost featured_cases tabelis
   ✅ Salvestab platform_revenue
5. Return: success + featured_until kuupäev
```

### Stripe Payment Flow:
```
1. Kasutaja klikib "Purchase with Stripe"
2. Frontend kutsub: boostService.purchaseBoost()
3. Edge Function: purchase-boost-checkout
   - Loob Stripe Checkout Session
   - Lisab metadata: {type: 'case_boost', case_id, user_id, boost_type}
4. Kasutaja maksab Stripe checkout'is
5. Stripe webhook: checkout.session.completed
6. Edge Function: stripe-webhook
   - Kutsub: purchase_case_boost(p_stripe_payment_id: payment_intent_id)
7. Database:
   ✅ Loob transaction kirje (Stripe payment)
   ✅ Aktiveerib boost featured_cases tabelis
   ✅ Salvestab platform_revenue
8. Redirect: /cases/{caseId}?boost=success
```

---

## 💰 RAHAÜLEKANDED

### Wallet Payment:
```sql
-- User wallet: -€5.00
UPDATE wallets SET balance = balance - 5.00 WHERE user_id = 'user-123';

-- Platform wallet: +€5.00
UPDATE wallets SET balance = balance + 5.00 WHERE user_id = '00000000-0000-0000-0000-000000000000';

-- Transaction record
INSERT INTO transactions (from_wallet_id, to_wallet_id, amount, transaction_type, status)
VALUES (user_wallet_id, platform_wallet_id, 5.00, 'boost_purchase', 'completed');

-- Platform revenue
INSERT INTO platform_revenue (revenue_type, amount, transaction_id)
VALUES ('featured_case', 5.00, transaction_id);
```

### Stripe Payment:
```sql
-- Transaction record (raha juba Stripe'is)
INSERT INTO transactions (
  from_wallet_id, 
  to_wallet_id, 
  amount, 
  transaction_type, 
  status,
  stripe_payment_intent_id
)
VALUES (
  user_wallet_id, 
  platform_wallet_id, 
  5.00, 
  'boost_purchase', 
  'completed',
  'pi_xyz123'
);

-- Platform revenue
INSERT INTO platform_revenue (revenue_type, amount, transaction_id)
VALUES ('featured_case', 5.00, transaction_id);
```

---

## 📊 ANALYTICS TRACKING

### Frontend Integration:

```typescript
// In ExploreCases.tsx or CaseCard.tsx
import { boostService } from '../services/boostService';

// Track impression when case enters viewport
useEffect(() => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && case.is_boosted) {
        boostService.trackImpression(case.id);
      }
    });
  });
  
  if (caseRef.current) {
    observer.observe(caseRef.current);
  }
  
  return () => observer.disconnect();
}, [case.is_boosted]);

// Track click when case is opened
const handleCaseClick = async (caseId: string) => {
  if (case.is_boosted) {
    await boostService.trackClick(caseId);
  }
  navigate(`/cases/${caseId}`);
};
```

---

## 🎯 PRICING TIERS (Unified)

| Tier | Duration | Price | Features |
|------|----------|-------|----------|
| **24h** | 24 hours | €5.00 | Pin to top, Homepage highlight, Basic analytics |
| **7d** | 7 days (168h) | €15.00 | All 24h + Newsletter feature, Enhanced analytics, Priority support |
| **30d** | 30 days (720h) | €50.00 | All 7d + Homepage banner, Social media, Detailed analytics, Featured badge |

---

## 🔒 SECURITY

- ✅ RLS policies kasutaja wallet'il
- ✅ Transaction atomicity (rollback kui error)
- ✅ Case ownership verification
- ✅ Balance checking enne makset
- ✅ SECURITY DEFINER functions (admin õigused)

---

## 🐛 TROUBLESHOOTING

### "Insufficient wallet balance"
```sql
-- Kontrolli kasutaja balance
SELECT balance FROM wallets WHERE user_id = 'user-id';

-- Lisa test raha
UPDATE wallets SET balance = balance + 50.00 WHERE user_id = 'user-id';
```

### "Invalid boost type"
```sql
-- Kontrolli saadaolevaid boost type'e
SELECT boost_type, display_name, price FROM boost_pricing WHERE is_active = true;

-- Peaks olema: '24h', '7d', '30d'
```

### Stripe webhook ei tule läbi
```bash
# Test locally with Stripe CLI
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook

# Check webhook secret
echo $STRIPE_WEBHOOK_SECRET
```

### Transaction ei salvune
```sql
-- Kontrolli transaction table'it
SELECT * FROM transactions WHERE transaction_type = 'boost_purchase' ORDER BY created_at DESC LIMIT 10;

-- Kontrolli platform revenue
SELECT * FROM platform_revenue WHERE revenue_type = 'featured_case' ORDER BY created_at DESC LIMIT 10;
```

---

## ✅ CHECKLIST

- [ ] Database migratsioonid käivitatud
- [ ] Stripe environment variables seatud
- [ ] Platform wallet loodud (user_id: 00000000-0000-0000-0000-000000000000)
- [ ] Boost pricing tabelis 3 tier'i (24h, 7d, 30d)
- [ ] Wallet payment test tehtud
- [ ] Stripe payment test tehtud
- [ ] Analytics tracking toimib
- [ ] Transaction'd salvestuvad õigesti
- [ ] Platform revenue salvestub

---

## 📝 NEXT STEPS

1. **Deploy database changes** - Käivita kõik SQL failid Supabase SQL Editor'is
2. **Test payments** - Testi nii wallet kui Stripe makseid
3. **Implement frontend display** - Vt `BOOST_SYSTEM_STATUS.md` täielikuks implementatsiooniks
4. **Set up cron job** - Käivita `expire_old_boosts()` iga päev

---

## 💡 NOTES

- Wallet payment on **instant** - boost aktiveerub kohe
- Stripe payment võtab **paar sekundit** - ootab webhook'i
- Platform wallet ID: `00000000-0000-0000-0000-000000000000`
- Kõik summad on **EUR**
- Transactions on **atomic** - kas kõik õnnestub või mitte midagi
