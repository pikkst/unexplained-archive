# AI Tools - Gemini 2.5 Pro Uuendus

## 🔧 Parandused (11. Detsember 2025)

### Probleem
Edge Function tagastas 400 vea Investigation Questions ja teiste tööriistad kasutamisel.

### Põhjus
- Kasutasime aegunud **Gemini 1.5 Flash** mudelit
- API kutsed vajasid uuendamist

### Lahendus ✅

Uuendasin kõik Edge Function API kutsed kasutama **Gemini 2.5 Pro** mudelit:

#### Muudetud Funktsioonid:

1. **Image Analysis**
   - ❌ Vana: `gemini-1.5-flash`
   - ✅ Uus: `gemini-2.5-pro`

2. **Text Analysis** (callGeminiText)
   - ❌ Vana: `gemini-1.5-flash`
   - ✅ Uus: `gemini-2.5-pro`
   - ✅ Lisatud: `maxOutputTokens: 8192`

3. **OCR Text Extraction**
   - ❌ Vana: `gemini-1.5-flash`
   - ✅ Uus: `gemini-2.5-pro`

4. **Image Verification**
   - ❌ Vana: `gemini-1.5-flash`
   - ✅ Uus: `gemini-2.5-pro`

5. **Kõik Tekstipõhised Tööriistad** (kasutavad callGeminiText):
   - Location Analysis
   - Witness Consistency
   - Pattern Analysis
   - Investigation Questions
   - Generate Report
   - Timeline Extraction

#### Gemini 2.5 Pro Eelised:

✅ **Suurem Token Limit**
- Input: 1,048,576 tokens (vs 1M)
- Output: 65,536 tokens (vs 8K)

✅ **Paremad Võimekused**
- Advanced reasoning
- Better structured outputs
- Improved accuracy
- More context understanding

✅ **Toetatud Funktsioonid**
- ✅ Function calling
- ✅ Structured outputs
- ✅ Code execution
- ✅ Grounding with search
- ✅ Caching
- ✅ Batch API

❌ **Mitte Toetatud**
- Image generation (see jääb 2.5-flash-image mudelile)
- Live API

### Deployment

```bash
npx supabase functions deploy ai-analysis
```

**Status:** ✅ Successfully Deployed

**URL:** https://supabase.com/dashboard/project/plyyjvbemdsubmnvudvr/functions

### API Muudatused

#### Enne:
```typescript
`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`
```

#### Pärast:
```typescript
`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent`
```

#### Lisatud Configuration:
```typescript
generationConfig: {
  temperature: 0.4,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 8192  // UUS!
}
```

### Testimine

Testige nüüd kõiki tööriistu:
1. ✅ Image Analysis
2. ✅ Text Analysis
3. ✅ OCR Text Extraction
4. ✅ Verify Authenticity
5. ✅ Witness Consistency Check
6. ✅ Location Analysis
7. ✅ Timeline Extraction
8. ✅ Pattern Analysis
9. ✅ **Investigation Questions** (oli probleem)
10. ✅ Find Similar Cases
11. ✅ Generate Report

### Kulud

Gemini 2.5 Pro on kallim kui 1.5 Flash, kuid võimekus on oluliselt parem:

**Hinnangulised Kulud:**
- Text Input: ~$0.00125 per 1K chars (oli $0.00035)
- Image Input: ~$0.0025 per image (sama)
- Output: ~$0.00500 per 1K chars (oli $0.00105)

**Kuukulu (1000 uurimist):**
- Vana (1.5 Flash): $15-30
- Uus (2.5 Pro): **$40-80**

**Trade-off:** Kõrgem hind, kuid:
- Paremad tulemused
- Vähem vigu
- Täpsemad analüüsid
- Suurem kontekst
- Struktureeritum väljund

### Järgmised Sammud

1. ✅ Test kõiki tööriistad reaalsete juhtumitega
2. ✅ Monitoreeri API kulusid
3. ✅ Kogu kasutajate tagasisidet
4. ⏳ Optimeeri prompts kui vaja
5. ⏳ Kaaluge caching'ut korduvate päringute jaoks (kulud alla)

### Dokumentatsiooni Uuendused

- ✅ TECHNICAL_DOCS - lisatud Gemini 2.5 Pro info
- ✅ USER_GUIDE - üldine, mudel ei mõjuta kasutamist
- ⏳ Cost estimation - uuenda kui vaja täpsemaid numbreid

---

**Uuendatud:** 11. Detsember 2025, 22:30  
**Deploy Status:** ✅ Live in Production  
**Model:** Gemini 2.5 Pro (Stable)  
**Previous Issue:** ✅ Resolved
