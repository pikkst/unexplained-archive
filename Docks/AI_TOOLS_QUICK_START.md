# 🔬 AI Investigation Tools - Quick Start

## Kiire Alustamine Uurijatele

### Kuidas kasutada AI tööriistu?

1. **Ava juhtum** Investigator Dashboard'is
2. **Klõpsa "AI Tools"** nuppu juhtumi detailvaates
3. **Vali tööriist** 11 võimalusest
4. **Oota tulemusi** (5-60 sekundit)
5. **Vaata analüüsi** ja kasuta tulemusi oma uurimises

---

## 🎯 Millal kasutada milliseid tööriistu?

### 🖼️ Kui sul on PILT:
```
✅ Image Analysis - Analüüsi pilti põhjalikult
✅ Extract Text (OCR) - Loe teksti pildilt
✅ Verify Authenticity - Kontrolli pildi autentsust
```

### 📝 Kui sul on TEKST/KIRJELDUS:
```
✅ Text Analysis - Analüüsi kirjeldust
✅ Timeline Extraction - Loo sündmuste ajatelg
```

### 👥 Kui sul on MITU TUNNISTAJAT:
```
✅ Witness Consistency Check - Kontrolli ütluste konsistentsust
```

### 📍 Kui tead ASUKOHTA:
```
✅ Location Analysis - Analüüsi geograafilist konteksti
```

### 🔍 Kui tahad MUSTRI LEIDA:
```
✅ Pattern Analysis - Leia sarnasusi teiste juhtumitega
✅ Find Similar Cases - Otsi sarnaseid juhtumeid
```

### ❓ Kui vajad JUHISEID:
```
✅ Investigation Questions - Genereeri järgmised sammud
```

### 📄 Kui tahad RAPORTIT:
```
✅ Generate Report - Loo põhjalik raport
```

---

## 💡 3 Sammu Eduks

### Samm 1: Alganalüüs (5 min)
1. Image Analysis (kui on pilt)
2. Text Analysis
3. Vaata confidence skoore (alla 60% = ettevaatust!)

### Samm 2: Süvitsi Uurimine (10 min)
1. OCR (kui pildil on tekst)
2. Witness Consistency (kui mitu tunnistajat)
3. Location Analysis (kui tead asukohta)

### Samm 3: Planeerimine (5 min)
1. Pattern Analysis
2. Investigation Questions
3. Generate Report

**Kokku: 20 minutit täielik AI-toetatud analüüs!**

---

## 🎓 Näited

### Näide 1: UFO Vaatlus + Foto
```
1. Image Analysis 
   → Tuvastab objektid, anomaaliad, valgustus
   
2. Verify Authenticity
   → Kontrollib, kas pilt on võltsitud
   
3. Text Analysis
   → Analüüsib tunnistaja kirjeldust
   
4. Location Analysis
   → Uurib keskkonda ja ilmastikku
   
5. Generate Report
   → Loob professionaalse raporti
```

### Näide 2: Müstiline Sündmus + Mitu Tunnistajat
```
1. Text Analysis
   → Analüüsib peamist kirjeldust
   
2. Witness Consistency Check
   → Võrdleb kõigi tunnistajate ütlusi
   
3. Timeline Extraction
   → Loob ajatelje
   
4. Pattern Analysis
   → Otsib sarnasusi teiste juhtumitega
   
5. Investigation Questions
   → Genererib jätkuküsimused
```

### Näide 3: Kriptiline Dokument Pildil
```
1. Extract Text (OCR)
   → Loeb teksti pildilt
   
2. Text Analysis
   → Analüüsib ekstrakteeritud teksti
   
3. Verify Authenticity
   → Kontrollib dokumendi autentsust
   
4. Generate Report
   → Koostab kokkuvõtte
```

---

## ⚠️ Olulised Nõuanded

### ✅ TEE:
- Kasuta mitut tööriista koos - parim tulemus!
- Kontrolli confidence skoore
- Kinnita AI tulemusi teiste allikatega
- Jaga tulemusi tiimiga

### ❌ ÄRA TEE:
- Ära usaldana AI 100% - see on abivahend
- Ära kasuta ainult ühte tööriista
- Ära ignoreeri madalaid confidence skoore
- Ära jaga sensitiivset infot avalikult

---

## 🔑 Confidence Skooride Tõlgendamine

```
85-100%  ✅ Väga usaldusväärne
70-84%   ✅ Usaldusväärne
60-69%   ⚠️  Ettevaatusega, vajab kinnitust
40-59%   ⚠️  Madal usaldusväärsus
0-39%    ❌ Väga madal, ära kasuta
```

---

## 📱 Kuidas Tööriist Töötab?

```
Kasutaja → AIToolsPanel → aiToolsService → Edge Function → Gemini AI
   ↑                                                              ↓
   ←←←←←←←←←←←←←←← Struktureeritud Tulemused ←←←←←←←←←←←←←←←←←←←←←←
```

1. **Kasutaja** valib tööriista
2. **Frontend** saadab päringu
3. **Service** edastab Supabase Edge Function'ile
4. **Edge Function** suhtleb Google Gemini AI-ga
5. **Gemini AI** analüüsib ja vastab
6. **Tulemused** kuvatakse struktureeritult

**Aeg:** 5-60 sekundit olenevalt tööriistast

---

## 🆘 Abi Vajad?

### Kui tööriist ei tööta:
1. Kontrolli internetiühendust
2. Veendu, et andmed on olemas (pilt, tekst, asukoht)
3. Oota natuke - AI võib olla aeglane
4. Proovi uuesti
5. Kasuta teist tööriista

### Kui tulemused on kummalised:
1. Kontrolli sisendandmete kvaliteeti
2. Proovi täpsema kirjeldusega
3. Kasuta mitut tööriista võrdluseks
4. Madalad confidence skoorid = ettevaatust!

---

## 📚 Rohkem Infot

- **Kasutusjuhend:** `Docks/AI_TOOLS_USER_GUIDE.md`
- **Tehniline dok:** `Docks/AI_TOOLS_TECHNICAL.md`
- **Kokkuvõte:** `Docks/AI_TOOLS_IMPLEMENTATION_SUMMARY.md`

---

**Valmis Kasutamiseks!** 🚀

Alusta oma esimesest AI-toetatud uurimisest täna!
