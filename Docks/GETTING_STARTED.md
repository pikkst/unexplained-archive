# 🚀 UNEXPLAINED ARCHIVE - LÕPLIK JUHEND

## ✅ Mis on tehtud

### 1. Backend Infrastructure (Supabase)
- ✅ Andmebaasi skeem (`supabase-schema.sql`)
- ✅ Kasutajate autentimine
- ✅ Profiilid (kasutajad, uurijad, adminid)
- ✅ Juhtumite haldus
- ✅ Kommentaarid ja hääletused
- ✅ Annetuste süsteem
- ✅ Failide üleslaadimise tugi
- ✅ Row Level Security (RLS)

### 2. Frontend Components
- ✅ Autentimissüsteem (login/register)
- ✅ React Router navigatsioon
- ✅ Navbar koos kasutajamenüüga
- ✅ Kaitstud marsruudid (protected routes)
- ✅ AuthContext globaalse oleku jaoks

### 3. Services & API
- ✅ Supabase klient konfiguratsioon
- ✅ Case teenused (CRUD operatsioonid)
- ✅ Kommentaaride teenused
- ✅ Uurijate teenused
- ✅ Annetuste teenused
- ✅ AI pildigeneratsiooni integratsioon
- ✅ Failiüleslaadimise teenused

### 4. Security Features
- ✅ XSS kaitse (DOMPurify)
- ✅ Input validation (Zod)
- ✅ Secure authentication (Supabase Auth)
- ✅ Environment variables
- ✅ RLS policies

### 5. Deployment
- ✅ GitHub Actions workflow
- ✅ Vite config GitHub Pages'ile
- ✅ Production build optimization
- ✅ Deployment dokumentatsioon

## 📋 JÄRGMISED SAMMUD

### SAMM 1: Supabase Seadistamine (15-20 min)

