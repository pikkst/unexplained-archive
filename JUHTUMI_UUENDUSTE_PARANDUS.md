# 🔧 JUHTUMI UUENDUSTE JA TEAVITUSTE PARANDUSED

**Kuupäev:** 2025-12-12  
**Probleem:** Kui uurija täidab juhtumit (lisab tulemusi, märkmeid, dokumente), siis:
- Andmed ei salvestu andmebaasi
- Juhtumi looja ei näe uuendatud sisu
- Juhtumi loojale ei tule teavitusi
- Followerid ei saa teavitusi

---

## ✅ TEHTUD PARANDUSED

### 1. Andmebaasi Muudatused (`20251212_fix_case_updates_and_notifications.sql`)

**Lisatud väljad `cases` tabelisse:**
- `investigation_log` (JSONB) - Uurija märkmete salvestamine
- `resolution_proposal` (TEXT) - Uurija lõppraport
- `documents` (JSONB) - Lisatud dokumendid
- `investigator_notes` (TEXT) - Lihtsad märkmed (legacy)

**Loodud funktsioonid:**
- `notify_case_update()` - Saadab teavitusi kui:
  - Uurija alustab juhtumi uurimist (status → INVESTIGATING)
  - Lisatakse uusi märkmeid (investigation_log uueneb)
  - Lisatakse uusi dokumente (documents uueneb)
  - Esitatakse lõppraport (resolution_proposal)
  - Status muutub PENDING_REVIEW'ks

- `notify_investigator_assigned()` - Saadab teavituse kui juhtumile määratakse uurija

**Triggerid:**
- `trigger_notify_case_update` - Jälgib juhtumi uuendusi ja saadab teavitusi
- `trigger_notify_investigator_assigned` - Jälgib uurija määramist

### 2. Frontend Muudatused (`CaseFolder.tsx`)

**Uuendatud funktsioonid:**
- `handleAddLog()` - Nüüd salvestab märkmed andmebaasi
- `handleUploadDoc()` - Salvestab dokumendid andmebaasi
- `handleSaveReport()` - Salvestab raporti andmebaasi
- `handleSubmitResolution()` - Esitab lahenduse ja muudab staatust

**Lisatud:**
- `isSaving` state - Näitab salvestamise olekut
- Laadimisindikaatorid nuppudel
- Eestikeelsed kasutajale sõnumid
- Error handling kõigile toimingutele

---

## 🚀 KUIDAS RAKENDADA

### 1. Käivita migratsiooni fail Supabase'is

```bash
# Loo uus migratsiooni fail või käivita SQL päringuna
psql -d your_database -f supabase/migrations/20251212_fix_case_updates_and_notifications.sql
```

VÕI Supabase Dashboard'is:
1. Mine **SQL Editor**
2. Kopeeri faili sisu
3. Vajuta **Run**

### 2. Frontend on juba uuendatud

Kood on uuendatud ja valmis kasutamiseks. Pole vaja midagi installida.

### 3. Testi funktsionaalsust

1. **Logi sisse uurijana**
2. **Võta juhtum vastu või ava olemasolev juhtum**
3. **Lisa märkmed Field Journal'is**
   - Kontrolli, et märge salvestub
   - Kontrolli, et juhtumi looja saab teavituse
4. **Lisa dokument Documents kaardil**
   - Kontrolli salvestumist
   - Kontrolli teavitust
5. **Genereeri ja salvesta raport**
   - Vajuta "Generate AI Report"
   - Muuda teksti
   - Vajuta "Save Draft"
   - Kontrolli, et salvestub
6. **Esita lahendus**
   - Vajuta "Submit Resolution"
   - Kontrolli, et status muutub PENDING_REVIEW'ks
   - Kontrolli, et juhtumi looja saab teavituse

---

## 📋 TEAVITUSTE LOOGIKA

### Teavituste tüübid:

1. **`investigator_assigned`** - Kui juhtumile määratakse uurija
   - Saadetakse: Juhtumi loojale
   - Sõnum: "Teie juhtumile määrati uurija! 🎯"

2. **`investigation_started`** - Kui uurija alustab tööd (status → INVESTIGATING)
   - Saadetakse: Juhtumi loojale
   - Sõnum: "Uurija hakkas teie juhtumiga tegelema! 🔍"

3. **`case_update`** - Kui uurija lisab märkmeid või dokumente
   - Saadetakse: Juhtumi loojale + kõigile followeritele
   - Sõnum: "Uurija lisas uut teavet teie juhtumisse 📝"
   - Või: "Uurija lisas uusi dokumente 📎"

4. **`resolution_submitted`** - Kui uurija esitab lõppraporti
   - Saadetakse: Juhtumi loojale + followeritele (kes soovisid resolution teavitusi)
   - Sõnum: "Uurija esitas lõppraporti! ✅"

5. **Juhtumi looja lisatakse automaatselt followeriks** kui juhtumile määratakse uurija

---

## 🧪 TESTIMINE

### Kontrolli andmebaasi:

```sql
-- Vaata kas väljad on lisatud
SELECT 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'cases' 
  AND column_name IN ('investigation_log', 'resolution_proposal', 'documents', 'investigator_notes');

-- Vaata kas funktsioonid on loodud
SELECT proname FROM pg_proc WHERE proname LIKE '%notify%case%';

-- Vaata kas triggerid on loodud
SELECT trigger_name FROM information_schema.triggers WHERE trigger_name LIKE '%notify%';

-- Kontrolli teavitusi
SELECT * FROM notifications ORDER BY created_at DESC LIMIT 10;

-- Kontrolli followereid
SELECT * FROM case_followers;
```

### Kontrolli browseris:

1. Ava Developer Console (F12)
2. Vaata Network tab'i - peaks nägema PUT päringuid `/cases/:id` endpoint'ile
3. Kontrolli, et päringud tagastavad 200 OK
4. Vaata, et andmed uuenevad

---

## ⚠️ TEADAOLEVAD PIIRANGUD

1. **Külaliste email teavitused** pole veel implementeeritud (TODO kommentaar koodis)
2. **Failide üleslaadimine** on praegu mock - tuleb hiljem lisada päris file upload
3. **AI genereeritud raportid** on demo - tuleb integreerida päris AI teenusega

---

## 🔄 JÄRGMISED SAMMUD (valikuline)

1. Lisa päris failide üleslaadimine dokumentidele
2. Integreeri päris AI teenus raportite genereerimiseks
3. Lisa email teavitused külalistele
4. Lisa push notificationid (browser notifications)
5. Lisa teavituste seaded (kasutaja saab valida, milliseid teavitusi tahab)

---

## 📞 ABI VAJAMISEL

Kui midagi ei tööta:

1. Kontrolli, et migratsiooni fail on käivitatud
2. Kontrolli browser console'ist erroreid
3. Kontrolli Supabase logisid
4. Vaata, et kasutajal on õiged õigused (RLS policies)

---

**Parandused valmis! ✅**
