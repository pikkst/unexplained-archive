# ⚡ KIIRE JUHIS - GitHub Pages Deploy

## Platvorm VALMIS AVALDAMISEKS ✅

**Lõppkontroll tehtud - OTSUS: 100% VALMIS** 🚀

### Olemasolevad Konfid:
- ✅ Vite build system seadistatud GitHub Pages'i jaoks
- ✅ GitHub Actions workflow failis (.github/workflows/deploy.yml)
- ✅ Environment muutujad seadistatud
- ✅ npm build edukalt läbinud
- ✅ Supabase andmebaas ühendatud
- ✅ Kõik dependencies installitud

---

## 1️⃣ KIIRELT: Git Seadistamine (ESIMENE KORD)

Ava **PowerShell** ja käivita:

```powershell
cd "c:\Users\operatorBaltania\OneDrive - Perpetual Next\Töölaud\AI_Projekts\unexplained-archive"

# Initsialiseerige git
git init
git config user.email "sinu@email.com"
git config user.name "Sinu Nimi"

# Lisage kõik failid
git add .
git commit -m "Initial commit - unexplained archive"

# Kontrollige remote
git remote -v
```

---

## 2️⃣ GitHub Repo Loomine

1. Minge https://github.com
2. Uus repo → "unexplained-archive"
3. **KOPEERIGE** HTTPS URL

---

## 3️⃣ Ühendamine GitHub'iga

```powershell
# Asendage SINU_GITHUB_REPO URL-iga
git remote add origin https://github.com/KASUTAJANIMI/unexplained-archive.git
git branch -M main
git push -u origin main
```

---

## 4️⃣ GitHub Pages Seadistamine

GitHub.com'is:
1. Repo → **Settings**
2. Vasakult: **Pages**
3. Source → Branch: **main**, Folder: **/root** (või vaikimisi)
4. **Save** → Valmis!

---

## 5️⃣ KOHE PEALE - Secrets Lisamine (TÄHTIS!)

GitHub.com'is:
1. Settings → **Secrets and variables** → **Actions**
2. **New repository secret** - Lisage:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | Oma Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Oma Supabase anon key |
| `VITE_GEMINI_API_KEY` | (kui kasutate - optional) |

---

## 6️⃣ Kontrolli Deployment

GitHub'is:
1. Repository → **Actions** tab
2. "Deploy to GitHub Pages" workflow
3. Oodake rohkem valmista (ca 1-2 minutit)
4. Kui GREEN ✅ → Saidi URL all: `https://KASUTAJANIMI.github.io/unexplained-archive/`

---

## 📝 Iga Uue Muudatuse Jaoks

```powershell
# Muudatuste tegemine ja testimine
npm run dev          # Testige

# Commit ja push
git add .
git commit -m "Kirjelda muudatust"
git push origin main

# GitHub Pages uuendub AUTOMAATSELT ~1-2 min
```

---

## 🔍 Testimine

### Kohalik:
```powershell
npm run dev      # Live server - http://localhost:3000
npm run build    # Ehitamine
npm run preview  # Ehitatud versiooni preview
```

### Live:
- Külastage `https://KASUTAJANIMI.github.io/unexplained-archive/`
- Testimiseks kasutage test-kontosid
- Brauseri developer tools (F12) - kontrollige API kutseid

---

## 🚀 Kokkuvõte

| Samm | Staatus | Tegu |
|------|---------|------|
| 1. Build system | ✅ Valmis | Midagi pole vaja teha |
| 2. GitHub repo | ⏳ Tuleb luua | Tehke GitHub'is uus repo |
| 3. Git setup | ⏳ Tuleb initsialiseerida | Käivitage git init + push |
| 4. GitHub Pages | ⏳ Seadistada | Settings > Pages |
| 5. Secrets | ⏳ Lisada | 3 secret muutujat |
| 6. Deploy | ⏳ Automaatne | Push'i järgselt automaatne |

---

## 📞 Probleemsed?

- **Build fail**: Käivitage kohalikult `npm run build` - peaks andma veateate
- **Leht 404**: Kontrollige GitHub Pages seadistust (Settings > Pages)
- **Andmebaas ei ühenda**: Kontrollige Secrets'is URL ja keys
- **CORS viga**: Supabase RLS reeglid - kontrollida tuleb Supabase admin panelist

---

**Juhised tehtud:** 13. Detsember 2025
**Platvorm staatus:** DEPLOYMENT-READY 🎯