1. Mine [supabase.com](https://supabase.com) ja loo konto
2. Loo uus projekt:
   - Nimi: `unexplained-archive`
   - Vali regioon (nt. Frankfurt)
   - Salvesta andmebaasi parool!
3. Mine **SQL Editor** ja käivita `supabase-schema.sql` sisu
4. Mine **Storage** ja loo bucket:
   - Nimi: `media`
   - Public: ✅
   - File size limit: 50MB
5. Mine **Settings** > **API** ja kopeeri:
   - Project URL
   - anon public key

### SAMM 2: Hugging Face API Key (5 min)

1. Mine [huggingface.co](https://huggingface.co) ja loo konto
2. Mine **Settings** > **Access Tokens**
3. Loo uus token (Read access piisab)
4. Kopeeri token

### SAMM 3: Keskkonna Muutujad

1. Loo `.env` fail projektis:
```bash
cp .env.example .env
```

2. Täida `.env` oma võtmetega:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_HUGGING_FACE_API_KEY=your-hf-token-here
```

### SAMM 4: Kohaliik Testimine

```bash
# Paigalda sõltuvused (kui pole veel tehtud)
npm install

# Käivita dev server
npm run dev
```

Ava brauser: `http://localhost:3000`

**Testi järgmist:**
1. ✅ Registreeri uus konto
2. ✅ Logi sisse
3. ✅ Vaatle kasutajamenüüd
4. ✅ Navigate erinevatel lehekülgedel

### SAMM 5: GitHub Repository

1. Loo uus repo GitHub'is (PUBLIC või PRIVATE)
2. Lae projekt üles:

```bash
git init
git add .
git commit -m "Initial commit: Unexplained Archive"
git branch -M main
git remote add origin https://github.com/SINU-KASUTAJANIMI/unexplained-archive.git
git push -u origin main
```

### SAMM 6: GitHub Secrets

Mine repo **Settings** > **Secrets and variables** > **Actions**

Lisa järgmised secrets:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_HUGGING_FACE_API_KEY`

### SAMM 7: GitHub Pages

1. Mine repo **Settings** > **Pages**
2. Source: **GitHub Actions**
3. Save

### SAMM 8: Deploy

```bash
git push origin main
```

GitHub Actions käivitub automaatselt. Vaata:
- **Actions** tab GitHub'is
- Kui roheline ✅ → deployment õnnestus
- Leht on kättesaadav: `https://SINU-KASUTAJANIMI.github.io/unexplained-archive/`

## 🎯 MIS JÄRGMISENA

### Kohesed Täiendused (Et saada täisfunktsionaalseks)

#### 1. Uuenda olemasolevaid komponente

Järgmised failid vajavad uuendamist, et töötada Supabase'iga:

**Prioriteet 1 (Kriitilised):**
- `LandingPage.tsx` - Lisa link/navigatsioon
- `ExploreCases.tsx` - Ühenda `useCases` hook'iga
- `CaseDetail.tsx` - Ühenda päris andmetega
- `SubmitCaseForm.tsx` - Lisa päris üleslaadimise loogika
- `UserProfile.tsx` - Kuva päris kasutajaandmed

**Prioriteet 2 (Funktsionaalsed):**
- `CaseMap.tsx` - Lisa Leaflet kaart
- `Forum.tsx` - Ühenda kommentaaride API'ga
- `DonationPage.tsx` - Lisa annetuste loogika
- `InvestigatorDashboard.tsx` - Ühenda uurijate API'ga
- `AdminDashboard.tsx` - Lisa admini loogika

#### 2. Lisa puuduvad komponendid

```bash
# Loo need failid:
src/components/CaseCard.tsx          # Juhtumi kaart
src/components/CommentSection.tsx    # Kommentaaride sektsioon
src/components/FileUpload.tsx        # Faili üleslaadija
src/components/LoadingSpinner.tsx    # Laadimise animatsioon
src/components/ErrorMessage.tsx      # Vea teade
```

#### 3. Testi kõik funktsioonid

**Checklist:**
- [ ] Registreerimine ja login
- [ ] Profiili vaatamine/muutmine
- [ ] Juhtumi esitamine (tekst + pilt)
- [ ] AI pildi genereerimine
- [ ] Juhtumite vaatamine kaardil
- [ ] Kommentaaride lisamine
- [ ] Hääletamine
- [ ] Annetuste tegemine
- [ ] Uurijaks saamine
- [ ] Juhtumi uurimine (investigator)
- [ ] Admin dashboard

## 🔧 TROUBLESHOOTING

### Probleem: "Missing Supabase environment variables"
**Lahendus:** Kontrolli, et `.env` fail eksisteerib ja on õigesti täidetud

### Probleem: Build fails GitHub'is
**Lahendus:** Veendu, et kõik secrets on GitHub'is seadistatud

### Probleem: Blank page after deployment
**Lahendus:** 
1. Kontrolli browser console'i
2. Veendu, et `base: './'` on `vite.config.ts`-is
3. Kontrolli, et kõik importid on õiged

### Probleem: Authentication ei tööta
**Lahendus:**
1. Kontrolli Supabase email provider
2. Kontrolli API keys
3. Vaata Supabase dashboard Logs

## 📞 ABI

Kui vajad abi:
1. Kontrolli `SUPABASE_SETUP.md`
2. Kontrolli `DEPLOYMENT.md`
3. Vaata GitHub Actions logs
4. Kontrolli browser console errors

## 🎉 VALMIS!

Kui kõik sammud on tehtud:
- ✅ Supabase backend töötab
- ✅ Frontend on GitHubis
- ✅ GitHub Pages teenindab lehte
- ✅ Kasutajad saavad registreeruda ja sisse logida

**Edasi:**
1. Täienda ülejäänud komponente
2. Testi kõiki funktsioone
3. Lisa custom domain (valikuline)
4. Jaga maailmaga! 🚀

---

**Märkus:** Praegu on backend täielikult valmis, aga mõned frontend komponendid vajavad veel ühendamist Supabase'iga. Järgmine samm on uuendada neid komponente, et kasutada päris andmeid.
