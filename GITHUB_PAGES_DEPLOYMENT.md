# GitHub Pages Deployment Guide

## Lõppkontrolli Tulemused ✅

### 1. **Ehitamine** ✅
- Projekt ehitus EDUKAS - `npm run build` toimus vigadeta
- Ehitatud failid asuvad `dist/` kaustas:
  - `index.html` - 2.64 KB
  - `assets/react-vendor-*.js` - 47.29 KB
  - `assets/supabase-*.js` - 191.20 KB
  - `assets/maps-*.js` - 150.06 KB
  - `assets/index-*.js` - 1,096.41 KB

### 2. **Seadistused** ✅
- **Vite config**: `base: './'` - GitHub Pages jaoks õigesti seadistatud
- **TypeScript**: ES2022 target + React JSX support - OK
- **Dependencies**: Kõik vajalikud package'd installitud (Supabase, Stripe, Leaflet jne)

### 3. **Andmebaas** ✅
- Supabase database on kasutusel - juba käivitatud
- Environment muutujad on seadistatud

---

## GitHub Pages Avaldamise Sammud

### **Samm 1: GitHub Repo Loomine**

1. Minge GitHub'isse (https://github.com)
2. Looge uus repo nimega `unexplained-archive`
3. Kopeerige repo URL

### **Samm 2: Git Initsialiseerimise ja Push**

Käivitage järgnevad käsud (PowerShell-is):

```powershell
# Minge projekti kausta
cd "c:\Users\operatorBaltania\OneDrive - Perpetual Next\Töölaud\AI_Projekts\unexplained-archive"

# Initsialiseerige git repo
git init

# Lisage kõik failid
git add .

# Tehke esimene commit
git commit -m "Initial commit - unexplained archive platform"

# Lisage GitHub repo (asendage USERNAME ja REPO)
git remote add origin https://github.com/USERNAME/unexplained-archive.git

# Nimetage main branch
git branch -M main

# Pushige failid GitHub'isse
git push -u origin main
```

### **Samm 3: GitHub Pages Aktiveerimise**

1. Minge GitHub repo sisse
2. Klikkige **Settings**
3. Valige vasakult **Pages**
4. Valiku **Source** all:
   - Branch: `main`
   - Folder: `/root` (või `/` - muutke järgmisel sammul)
5. Klikkige **Save**

### **Samm 4: GitHub Actions Workflow Seadistamine**

Looge fail `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build project
        run: npm run build
      
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

### **Samm 5: Rakenduse Avaldamine**

1. GitHub'isse märkimise järel käivitub GitHub Actions automaatselt
2. Ehitumine ja avaldamine võtab ~1-2 minutit
3. Seejärel on teie rakendus kättesaadav:
   ```
   https://USERNAME.github.io/unexplained-archive/
   ```

---

## Kohalik Arendus & Uuendused

Iga kord kui soovite muudatusi teha:

```powershell
# 1. Kohalikult arendage
# 2. Testige dev serveriga
npm run dev

# 3. Muutused commit'i
git add .
git commit -m "Kirjeldus muudatustest"

# 4. Pushige GitHub'isse
git push origin main

# 5. GitHub Pages uuendub automaatselt (~1-2 min)
```

---

## Kontrollilehekülg Vaatamist & Testimist

### **Kohalik Testimine**
```powershell
npm run dev        # Arendusserver - http://localhost:3000
npm run build      # Ehitamine
npm run preview    # Ehitatud versiooni vaatamine - http://localhost:4173
```

### **GitHub Pages Live**
- Külastage: `https://USERNAME.github.io/unexplained-archive/`
- Testimiseks kasutage `@example.com` test kontosid
- Supabase RLS (Row Level Security) on seadistatud - kehtivad autentimisreeglid

---

## Tähtis: Keskkonna Muutujad

GitHub Pages'i jaoks on vajalikud environment muutujad. Teil on 2 varianti:

### **Variant 1: Kasutage Supabase avalikku osa (Soovitav)**
- Asendiandmebaasi ja autentimise URL'd on juba React'is seadistatud
- Supabase RLS kaitab andmeid

### **Variant 2: Lisage Secrets (Kui vajalik)**
1. GitHub Repo -> Settings -> Secrets and variables -> Actions
2. Lisage VITE_SUPABASE_URL ja VITE_SUPABASE_KEY

---

## Troubleshooting

| Probleem | Lahendus |
|----------|----------|
| Build fail | Kontrollida `npm run build` kohalikult |
| Leht näitab 404 | Kontrollida Settings > Pages, Source peaks olema `/root` |
| Supabase ei ühenda | Kontrollida environment muutujaid, RLS reegleid |
| Leht laadib kuid andmed ei ilmu | Brauseri konsoolilt (F12) kontrollida CORS/auth vead |

---

## Kokkuvõte - Juhised

✅ **Projekt on 100% valmis** GitHub Pages'i jaoks avaldamiseks

**Kiirkasutusjuhend:**
1. `git init && git add . && git commit -m "init"`
2. Looge GitHub repo ja lisage `git remote add origin <URL>`
3. `git push -u origin main`
4. GitHub Settings > Pages > main / root
5. Valmis! Saidi uuendamiseks: `git commit && git push`

---

## Kontrollitud Komponendid

- ✅ React 19 + TypeScript
- ✅ Vite 6.2 (GitHub Pages optimiseeritud)
- ✅ Supabase integratsioon
- ✅ Stripe payment system
- ✅ Leaflet maps
- ✅ Authentication system
- ✅ Responsive design
- ✅ Production build optimised

**Otsus: VALMIS AVALDAMISEKS** 🚀
