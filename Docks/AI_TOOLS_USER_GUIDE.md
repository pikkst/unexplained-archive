# AI Tööriistad Uurijatele - Kasutusjuhend

## Ülevaade

AI Investigation Tools on võimas tööriistade komplekt, mis aitab uurijatel analüüsida juhtumeid Google Gemini AI abil. Tööriistad on spetsiaalselt loodud selgitamata nähtuste ja erakordsete juhtumite uurimiseks.

### 🌍 Google Maps Grounding

Mitmed tööriistad kasutavad **Google Maps groundingut** - see tähendab, et AI teeb reaalajas päringuid Google Maps andmetele, et anda **täpseid geograafilisi andmeid**:

- ✅ Täpsed GPS koordinaadid
- ✅ Verifitseeritud kohtade nimed
- ✅ Lähedal olevad orientirid (5km raadiuses)
- ✅ Tegelikud kaugused ja suunad
- ✅ Maastiku ja keskkonna andmed

**Tööriistad Google Maps groundinguga:**
📝 Text Analysis, 📍 Location Analysis, 🔍 Pattern Analysis, 👥 Witness Consistency, ❓ Investigation Questions, 📊 Report Generation

> **💡 Nõuanne:** Anna alati võimalikult täpsed asukohad (nt "Pirita tee 26, Tallinn" mitte "kusagil Tallinnas"), et saada maksimaalset kasu Google Maps andmetest!

Rohkem infot: [AI_TOOLS_GOOGLE_MAPS_GROUNDING.md](./AI_TOOLS_GOOGLE_MAPS_GROUNDING.md)

## 🎯 Peamised Tööriistad

### 1. **Image Analysis (Pildianalüüs)** 📷
**Eesmärk:** Sügav forensiline visuaalse tõendusmaterjali analüüs

**Mida teeb:**
- Tuvastab pildil olevad objektid ja nähtused
- Leiab anomaaliaid ja selgusetuid elemente
- Analüüsib valgustust, varje ja ajavahemikku
- Hindab pildi kvaliteeti ja võimalikku degradeerumist
- Annab usaldusskoor (0-100%)

**Tulemus:**
- Tuvastatud objektide loend
- Anomaaliate kirjeldus
- Võtmetulemused
- Soovitused edasisteks sammudeks

**Kasutamine:**
- Vajab juhtumi juurde lisatud pilti
- Klõpsa "Image Analysis" nuppu
- Oota 10-30 sekundit tulemusi

---

### 2. **Text Analysis (Tekstianalüüs)** 📝
**Eesmärk:** Tunnistajate ütluste ja juhtumite kirjelduste lingvistiline analüüs

**Mida teeb:**
- Tuvastab sentimenti (emotsionaalne toon)
- Ekstrakteerib võtmesõnad ja fraasid
- Leiab nimeobjektid: inimesed, kohad, kellaajad, organisatsioonid
- Hindab usaldusväärsust
- Märgib vastuolud ja kahtlased elemendid

**Tulemus:**
- Sentiment ja emotsionaalne toon
- Võtmesõnade loend
- Tuvastatud isikud, kohad, ajad
- Usaldusväärsuse skoor
- Võimalikud vastuolud

---

### 3. **Extract Text (OCR)** 👁️
**Eesmärk:** Piltidelt teksti lugemine ja ekstraheerimine

**Mida teeb:**
- Loeb silte, märke, tänavasilte
- Ekstrakteerib dokumente, märkmeid
- Tuvastab numbrimärke, sõiduki märgised
- Loeb ajatempleid, kuupäevi
- Tõlgib võõrkeelseid tekste

**Tulemus:**
- Ekstrakteeritud tekst
- Teksti asukoht pildil
- Tuvastatud keeled
- Tõlked vajadusel

**Kasutamine:**
- Ideaalne piltidele, kus on näha teksti
- Sobib dokumentide, siltide, numbrimärkide analüüsimiseks

---

### 4. **Verify Authenticity (Autentsuse Kontrollimine)** 🛡️
**Eesmärk:** Pildi manipuleerimise ja võltsimise tuvastamine

