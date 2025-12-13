# 🚀 Git Setup - Kuidas Installeerida ja Kasutada

## ⚠️ PROBLEEM
Git ei ole sinu arvutis PATH'is kättesaadav. See on vajalik GitHub'isse push'imiseks.

## ✅ LAHENDUSED

### **Lahendus 1: Git Installer (SOOVITAV - Windows)**

1. Mine https://git-scm.com/download/win
2. Lada **64-bit Git for Windows Setup** - versiooni
3. Käivita installer ja järgi juhiseid:
   - ✅ Vali **"Git from the command line and also from 3rd-party software"**
   - ✅ Muud seadistused saad jätta default'iks
4. Installer lõpus - **Restart PowerShell** (sulgege ja avage uus)
5. Kontrolli et tööd:
   ```powershell
   git --version
   ```

---

### **Lahendus 2: Winget Package Manager (Kiire)**

Kui sul on Winget (Windows 11 default):

```powershell
winget install Git.Git
```

Seejärel restart PowerShell.

---

### **Lahendus 3: Chocolatey (Kui kasutad juba)**

```powershell
choco install git
```

---

## 📋 PÄRAST GIT INSTALLEERIMIST

Tee need sammud ühes PowerShell'i istungis:

```powershell
# 1. Konfigureeri Git (esimene kord)
git config --global user.email "sinu@email.com"
git config --global user.name "Sinu Nimi"

# 2. Kontrolli
git config --global user.email
git config --global user.name

# 3. Mine projekti kausta
cd "c:\Users\operatorBaltania\OneDrive - Perpetual Next\Töölaud\AI_Projekts\unexplained-archive"

# 4. Initsialiseerige repo
git init

# 5. Lisage GitHub remote (asendage USERNAME)
git remote add origin https://github.com/USERNAME/unexplained-archive.git

# 6. Kontrolli
git remote -v
```

---

## 🔄 GIT SETUP SHELL SCRIPT (Copy-Paste)

Kui installeerimine on valmis, tee seda ühe käsuga:

```powershell
# Kopeeri see TERVIK PowerShell'i:

cd "c:\Users\operatorBaltania\OneDrive - Perpetual Next\Töölaud\AI_Projekts\unexplained-archive"
git init
git config user.email "sinu@email.com"
git config user.name "Sinu Nimi"
git add .
git commit -m "Initial commit - Unexplained Archive"
git remote add origin https://github.com/USERNAME/unexplained-archive.git
git branch -M main
git push -u origin main
```

---

## ✅ KONTROLL - Kas GIT TÖÖTAB?

Käivita:
```powershell
git status
git remote -v
git log --oneline -1
```

Kui näed "fatal" või "not a git repository" - midagi ei ole OK.

---

## 🆘 HÄÄLESTUS PROBLEEM?

**Probleem:** `fatal: not a git repository`
- **Lahendus:** Otsesõnalt tee `git init` projekti kausta

**Probleem:** `fatal: Could not read Username`
- **Lahendus:** Tee `git config --global user.email` ja `git config --global user.name`

**Probleem:** `fatal: 'origin' does not appear to be a 'git' repository`
- **Lahendus:** Enne git push'i tee `git remote add origin <URL>`

---

## 📞 KIIRE KONTROLL

```powershell
# Näita git versiooni
git --version

# Näita globaalsed seadistused
git config --global --list

# Näita repo seadistused
git config --local --list
```

---

**OTSUS: Installeeri Git → Käivita SETUP SCRIPT → Valmis!** 🚀

Seejärel võid teha `git push origin main` ja GitHub Pages automaatselt uuendub!
