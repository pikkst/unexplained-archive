# Subscription Groups & Mass Notifications System

## 📋 Ülevaade

Tellijate gruppide halduse ja massiteadete süsteem võimaldab administraatoritel saata sihtmärgistatud teateid erinevatele kasutajate gruppidele nende tellimuse staatuse, tüübi ja kasutuse põhjal.

## 🎯 Grupid

### Eelseadistatud Grupid

1. **Kõik Tellijad** (`all_subscribers`)
   - Kõik aktiivsed tellimused (Basic, Premium, Pro)
   - Prooviaja kasutajad

2. **Basic Tellijad** (`basic_subscribers`)
   - Ainult Basic plaani tellijad
   - Aktiivsed ja prooviajal

3. **Premium Tellijad** (`premium_subscribers`)
   - Ainult Premium plaani tellijad
   - Aktiivsed ja prooviajal

4. **Pro Tellijad** (`pro_subscribers`)
   - Ainult Pro plaani tellijad
   - Aktiivsed ja prooviajal

5. **Prooviaja Kasutajad** (`trial_users`)
   - Kasutajad, kes on prooviajal

6. **Tühistatud Tellimused** (`canceled_subscribers`)
   - Tellimused, mis lõpevad perioodi lõpus
   - Veel aktiivsed, aga ei uuene

7. **Aegunud Tellimused** (`expired_subscribers`)
   - Hiljuti aegunud tellimused (viimased 30 päeva)
   - Potentsiaalsed taasaktiveerimise sihtrühmad

8. **Kõrge Kasutus** (`high_usage`)
   - Basic kasutajad, kes on kasutanud >80% krediitidest
   - Potentsiaalsed upgrade sihtrühmad

9. **Madal Kasutus** (`low_usage`)
   - Tellijad, kes ei ole 30 päeva kasutanud AI tööriistu
   - Vajab kaasamisstrateegiat

## 🗄️ Andmebaasi Struktuur

### Tabelid

#### `subscription_notification_groups`
Gruppide konfigureerimine ja statistika.

```sql
- id: UUID (Primary Key)
- group_code: TEXT (Unique) - Grupi identifikaator
- group_name: TEXT - Eestikeelne nimi
- description: TEXT - Grupi kirjeldus
- criteria: JSONB - Filtreerimise kriteeriumid
- member_count: INTEGER - Liikmete arv
- last_notification_sent_at: TIMESTAMPTZ - Viimane teade
```

#### `mass_notifications`
Saadetud massiteadete logi.

```sql
- id: UUID (Primary Key)
- subject: TEXT - Teate teema
- message: TEXT - Teate sisu
- notification_type: TEXT - Tüüp (announcement, update, promotion, warning, reminder)
- target_group_code: TEXT - Sihtrühm
- target_user_ids: UUID[] - Spetsiifilised kasutajad (valikuline)
- delivery_method: TEXT - Saatmise viis (email, in_app, both)
- status: TEXT - Staatus (pending, sending, completed, failed)
- total_recipients: INTEGER - Saajate arv
- sent_count: INTEGER - Edukalt saadetud
- failed_count: INTEGER - Ebaõnnestunud
- sent_by: UUID - Saatja (admin)
- created_at, scheduled_at, started_at, completed_at: TIMESTAMPTZ
```

### Funktsioonid

#### `get_subscription_group_members(p_group_code TEXT)`
Tagastab grupi liikmed koos tellimusega seotud andmetega.

**Tagastab:**
- user_id
- email
- full_name
- plan_type
- subscription_status
- credits_remaining

#### `update_group_member_counts()`
Uuendab kõigi gruppide liikmete arvu.

## 🎨 UI Komponendid

### `SubscriptionGroupNotifications.tsx`

React komponent admin dashboardi jaoks:

