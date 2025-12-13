# 🚀 Kiire Deployment Juhend

## 1. Loo GitHub Repository

```bash
# Kui pole veel git initseeritud
git init

# Lisa kõik failid
git add .

# Tee esimene commit
git commit -m "Initial commit: Unexplained Archive platform"

# Loo main branch
git branch -M main

# Ühenda GitHub repostooriumiga (asenda YOUR_USERNAME oma kasutajanimega)
git remote add origin https://github.com/YOUR_USERNAME/unexplained-archive.git

# Push GitHub'i
git push -u origin main
```

## 2. Lisa GitHub Secrets

Mine oma GitHub repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Lisa järgmised 3 saladust:

| Secret Name | Väärtus | Kust saada |
|------------|---------|-----------|
| `VITE_SUPABASE_URL` | `https://hbkuximdpvxmcdlkniwi.supabase.co` | Sinu `.env` failist |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6...` | Sinu `.env` failist |
| `VITE_GEMINI_API_KEY` | `AIzaSyDGAqkQU8wmkTLbuwu...` | Sinu `.env` failist |

## 3. Luba GitHub Pages

1. Mine repository → **Settings** → **Pages**
2. "Build and deployment" all vali:
   - **Source**: GitHub Actions
3. Vajuta **Save**

## 4. Deploy!

```bash
# Kui teed muudatusi, push lihtsalt main branch'i:
git add .
git commit -m "Update: kirjeldus"
git push origin main
```

GitHub Actions käivitub automaatselt ja deploy'ib su saidi!

## 5. Kontrolli Deployment State

1. Mine repository → **Actions** tab
2. Vaata, kas workflow töötab (roheline märk = edukas)
3. Kui valmis, mine **Settings** → **Pages** ja näed oma saidi URL-i:
   - `https://YOUR_USERNAME.github.io/unexplained-archive/`

## ⚠️ Võimalikud Probleemid

### Build ebaõnnestub
- **Põhjus**: Secrets puuduvad või on valed
- **Lahendus**: Kontrolli, et kõik 3 secret'i on õigesti lisatud

### Sait ei laadi
- **Põhjus**: Supabase RLS policies blokeerivad päringuid
- **Lahendus**: Kontrolli, et `supabase-schema.sql` on käivitatud

### Kaart ei tööta
- **Põhjus**: Leaflet ei lae
- **Lahendus**: Leaflet laaditakse `index.html` kaudu, see peaks töötama automaatselt

## 🎯 Järgmised Sammud Peale Deploy'i

1. **Loo super admin**: Käivita `create-admin.sql` Supabase SQL Editor'is
2. **Lisa test juhtumeid**: Mine `/submit` ja loo mõned test case'id
3. **Testi kaarti**: Mine `/map` ja vaata, kas juhtumid kuvatakse
4. **Testi autentimist**: Registreeru ja logi sisse

## 📝 Update'imine

Kui teed muudatusi ja tahad uuesti deploy'ida:

```bash
git add .
git commit -m "Feature: uus funktsioon"
git push origin main
```

GitHub Actions deploy'ib automaatselt 2-3 minuti jooksul!

---

**Valmis?** Su Unexplained Archive on nüüd live! 🎉
