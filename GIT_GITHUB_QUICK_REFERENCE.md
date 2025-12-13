# ⚡ GIT & GITHUB PAGES - QUICK REFERENCE

## 🔥 5-MINUTISE SETUP

Kopeeri-kleebi PowerShell'i (asendage KASUTAJANIMI):

```powershell
# 1. NAVIGATE JA GIT INIT
cd "c:\Users\operatorBaltania\OneDrive - Perpetual Next\Töölaud\AI_Projekts\unexplained-archive"
git init
git config user.email "you@example.com"
git config user.name "Your Name"

# 2. LISAGE JA COMMIT
git add .
git commit -m "Initial commit - unexplained archive platform"

# 3. GITHUB REMOTE (Asendage URL!)
git remote add origin https://github.com/KASUTAJANIMI/unexplained-archive.git
git branch -M main
git push -u origin main
```

## 🌐 GITHUB PAGES ACTIVATION (Browser)

1. GitHub'is avage repo sisse
2. Minge **Settings** → **Pages** (left menu)
3. Valiges **Source**: Branch = `main`, Folder = `/root`
4. Klikkige **Save**
5. **Oodake 2 minutit** → Leht on live!

```
🎉 Saidi URL: https://KASUTAJANIMI.github.io/unexplained-archive/
```

## 🔐 SECRETS CONFIGURATION (Browser)

GitHub'is:
1. **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** - Lisage need:

```
Name: VITE_SUPABASE_URL
Value: [Oma Supabase project URL]

Name: VITE_SUPABASE_ANON_KEY
Value: [Oma Supabase anon public key]

Name: VITE_GEMINI_API_KEY (optional)
Value: [Kui kasutate Gemini]
```

## 📝 UPDATE CYCLE (Iga päev)

```powershell
# Kohalikult töötan ja testin
npm run dev

# Kui valmis, commit'i
git add .
git commit -m "Feature: kirjelda muudatust"

# Push GitHub'isse
git push origin main

# 🎉 GitHub Pages uuendub AUTOMAATSELT!
```

## 🧪 TESTING COMMANDS

```powershell
npm run dev         # Live dev server - localhost:3000
npm run build       # Ehitamine (production)
npm run preview     # Ehitatud versiooni preview - localhost:4173
```

## 🐛 DEBUGGING

**Leht näitab 404:**
- Kontrollige Settings > Pages source on õige

**Supabase ei ühenda:**
- Brauseri F12 > Console - vea sõnum?
- Kontrollige Secrets'is URL ja keys
- Kontrollida RLS policies Supabase admin'is

**Build fail:**
- Käivitage `npm run build` lokaalselt
- Veateade peaks näitama probleem

---

## 📊 GIT COMMANDS REFERENCE

```powershell
# Clone (järgmine kord)
git clone https://github.com/KASUTAJANIMI/unexplained-archive.git

# Status
git status

# Add & Commit
git add .
git commit -m "Message"

# Push
git push origin main

# Pull (uuendamisel)
git pull origin main

# Branches
git branch -a           # Näita kõik branches
git checkout -b new     # Looge uus branch
git switch main         # Vahetage branch'i
```

---

## 🎯 CHECKLIST - ESIMENE DEPLOY

- [ ] GitHub repo loodud
- [ ] Git init'ida local'is
- [ ] Push'itud GitHub'isse
- [ ] GitHub Pages aktiveeritud (Settings)
- [ ] Secrets lisatud (Supabase keys)
- [ ] Workflow käivitunud (Actions tab)
- [ ] Deploy õnnestunud ✅
- [ ] Leht kättesaadav brauserist
- [ ] Login testin' - töötab?
- [ ] Map nähtav - toodet?

---

## 🚀 OTSUS: Platvorm on VALMIS! Liikuge edasi!

**Aeg deploymentini:** ~10-15 minutit  
**Aeg GitHub Pages'i uuendamiseni push'i järgselt:** ~1-2 minutit  
**Platvormi staatus:** PRODUCTION-READY ✅

---

*Loodud: 13.12.2025*