**Funktsioonid:**
- Gruppide nimekiri koos liikmete arvuga
- Grupi valimine ja liikmete eelvaade
- Teate koostamine (teema, sõnum)
- Teate tüübi valimine (5 tüüpi)
- Saatmise viisi valimine (email, in-app, mõlemad)
- Eelvaate kuvamine
- Saajate nimekiri
- Teate saatmine

**Teate Tüübid:**
1. **Announcement** 🔵 - Üldised teated
2. **Update** 🟢 - Süsteemi uuendused
3. **Promotion** 🟣 - Turundussõnumid, pakkumised
4. **Warning** 🟡 - Hoiatused, tähtajad
5. **Reminder** 🟠 - Meeldetuletused

**Saatmise Viisid:**
- **Email** 📧 - Ainult e-post
- **In-App** 🔔 - Ainult rakenduse sees
- **Both** 📈 - Mõlemad

## 🔧 Edge Functions

### `send-mass-notification`

Supabase Edge Function massiteadete saatmiseks.

**Endpoint:** `/functions/v1/send-mass-notification`

**Body:**
```json
{
  "notificationId": "uuid"
}
```

**Protsess:**
1. Leia teate andmed
2. Uuenda staatus → 'sending'
3. Lae sihtrühma liikmed
4. Saada teated (email + in-app)
5. Uuenda statistika (sent_count, failed_count)
6. Märgi lõpetatuks

**Märkus:** Email funktsioon on praegu placeholder. Integreeri:
- SendGrid
- Resend
- AWS SES
- Mailgun

## 📊 Kasutusstsenaariume

### 1. Upgrade Promotion
**Grupp:** `high_usage` (kõrge kasutus)
**Teade:**
```
Teema: Oled jõudnud oma krediidilimiidi lähedale! 🚀
Sõnum: Tere! Märkasime, et oled kasutanud 80%+ oma AI krediitidest. 
Upgrade Premium plaanile ja saa piiramatu kasutus! Kliki siia...
```

### 2. Engagement Campaign
**Grupp:** `low_usage` (madal kasutus)
**Teade:**
```
Teema: Jäime sinu AI tööriistadest ilma! 😢
Sõnum: Tere! Pole sind 30 päeva näinud. Kas teadsid, et meil on uued funktsioonid?
Tule tagasi ja kasuta oma krediite ära!
```

### 3. Retention Campaign
**Grupp:** `canceled_subscribers`
**Teade:**
```
Teema: Oota! Ära lahku veel! 💔
Sõnum: Märkasime, et oled oma tellimuse tühistanud. Kas saame midagi teha?
Võtame sulle 20% soodushinda, kui jääd!
```

### 4. Win-back Campaign
**Grupp:** `expired_subscribers`
**Teade:**
```
Teema: Tule tagasi! 🎁 Spetsiaalne pakkumine
Sõnum: Tere! Oleme sind vahele jätnud. Tule tagasi ja saa esimene kuu 50% soodsamalt!
Sinu AI tööriistad ootavad...
```

### 5. Feature Announcement
**Grupp:** `all_subscribers`
**Teade:**
```
Teema: 🎉 UUS! GPT-5 integratsioon
Sõnum: Suured uudised! Oleme lisanud GPT-5 toe kõigisse plaanidesse.
Proovi kohe ja koge võimsamat AI analüüsi!
```

## 🚀 Deploy

### 1. Andmebaas

```bash
# Käivita migratsioon
psql -h YOUR_PROJECT.supabase.co -d postgres -U postgres -f supabase/migrations/20251212000002_subscription_notification_groups.sql
```

Või Supabase SQL Editoris:
1. Kopeeri `20251212000002_subscription_notification_groups.sql` sisu
2. Kleebi SQL Editorisse
3. Run

### 2. Edge Function

```bash
# Deploy function
supabase functions deploy send-mass-notification

# Test locally
supabase functions serve send-mass-notification --env-file .env.local
```

### 3. Frontend

