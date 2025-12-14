# 📱 Mobile Payment Troubleshooting Guide

## 🔴 Probleem: 5 EUR annetuse makse ebaõnnestus telefonist

### ✅ Parandused tehtud (v1.0)

1. **Parem error handling**
   - Console logid lisatud kõikjale
   - Täpsemad veateated kasutajale
   - Mobiilne alert süsteem vigade jaoks

2. **URL genereerimise täiustus**
   - `window.location.origin` fallback mobiilile
   - Täpsem redirect URL'ide genereerimine
   - Origin header kasutamine edge funktsioonides

3. **Valideerimise täiustus**
   - Eraldi validatsioon erinevatel tasanditel
   - Minimaalne summa kontroll (5 EUR)
   - Kasutaja autentimise kontroll

4. **Edge function logging**
   - Detailne logimine igas etapis
   - Stripe API vigade püüdmine
   - Case'i staatuse kontroll

---

## 🔍 Kuidas debugida makse vigu

### 1. **Brauseri Console Logid**

Kontrolli brauseri console'is (F12 → Console):

```javascript
// Peaks nägema:
Creating donation payment: {caseId, amount, userId, origin}
Payment session created successfully: ses_xxxxx
Redirecting to Stripe checkout: https://checkout.stripe.com/...
```

### 2. **Supabase Edge Function Logid**

Kontrolli Supabase dashboardis:
- Project → Edge Functions → Logs
- Otsi: `Payment checkout request`
- Peaks nägema:
  ```
  Payment checkout request: {caseId, amount, userId, ...}
  Creating Stripe session: {isWalletDeposit, amount, platformFee, ...}
  Stripe session created: {sessionId, hasUrl}
  ```

### 3. **Võimalikud veateated**

| Viga | Põhjus | Lahendus |
|------|--------|----------|
| "Minimum payment amount is €5" | Summa < 5 EUR | Kasuta vähemalt 5 EUR |
| "Please log in to continue" | Kasutaja pole sisse loginud | Login uuesti |
| "Payment service temporarily unavailable" | Edge function ei vastanud | Proovi uuesti 1min pärast |
| "Invalid payment session" | Stripe session puudub | Kontrolli STRIPE_SECRET_KEY |
| "Cannot donate to closed cases" | Case on suletud | Vali teine case |

---

## 📋 Checklist kui makse ebaõnnestub

### Frontend (Kasutaja poolel):
- [ ] **Kasutaja on sisse loginud?**
- [ ] **Internet connection OK?**
- [ ] **Summa >= 5 EUR?**
- [ ] **Case pole suletud?**
- [ ] **Popup blocker lubab Stripe checkout?**

### Backend (Administraator):
- [ ] **STRIPE_SECRET_KEY on seatud?**
- [ ] **STRIPE_OPERATIONS_ACCOUNT_ID on seatud?**
- [ ] **Edge function on deployed?**
- [ ] **Supabase logis on vead?**
- [ ] **Stripe Dashboard logis on vead?**

---

## 🛠️ Kuidas testida makset

### Test Case 1: Minimaalne makse (5 EUR)

```javascript
// Avad console (F12)
// Kliki "Donate €5" nuppu
// Peaks nägema:
// ✅ Creating donation payment: {...}
// ✅ Payment session created successfully: ses_xxxxx
// ✅ Redirect Stripe checkout
```

### Test Case 2: Kontroll kas redirect töötab

```javascript
// Check redirect URL
console.log(window.location.origin)
// Mobile: https://yourdomain.com
// Desktop: https://yourdomain.com
// Localhost: http://localhost:5173
```

---

## 📞 Võimalikud Mobile-Specific Issues

### Issue 1: Safari iOS blokeerib redirect
**Sümptom:** Stripe checkout ei avane
**Lahendus:** Safari settings → Allow pop-ups

### Issue 2: Chrome Mobile aeglane
**Sümptom:** "Loading..." igavesti
**Lahendus:** Clear cache + reload

### Issue 3: Origin header puudub
**Sümptom:** "Invalid payment session"
**Lahendus:** Edge function kasutab fallback origin'i

---

## 🔐 Stripe Test Mode

Testimiseks kasuta Stripe test kaarte:

| Kaart | Tulemus |
|-------|---------|
| 4242 4242 4242 4242 | ✅ Õnnestub |
| 4000 0000 0000 9995 | ❌ Ebaõnnestub (insufficient funds) |
| 4000 0025 0000 3155 | ⏳ Vajab 3D Secure |

**CVV:** Suvaline 3-kohaline  
**Kehtivus:** Tulevikus  
**ZIP:** Suvaline

---

## 📊 Monitoring

### Real-time monitoring:
1. **Supabase Logs** - Edge function errors
2. **Stripe Dashboard** - Payment attempts
3. **Browser Console** - Frontend errors
4. **User Reports** - Manual feedback

### Kui kõik ebaõnnestub:
- Kontrolli `DEPLOYMENT_STATUS.txt`
- Kontrolli `Docks/STRIPE_MONEY_FLOW.md`
- Ava Stripe Dashboard → Developers → Logs
- Kontakteeru Stripe support'iga

---

## 🚀 Järgmised sammud

1. **Deploy uuendused:**
   ```bash
   npm run build
   # Deploy to Netlify/Vercel
   # Deploy edge functions to Supabase
   ```

2. **Test mobiilis:**
   - Ava telefonis: yourdomain.com
   - Login sisse
   - Proovi maksta 5 EUR
   - Kontrolli kas redirect töötab

3. **Monitor logid:**
   - Supabase Dashboard → Functions → Logs
   - Stripe Dashboard → Developers → Events

---

## ✅ Success Criteria

Makse loetakse õnnestunuks kui:
1. ✅ Kasutaja redirect'itakse Stripe checkout'i
2. ✅ Makse läbi viiakse edukalt
3. ✅ Redirect tagasi success URL'ile
4. ✅ Transaction salvestub andmebaasi
5. ✅ Case reward suureneb (minus 10% fee)

---

**Viimati uuendatud:** 2025-12-14  
**Versioon:** 1.0