**Mida teeb:**
- Kontrollib kompressiooniartefakte
- Analüüsib valgustuse ja varjude konsistentsust
- Otsib kloontempli mustreid
- Tuvastab värvi/tooni ebajärjepidevusi
- Kontrollib metaandmete võimalikku manipuleerimist

**Tulemus:**
- Autentne / Potensiaalsed probleemid
- Usaldusskoor (0-100%)
- Leitud probleemide loend
- Detailne analüüs

**Oluline:**
- Ei anna 100% kindlust, vaid professionaalse hinnangu
- Tuleb kombineerida teiste tõendusmaterjalidega

---

### 5. **Witness Consistency Check (Tunnistajate Konsistentsi Kontroll)** 👥
**Eesmärk:** Tunnistajate ütluste vastuolude ja kinnituste tuvastamine

**Mida teeb:**
- Võrdleb mitme tunnistaja ütlusi
- Tuvastab ühiseid detaile (korroboratsioon)
- Leiab vastuolud ja lahknevused
- Hindab iga allika usaldusväärsust
- Märgib puuduva info

**Tulemus:**
- Konsistentsi skoor (0-100%)
- Kinnitatud faktid
- Tuvastatud vastuolud (kõrge/keskmine/madal tähtsus)
- Usaldusväärsuse skoorid allikate kaupa
- Soovitused järelepärimisteks

**Kasutamine:**
- Töötab juhtumiga, kus on mitu kommentaari/tunnistajat
- Mida rohkem ütlusi, seda täpsem analüüs

---

### 6. **Location Analysis (Asukoha Analüüs)** 🗺️ 🌍
**Eesmärk:** Geograafiline kontekst ja keskkonna analüüs **Google Maps andmetega**

**Mida teeb:**
- 📍 Verifitseerib täpsed GPS koordinaadid Google Mapsist
- 🏛️ Tuvastab lähedal olevad orientirid kuni 5km raadiuses (haiglad, politsei, lennujaamad)
- 🏔️ Analüüsib maastikku, kõrgust, veekogesid (Google Maps terrain data)
- 🛣️ Kontrollib ligipääsetavust - teed, avalik transport
- 💡 Hindab valguse saastust ja nähtavust piirkonnas
- ⚡ Analüüsib elektromagnetilist keskkonda (elektrijaamad, tornid)
- 🚔 Leiab lähimad võimukandjad (politsei, kiirabi) koos täpsete kaugustega
- 🏘️ Tuvastab potentsiaalsed tunnistajate piirkonnad

**Tulemus (Google Maps groundinguga):**
- ✅ Täpsed GPS koordinaadid (nt "59.4370, 24.7536")
- ✅ Ametlik kohanimetus Mapsist
- ✅ Maastiku kirjeldus + kõrgus
- ✅ Lähedased orientirid koos täpsete kaugustega (nt "Tallinna Sadam, 2.1km")
- ✅ Ilmastikufaktorid ja valgustus
- ✅ Lähimad võimukandjad (nt "Põhja Politseiprefektuur, 1.2km")
- ✅ Uurimiskohtade soovitused koos koordinaatidega

**Kasutamine:**
- Vajab juhtumi asukoha infot (mida täpsem, seda parem!)
- ✅ HEA: "Pirita tee 26, Tallinn"
- ❌ HALB: "Tallinna piirkonnas"
- Aitab mõista keskkondlikke tingimusi ja leida tunnistajaid
- **Näide:** Kui juhtum toimis "Kadriorus", siis AI leiab täpsed GPS koordinaadid, kirjeldab parki, loetleb lähedased haiglad ja politsei, ning soovitab vaatluspositsioone

---

### 7. **Timeline Extraction (Ajatelje Ekstraheerimine)** ⏰
**Eesmärk:** Kronoloogiliste sündmuste väljavõte ja organiseerimine

**Mida teeb:**
- Ekstrakteerib kõik ajaviidet sündmused
- Sorteerib kronoloogiliselt
- Loob visuaalse ajatelje
- Tuvastab ajalisi märke ja järjestusi