Komponent on juba imporditud `AdminDashboard.tsx` failist:
- Uus tab "Subscriptions & Groups"
- Nähtav ainult admini jaoks

## 🔒 Turvalisus

### RLS Policies
- **Gruppide vaatamine:** Ainult adminid
- **Teadete vaatamine:** Ainult adminid
- **Teadete loomine:** Ainult adminid
- **Service role:** Täielik juurdepääs (Edge Functions)

### Lubade kontroll
```typescript
// AdminDashboard.tsx kontrollib:
if (profile?.role !== 'admin') {
  return <div>Forbidden</div>;
}
```

## 📈 Analytics

### Gruppide statistika

```sql
-- Uuenda liikmete arvu
SELECT update_group_member_counts();

-- Vaata gruppe
SELECT 
  group_name,
  member_count,
  last_notification_sent_at
FROM subscription_notification_groups
ORDER BY member_count DESC;
```

### Teadete statistika

```sql
-- Viimased teated
SELECT 
  subject,
  target_group_code,
  total_recipients,
  sent_count,
  failed_count,
  created_at,
  completed_at
FROM mass_notifications
ORDER BY created_at DESC
LIMIT 10;

-- Eduprotsent
SELECT 
  AVG(sent_count::FLOAT / NULLIF(total_recipients, 0) * 100) as success_rate
FROM mass_notifications
WHERE status = 'completed';
```

## 🎯 Järgmised Sammud

### Kohe Implementeeritav
✅ Andmebaas: Valmis
✅ UI: Valmis  
✅ Edge Function: Valmis (placeholder email)
⏳ Email integratsioon: Vajab seadistust

### Email Integratsioon

**Variant 1: Resend (Soovitatud)**
```typescript
// install: npm install resend
import { Resend } from 'resend';
const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

await resend.emails.send({
  from: 'noreply@unexplained.ee',
  to: recipient.email,
  subject: notification.subject,
  html: notification.message,
});
```

**Variant 2: SendGrid**
```typescript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(Deno.env.get('SENDGRID_API_KEY'));

await sgMail.send({
  to: recipient.email,
  from: 'noreply@unexplained.ee',
  subject: notification.subject,
  html: notification.message,
});
```

### Täiendavad Funktsioonid
- [ ] Scheduled notifications (ajastatud saatmine)
- [ ] A/B testing (mitme teate testimine)
- [ ] Email templates (HTML šabloonid)
- [ ] Unsubscribe management (loobumise haldus)
- [ ] Notification preferences per user
- [ ] Analytics dashboard (avamised, klõpsud)
- [ ] Webhook callbacks
- [ ] Rate limiting

## 📝 Testimine

### 1. Andmebaas
```sql
-- Testi grupi liikmeid
SELECT * FROM get_subscription_group_members('basic_subscribers');

-- Uuenda loendureid
SELECT update_group_member_counts();
SELECT * FROM subscription_notification_groups;
```

### 2. UI
1. Logi sisse kui admin
2. Navigeeri Admin Dashboard → Subscriptions & Groups
3. Vali grupp (näiteks "Basic Tellijad")
4. Täida teate vorm
5. Vaata eelvaadet
6. Saada test-teade

### 3. Edge Function (Local)
```bash
# Start local function
supabase functions serve send-mass-notification

# Test with curl
curl -X POST http://localhost:54321/functions/v1/send-mass-notification \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"notificationId":"test-uuid"}'
```

## ⚠️ Hoiatused

1. **Email Service:** Praegu pole email saatmine integreeritud. Kasutajad saavad ainult in-app teateid.

2. **Rate Limits:** Kontrolli, et ei saadaks liiga palju teateid korraga (spam). Implementeeri throttling.

3. **GDPR:** Veendu, et kasutajatel on võimalus loobuda turundussõnumitest.

4. **Testing:** Alati testi väikese grupiga enne massilist saatmist!

---

**Valmis kasutamiseks!** 🚀
