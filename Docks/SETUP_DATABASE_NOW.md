# 🚨 KRIITILINE: LOO SUPABASE TABELID KOHE! 🚨

## Probleem
```
Error: Could not find the table 'public.cases' in the schema cache
```

**BAASIS POLE ÜHTEGI TABELIT!** Rakendus ei saa töötada ilma tabeliteta.

---

## ✅ LAHENDUS: Käivita SQL Skript (2 minutit)

### SAMM 1: Ava Supabase Dashboard
1. Mine: https://supabase.com/dashboard
2. Vali projekt: **hbkuximdpvxmcdlkniwi**
3. Vajuta vasakus menüüs: **SQL Editor**

### SAMM 2: Käivita Põhiskeem
1. Vajuta: **+ New Query**
2. Kopeeri KOGU fail `supabase-schema.sql` sisu
3. Kleebi SQL Editor'isse
4. Vajuta: **RUN** (Ctrl+Enter)
5. Oota kuni näed: **Success. No rows returned**

### SAMM 3: Käivita Laiendatud Skeem
1. Vajuta: **+ New Query**
2. Kopeeri KOGU fail `supabase-schema-extended.sql` sisu
3. Kleebi SQL Editor'isse
4. Vajuta: **RUN**
5. Oota kuni näed: **Success. No rows returned**

---

## 📋 Mis Luuakse?

### supabase-schema.sql (Põhitabelid)
- ✅ `profiles` - Kasutajate profiilid
- ✅ `cases` - Juhtumid (UFO, paranormal, jne)
- ✅ `comments` - Kommentaarid juhtumite kohta
- ✅ `votes` - Hääletus süsteem
- ✅ `forum_posts` - Foorumi postitused
- ✅ `forum_replies` - Foorumi vastused

### supabase-schema-extended.sql (Lisafunktsioonid)
- ✅ `wallets` - Krüpto rahakotid
- ✅ `transactions` - Tehingute ajalugu
- ✅ `subscriptions` - Tellimused (Basic/Pro/Premium)
- ✅ `investigators` - Uurijate lisainfo
- ✅ `case_assignments` - Juhtumite määramised
- ✅ `ai_generations` - AI genereerimiste logi
- ✅ RPC funktsioonid (view counting, jne)

---

## 🔍 Kontrolli Kas Töötab

Pärast SQL käivitamist refresh brauserit:
- ❌ **EI näe enam 404 vigu**
- ✅ Landing page näitab **0 juhtumit** (õige!)
- ✅ Explore cases töötab (tühi list)
- ✅ Map laeb ilma vigadeta

---

## 🆘 Kui Midagi Läheb Valesti

### Viga: "relation already exists"
- **Lahendus:** Tabelid on juba loodud! Refresh brauserit ja kontrolli.

### Viga: "permission denied"
- **Lahendus:** 
  1. Mine Supabase → **Settings → API**
  2. Kontrolli et **service_role key** on seadistatud
  3. Proovi uuesti

### Viga: SQL syntax error
- **Lahendus:**
  1. Kopeeri **TÄPSELT KOGU FAIL** - ära jäta midagi välja
  2. Veendu et ei ole lisanud oma teksti
  3. Käivita uuesti

---

## 📊 Pärast Seadistamist

Kui tabelid on loodud, saad:
1. ✅ Luua uusi juhtumeid `/submit-case`
2. ✅ Näha juhtumeid `/explore`
3. ✅ Vaadata kaarti `/map`
4. ✅ Registreerida kasutajaid
5. ✅ Kasutada AI tööriistu (investigator dashboard)
6. ✅ Teha tehinguid rahakotiga

---

## ⚡ KÄIVITA KOHE!

**Rakendus ei tööta ilma tabeliteta. See võtab ainult 2 minutit!**

1. Ava Supabase SQL Editor
2. Käivita `supabase-schema.sql`
3. Käivita `supabase-schema-extended.sql`
4. Refresh brauserit
5. Valmis! 🎉