**Tulemus:**
- Visuaalne ajatelg sündmustega
- Iga sündmuse aeg ja kirjeldus
- Kronoloogiline järjestus

**Kasutamine:**
- Kasulik keerukate juhtumite mõistmiseks
- Aitab leida ajalisi mustreid ja vastuolusid

---

### 8. **Pattern Analysis (Mustrite Analüüs)** 🔄
**Eesmärk:** Korduvate mustrite ja sarnasuste tuvastamine teiste juhtumitega

**Mida teeb:**
- Võrdleb sarnaste juhtumitega
- Leiab geograafilisi klastereid
- Tuvastab ajalisi mustreid
- Analüüsib käitumuslikke mustreid
- Klassifitseerib juhtumi täpsemalt

**Tulemus:**
- Korduvad mustrid
- Geograafilised klastrid
- Ajalised mustrid
- Unikaalsed aspektid
- Klassifikatsioon
- Tööhüpotees
- Soovitatud ekspertide konsultatsioonid

---

### 9. **Investigation Questions (Uurimisküsimused)** ❓
**Eesmärk:** AI-genereeritud küsimused ja tegevusjuhised uurimise edendamiseks

**Mida teeb:**
- Genereerib kriitilised küsimused, millele vastuseid vajatakse
- Pakub tunnistajatele küsimusi
- Soovitab ekspertide konsultatsioone
- Loetleb otsitavaid tõendeid
- Prioritiseerib tegevused

**Tulemus:**
- Kriitilised küsimused
- Tunnistajate küsimused
- Ekspertide konsultatsioonid (koos küsimustega)
- Otsitavad tõendid
- Järelkontrolli tegevused (prioriteediga)
- Hindab uurimisaega

**Kasutamine:**
- Aitab planeerida järgmisi samme
- Annab struktuuri uurimisele

---

### 10. **Find Similar Cases (Sarnased Juhtumid)** 🔍
**Eesmärk:** Sarnaste juhtumite otsimine andmebaasist

**Mida teeb:**
- Otsib sarnase kategooria juhtumeid
- Võrdleb kirjeldusi ja omadusi
- Näitab seotud juhtumeid

**Tulemus:**
- Sarnaste juhtumite loend
- Kategooria, staatus, kuupäev
- Linkimine detailidele

---

### 11. **Generate Report (Raporti Genereerimine)** 📄
**Eesmärk:** Põhjaliku uurimisraporti loomine

**Mida teeb:**
- Kogub kõik juhtumi andmed
- Struktureerib informatsiooni
- Loob professionaalse raporti

**Tulemus:**
- Täielik uurimisraport sisaldades:
  - Kokkuvõtet
  - Võtmetõendeid
  - Sündmuste ajalugu
  - Analüüsi ja tulemusi
  - Järeldusi
  - Soovitusi järgmisteks sammudeks

**Kasutamine:**
- Allalaetav tekstifail
- Kopeeritav lõikelauale

---

## 💡 Parimad Tavad

### Enne Tööriistad Kasutamist:
1. **Veendu, et juhtumis on piisavalt infot** - mida rohkem detaile, seda täpsem analüüs
2. **Lisa kvaliteetne pilt** - pildianalüüsi jaoks on vaja selget pilti
3. **Kirjelda täpselt** - detailne kirjeldus annab paremaid tulemusi

### Tööriistad Kombineerides:
1. **Alusta Image Analysis või Text Analysis** - need annavad ülevaate
2. **Kasuta Consistency Check** - kui on mitu tunnistajat
3. **Rakenda Pattern Analysis** - et mõista konteksti
4. **Lõpeta Investigation Questions** - et planeerida järgmisi samme
5. **Genereeri Report** - kokkuvõtteks

### Tulemuste Kasutamine:
- **Usaldusskoorid alla 60%** - võta ettevaatusega, vajab täiendavat kontrollimist
- **Usaldusskoorid 60-80%** - usaldusväärsed, kuid kinnita teiste allikatega
- **Usaldusskoorid üle 80%** - kõrge usaldusväärsus

### Hoiatused:
⚠️ **AI ei asenda inimuurijat** - tööriistad on abivahendid, mitte lõplikud vastused
⚠️ **Kontrolli alati** - AI võib eksida, kinnita tulemusi
⚠️ **Kombineeri allikaid** - ära tugine ainult ühele analüüsile
⚠️ **Aeg ja kulud** - igakord kui kasutad tööriista, kulutatakse API päringuid

---

## 🚀 Kiire Alustamine

### Näide 1: UFO vaatlus fotoga
1. ✅ Image Analysis - tuvasta objekt, valgustus
2. ✅ Verify Authenticity - kontrolli pilt
3. ✅ Text Analysis - analüüsi tunnistaja kirjeldust
4. ✅ Location Analysis - kontrolli keskkonda
5. ✅ Generate Report - koosta raport

### Näide 2: Mitmete tunnistajatega juhtum
1. ✅ Text Analysis - analüüsi peamine kirjeldus
2. ✅ Consistency Check - võrdle kõiki ütlusi
3. ✅ Timeline Extraction - loo sündmuste ajatelg
4. ✅ Investigation Questions - genereeri jätkuküsimused

### Näide 3: Keereline juhtum dokumentidega
1. ✅ Extract Text (OCR) - loe dokumente piltidelt
2. ✅ Image Analysis - analüüsi visuaale
3. ✅ Pattern Analysis - otsi sarnasusi
4. ✅ Generate Report - koosta kokkuvõte

---

## 🔧 Tehnilised Detailid

### Tehnoloogia:
- **AI Mudel:** Google Gemini 1.5 Flash / 2.5 Flash Image
- **Keel:** Eesti ja inglise keel
- **Töötlemine:** Edge Functions (serveripoolne)
- **Turvalisus:** Autenditud kasutajad, logitud API kasutus

### Piirangud:
- Pildi maksimaalne suurus: ~10 MB
- Teksti pikkus: kuni ~30,000 tähemärki
- Töötlemisaeg: 5-60 sekundit
- Keeled: Eesti, inglise, saksa, vene (automaatne tuvastamine)

### Veakäsitlus:
- Kui tööriist ebaõnnestub, proovi uuesti
- Kontrolli internetiühendust
- Kui pilt ei laadi, kontrolli faili formaati (JPEG, PNG, GIF)
- Kui tekst ei analüüsita, kontrolli et kirjeldus ei ole liiga lühike

---

## 📊 Näited Tulemustest

### Image Analysis Näide:
```
Confidence: 85%
Detected Objects: ["sky", "bright light", "trees", "horizon"]
Anomalies: ["Unusual luminous object without identifiable shape"]
Metadata:
  - Lighting: Night time, artificial light source visible
  - Quality: High resolution, minimal compression
  - Estimated Time: Night (11 PM - 2 AM based on sky darkness)
Key Findings:
  1. Bright light source inconsistent with natural phenomena
  2. No visible aircraft lights or navigation markers
  3. Light appears to be self-illuminating
```

### Text Analysis Näide:
```
Sentiment: fearful
Credibility Score: 78%
Keywords: ["bright", "silent", "hovering", "disappeared", "scared"]
Entities:
  - People: ["witness", "John"]
  - Places: ["forest road", "Tartu region"]
  - Times: ["around midnight", "15 minutes"]
Analysis: The witness account shows high emotional engagement 
and specific temporal markers, increasing credibility...
```

---

## 🎓 Koolitused ja Tugi

### Kui vajad abi:
1. Loe see juhend läbi
2. Vaata näiteanalüüse
3. Testi tööriistadel testjuhtumitega
4. Konsulteeri teiste uurijatega

### Tagasiside:
- Kui tööriist ei tööta ootuspäraselt, anna teada
- Soovita uusi funktsioone
- Jaga edu lugusid

---

## 🌟 Eripakkumised

### Premium Investigators:
- Kiirem töötlus
- Rohkem päringuid kuus
- Prioriteetne tugi
- Täiendavad tööriistad

---

**Viimati uuendatud:** 11. detsember 2025
**Versioon:** 2.0 - Enhanced AI Tools
**Powered by:** Google Gemini AI
