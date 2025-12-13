import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!

serve(async (req) => {
  console.log('=== AI-ANALYSIS FUNCTION CALLED ===')
  console.log('Method:', req.method)
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { action, ...params } = body
    console.log('Action:', action)
    console.log('Params:', JSON.stringify(params, null, 2))
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('GEMINI_API_KEY exists:', !!GEMINI_API_KEY)
    console.log('GEMINI_API_KEY length:', GEMINI_API_KEY?.length || 0)
    console.log('GEMINI_API_KEY prefix:', GEMINI_API_KEY?.substring(0, 10) + '...')
    
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    let result;

    switch (action) {
      case 'analyze-image':
        result = await analyzeImage(params.imageUrl, params.caseContext)
        break
      case 'analyze-text':
        result = await analyzeText(params.text, params.analysisType)
        break
      case 'generate-report':
        result = await generateReport(params.caseId, supabase)
        break
      case 'verify-image':
        result = await verifyImage(params.imageUrl)
        break
      case 'extract-timeline':
        result = await extractTimeline(params.caseId, supabase)
        break
      case 'generate-image':
        result = await generateImage(params, supabase)
        break
      case 'extract-text-ocr':
        result = await extractTextOCR(params.imageUrl)
        break
      case 'analyze-location':
        result = await analyzeLocation(params.location, params.description, params.latitude, params.longitude)
        break
      case 'verify-consistency':
        result = await verifyWitnessConsistency(params.caseId, supabase)
        break
      case 'analyze-patterns':
        result = await analyzeCasePatterns(params.caseId, supabase)
        break
      case 'suggest-questions':
        result = await suggestInvestigativeQuestions(params.caseId, supabase)
        break
      default:
        throw new Error('Invalid action')
    }

    console.log('=== SUCCESS - Returning result ===')
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('=== ERROR ===' )
    console.error('Error name:', error.name)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    return new Response(JSON.stringify({ 
      error: error.message,
      errorName: error.name,
      errorStack: error.stack 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

async function analyzeImage(imageUrl: string, caseContext?: string) {
  try {
    // Fetch image as base64 (simplified fetch for Edge Runtime)
    const imageResp = await fetch(imageUrl)
    if (!imageResp.ok) throw new Error(`Failed to fetch image: ${imageResp.statusText}`)
    
    const imageBlob = await imageResp.blob()
    const arrayBuffer = await imageBlob.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    const prompt = `You are an expert forensic image analyst for unexplained phenomena investigations. Analyze this image systematically.
    ${caseContext ? `\n\nCase Context: ${caseContext}` : ''}
    
    Provide a detailed, structured analysis:
    
    1. DETECTED OBJECTS: List all visible objects, entities, or phenomena with confidence levels
    2. ANOMALIES: Identify unusual elements, unexplained features, or inconsistencies
    3. LIGHTING ANALYSIS: Describe light sources, shadows, time of day indicators
    4. IMAGE QUALITY: Assess resolution, clarity, compression, potential degradation
    5. METADATA OBSERVATIONS: Any visible timestamps, location markers, or technical details
    6. KEY FINDINGS: Top 3-5 most significant investigative findings
    7. SUGGESTED ACTIONS: Specific next steps for investigators
    8. CONFIDENCE: Overall analysis confidence (0-100)
    
    CRITICAL: Respond ONLY with valid JSON. Use this exact structure:
    {
      "detectedObjects": ["object1", "object2"],
      "anomalies": ["anomaly1", "anomaly2"],
      "metadata": {
        "lighting": "description",
        "quality": "assessment",
        "estimatedTime": "day/night/twilight",
        "weatherConditions": "if visible"
      },
      "analysis": "detailed narrative analysis",
      "keyFindings": ["finding1", "finding2", "finding3"],
      "suggestedActions": ["action1", "action2", "action3"],
      "confidence": 85
    }`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: 'image/jpeg', data: base64 } }
            ]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95
          }
        })
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`)
    }

    const data = await response.json()
    
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('No response from Gemini API')
    }
    
    const aiText = data.candidates[0].content.parts[0].text
    
    try {
      const jsonStr = aiText.replace(/```json\n?|\n?```/g, '').trim()
      const parsed = JSON.parse(jsonStr)
      
      // Validate structure
      return {
        detectedObjects: Array.isArray(parsed.detectedObjects) ? parsed.detectedObjects : [],
        anomalies: Array.isArray(parsed.anomalies) ? parsed.anomalies : [],
        metadata: parsed.metadata || { lighting: 'unknown', quality: 'unknown' },
        analysis: parsed.analysis || aiText,
        keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
        suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : [],
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 50
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      // Fallback: extract information from text
      return {
        detectedObjects: [],
        anomalies: [],
        metadata: { lighting: 'unknown', quality: 'unknown' },
        analysis: aiText,
        keyFindings: [],
        suggestedActions: [],
        confidence: 50
      }
    }
  } catch (error) {
    console.error('Image analysis error:', error)
    throw new Error(`Image analysis failed: ${error.message}`)
  }
}

async function analyzeText(text: string, analysisType: string) {
  try {
    // Validate input
    const cleanText = text.trim()
    const isTestInput = /^(test|testing|demo|example|sample|placeholder|lorem ipsum)$/i.test(cleanText)
    const isTooShort = cleanText.length < 20
    
    if (isTestInput || isTooShort) {
      return {
        sentiment: 'neutral',
        emotionalTone: 'neutral',
        keywords: isTestInput ? ['test'] : [],
        entities: { people: [], places: [], times: [], organizations: [] },
        temporalMarkers: [],
        credibilityScore: 0,
        analysis: isTestInput 
          ? '⚠️ This appears to be test/placeholder text. Please provide a real case description for meaningful analysis.'
          : '⚠️ Text is too short (less than 20 characters) for meaningful analysis. Please provide a detailed description of at least 50-100 words.',
        keyFindings: ['Insufficient information for analysis'],
        inconsistencies: [],
        suggestedActions: ['Provide detailed case description with specific facts, dates, locations, and witness accounts'],
        confidence: 0
      }
    }

    const prompt = `You are an expert text analyst for criminal and unexplained phenomena investigations with access to geographic data. Analyze this ${analysisType} systematically.

TEXT TO ANALYZE:
"${text}"

Use Google Maps and search to verify any locations mentioned. Provide a comprehensive linguistic and investigative analysis:

1. SENTIMENT: Overall emotional tone (positive/negative/neutral/fearful/excited)
2. KEYWORDS: Most significant terms and phrases (minimum 5)
3. ENTITIES: Named entities - people, places, organizations, dates, times
4. TEMPORAL MARKERS: Time references and chronological indicators
5. CREDIBILITY INDICATORS: Language patterns suggesting reliability or inconsistency
6. KEY FINDINGS: Main investigative findings and important details
7. INCONSISTENCIES: Any contradictions or suspicious elements
8. SUGGESTED ACTIONS: Specific investigative steps based on analysis
9. CONFIDENCE: Analysis confidence (0-100)

CRITICAL: Respond ONLY with valid JSON:
{
  "sentiment": "neutral",
  "emotionalTone": "fearful",
  "keywords": ["keyword1", "keyword2"],
  "entities": {
    "people": ["person1"],
    "places": ["location1"],
    "times": ["time1"],
    "organizations": ["org1"]
  },
  "temporalMarkers": ["marker1"],
  "credibilityScore": 75,
  "analysis": "detailed narrative",
  "keyFindings": ["finding1", "finding2"],
  "inconsistencies": ["issue1"],
  "suggestedActions": ["action1", "action2"],
  "confidence": 80
}`;

    const response = await callGeminiTextWithGrounding(prompt)
    const parsed = parseJSON(response)
    
    // Validate and structure
    return {
      sentiment: parsed.sentiment || 'neutral',
      emotionalTone: parsed.emotionalTone || parsed.sentiment,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      entities: parsed.entities || { people: [], places: [], times: [], organizations: [] },
      temporalMarkers: Array.isArray(parsed.temporalMarkers) ? parsed.temporalMarkers : [],
      credibilityScore: typeof parsed.credibilityScore === 'number' ? parsed.credibilityScore : 50,
      analysis: parsed.analysis || 'Analysis completed',
      keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
      inconsistencies: Array.isArray(parsed.inconsistencies) ? parsed.inconsistencies : [],
      suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : [],
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 50
    }
  } catch (error) {
    console.error('Text analysis error:', error)
    throw new Error(`Text analysis failed: ${error.message}`)
  }
}

async function generateReport(caseId: string, supabase: any) {
  const { data: caseData } = await supabase
    .from('cases')
    .select(`
      *,
      comments(content, created_at, profiles(username)),
      profiles:user_id(username)
    `)
    .eq('id', caseId)
    .single()

  if (!caseData) throw new Error('Case not found')

  // Validate case data
  const description = (caseData.description || '').toLowerCase().trim()
  const isTestCase = /^(test|testing|demo|example|sample)(\s+case|\s+juhtum)?$/i.test(description)
  const isTooShort = description.length < 30
  
  if (isTestCase) {
    return { 
      report: `INVESTIGATION REPORT - ${caseData.title}\n\n` +
              `⚠️ WARNING: This appears to be a test/placeholder case.\n\n` +
              `Case ID: ${caseData.id}\n` +
              `Location: ${caseData.location}\n` +
              `Date: ${caseData.incident_date}\n` +
              `Status: ${caseData.status}\n\n` +
              `DESCRIPTION:\n${caseData.description}\n\n` +
              `ANALYSIS:\n` +
              `This case contains minimal information and appears to be a test entry. ` +
              `A comprehensive investigation report cannot be generated without:\n` +
              `- Detailed incident description (minimum 100 words)\n` +
              `- Specific witness accounts\n` +
              `- Timeline of events\n` +
              `- Evidence documentation\n\n` +
              `RECOMMENDATION:\n` +
              `Please update this case with complete incident details before generating an investigation report.`
    }
  }
  
  if (isTooShort) {
    return { 
      report: `INVESTIGATION REPORT - ${caseData.title}\n\n` +
              `⚠️ INSUFFICIENT INFORMATION\n\n` +
              `Case ID: ${caseData.id}\n` +
              `Location: ${caseData.location}\n` +
              `Date: ${caseData.incident_date}\n` +
              `Status: ${caseData.status}\n\n` +
              `DESCRIPTION:\n${caseData.description}\n\n` +
              `ANALYSIS:\n` +
              `The case description is too brief for comprehensive analysis. ` +
              `A professional investigation report requires detailed information including:\n` +
              `- Complete incident narrative (what, when, where, who, how)\n` +
              `- Multiple witness accounts if available\n` +
              `- Chronological timeline\n` +
              `- Environmental conditions\n` +
              `- Evidence documentation\n\n` +
              `RECOMMENDATION:\n` +
              `Gather additional information from witnesses and update case description before generating full report.`
    }
  }

  const prompt = `Generate a professional investigative report for this case, using Google Maps and search to verify locations and add geographic context:

Title: ${caseData.title}
Category: ${caseData.category}
Location: ${caseData.location}
Date: ${caseData.incident_date}
Status: ${caseData.status}

Description:
${caseData.description}

${caseData.comments?.length ? `Witness Comments (${caseData.comments.length}):\n${caseData.comments.map((c: any) => `- ${c.profiles?.username}: ${c.content}`).join('\n')}` : ''}

Generate a structured report with verified geographic details:
1. Executive Summary (with exact location verification from Maps)
2. Geographic Context (verified landmarks, distances, terrain from Maps)
3. Key Evidence
4. Timeline of Events
5. Analysis & Findings (including environmental factors from Maps)
6. Conclusion
7. Recommended Next Steps (with specific locations from Maps)`

  const report = await callGeminiTextWithGrounding(prompt)
  return { report }
}

async function verifyImage(imageUrl: string) {
  const imageResp = await fetch(imageUrl)
  const imageBlob = await imageResp.blob()
  const arrayBuffer = await imageBlob.arrayBuffer()
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

  const prompt = `Analyze this image for signs of manipulation or forgery:

Look for:
- Compression artifacts
- Inconsistent lighting/shadows
- Edge artifacts around objects
- Color/tone inconsistencies
- Metadata tampering
- Clone stamp patterns

Provide JSON response with: authentic (boolean), confidence (0-100), issues (array of strings), analysis (detailed text)`

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: 'image/jpeg', data: base64 } }
          ]
        }],
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.95
        }
      })
    }
  )

  const data = await response.json()
  const aiText = data.candidates[0].content.parts[0].text
  return parseJSON(aiText)
}

async function extractTimeline(caseId: string, supabase: any) {
  const { data: caseData } = await supabase
    .from('cases')
    .select('description, incident_date, comments(content, created_at)')
    .eq('id', caseId)
    .single()

  if (!caseData) return { timeline: [] }

  const allText = `${caseData.description}\n${caseData.comments?.map((c: any) => c.content).join('\n')}`

  const prompt = `Extract a chronological timeline of events from this case description:

${allText}

Return JSON array of objects with: time (ISO date or relative time), event (description)
Sort by chronological order.`

  const response = await callGeminiText(prompt)
  const timeline = parseJSON(response)
  return { timeline: Array.isArray(timeline) ? timeline : [] }
}

async function generateImage(params: any, supabase: any) {
  const { userId, caseId, description, category, location } = params

  let forensicPrompt = 'FORENSIC WITNESS RECONSTRUCTION: ';
  forensicPrompt += 'Create a photorealistic visualization based STRICTLY on witness testimony. ';
  forensicPrompt += 'Act as a forensic artist - NO creative interpretation, NO artistic license, NO embellishments. ';
  forensicPrompt += 'Recreate ONLY what is explicitly stated. ';
  
  forensicPrompt += '\n\nWITNESS STATEMENT (primary source - recreate EXACTLY): "' + description + '". ';
  
  if (location) {
    forensicPrompt += '\n\nLOCATION: ' + location + '. Show accurate environmental context. ';
  }
  
  if (category) {
    forensicPrompt += '\n\nCATEGORY: ' + category + ' (contextual reference only, prioritize witness description). ';
  }
  
  forensicPrompt += '\n\nFORENSIC GUIDELINES: ';
  forensicPrompt += '- Photorealistic documentary evidence style. ';
  forensicPrompt += '- Objective witness perspective. ';
  forensicPrompt += '- Accurate environmental context. ';
  forensicPrompt += '- Neutral lighting unless witness specified otherwise. ';
  forensicPrompt += '- No dramatic effects unless explicitly mentioned. ';
  forensicPrompt += '- Focus ONLY on witness-described elements. ';
  
  forensicPrompt += '\n\nSTRICTLY AVOID: ';
  forensicPrompt += 'Aurora borealis/northern lights (unless witness mentioned), ';
  forensicPrompt += 'cartoon/fantasy style, ';
  forensicPrompt += 'science fiction movie effects, ';
  forensicPrompt += 'elements NOT in witness statement, ';
  forensicPrompt += 'artistic embellishments, ';
  forensicPrompt += 'speculative additions. ';
  
  forensicPrompt += '\n\nRender ONLY what witness explicitly described.';

  console.log('=== GENERATE IMAGE FUNCTION ===')
  console.log('Prompt length:', forensicPrompt.length)
  console.log('Prompt preview:', forensicPrompt.substring(0, 200) + '...')
  console.log('API Key for request:', GEMINI_API_KEY?.substring(0, 15) + '...')
  
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GEMINI_API_KEY}`
  console.log('API URL (without key):', apiUrl.split('?')[0])
  
  const response = await fetch(
    apiUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: forensicPrompt
          }]
        }],
        generationConfig: {
          responseModalities: ['IMAGE']
        }
      }),
    }
  );
  
  console.log('=== GEMINI API RESPONSE ===')
  console.log('Response status:', response.status)
  console.log('Response statusText:', response.statusText)
  console.log('Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries())))

  const aiData = await response.json();
  console.log('Response data keys:', Object.keys(aiData))
  
  // Log for debugging
  if (aiData.error) {
    console.error('=== GEMINI API ERROR ===')
    console.error('Full error:', JSON.stringify(aiData.error, null, 2));
    throw new Error(aiData.error.message || 'Gemini API error: ' + JSON.stringify(aiData.error));
  }
  
  console.log('Candidates count:', aiData.candidates?.length || 0)
  
  let base64Image = null;
  for (const candidate of aiData.candidates || []) {
    for (const part of candidate.content?.parts || []) {
      if (part.inline_data?.data) {
        base64Image = part.inline_data.data;
        break;
      }
      // Also check inlineData (camelCase)
      if (part.inlineData?.data) {
        base64Image = part.inlineData.data;
        break;
      }
    }
    if (base64Image) break;
  }
  
  if (!base64Image) {
    console.error('=== NO IMAGE IN RESPONSE ===')
    console.error('Full AI response:', JSON.stringify(aiData, null, 2));
    console.error('Candidates:', JSON.stringify(aiData.candidates, null, 2));
    throw new Error('No image generated by AI. Response: ' + JSON.stringify(aiData).substring(0, 500));
  }
  
  console.log('Image found! Base64 length:', base64Image.length)

  // Convert base64 to Blob/File for upload
  const binString = atob(base64Image);
  const bytes = new Uint8Array(binString.length);
  for (let i = 0; i < binString.length; i++) {
    bytes[i] = binString.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'image/png' }); // Deno blob

  const fileName = `ai-generated/${Date.now()}.png`;
  const { error: uploadError } = await supabase.storage
    .from('media')
    .upload(fileName, blob, {
      contentType: 'image/png',
      cacheControl: '3600',
    });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from('media').getPublicUrl(fileName);

  // Track AI usage
  if (caseId) {
    await supabase.from('ai_usage').insert({
      user_id: userId,
      feature: 'image_generation',
      cost: 0,
      subscription_id: null,
      metadata: { 
        case_id: caseId, 
        description: description.substring(0, 100),
        category,
        prompt_type: 'forensic_reconstruction',
        prompt: forensicPrompt.substring(0, 300)
      }
    });
  }

  return { imageUrl: urlData.publicUrl }
}

// NEW INVESTIGATIVE TOOLS

async function extractTextOCR(imageUrl: string) {
  try {
    const imageResp = await fetch(imageUrl)
    if (!imageResp.ok) throw new Error(`Failed to fetch image: ${imageResp.statusText}`)
    
    const imageBlob = await imageResp.blob()
    const arrayBuffer = await imageBlob.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    const prompt = `Extract ALL visible text from this image. This is for investigative purposes.

Look for:
- Signs, labels, street names
- Documents, notes, papers
- License plates, vehicle markings
- Timestamps, dates, metadata
- Any handwritten or printed text
- Foreign language text (provide translation if possible)

Respond with JSON:
{
  "extractedText": ["text1", "text2"],
  "textLocations": ["top-left: text", "center: text"],
  "languages": ["en", "et"],
  "translations": {"original": "translation"},
  "confidence": 85,
  "notes": "additional context"
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: 'image/jpeg', data: base64 } }
            ]
          }],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95
          }
        })
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`)
    }

    const data = await response.json()
    
    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      throw new Error('No response from Gemini API')
    }
    
    const aiText = data.candidates[0].content.parts[0].text
    return parseJSON(aiText)
  } catch (error) {
    console.error('OCR extraction error:', error)
    throw new Error(`OCR extraction failed: ${error.message}`)
  }
}

async function analyzeLocation(location: string, description: string, latitude?: number, longitude?: number) {
  try {
    // If we have coordinates, we can proceed even with minimal text info
    const hasCoordinates = latitude && longitude;
    const locationText = location || (hasCoordinates ? `Coordinates: ${latitude}, ${longitude}` : '');
    
    if (!locationText && !hasCoordinates) {
      throw new Error('Location or coordinates required for analysis');
    }
    
    const coordinatesText = hasCoordinates ? `\nGPS COORDINATES: ${latitude}, ${longitude}` : '';
    
    const prompt = `As a geographic and environmental analyst, analyze this location in context of the reported incident. Use Google Maps data when available for accurate geographic information.

LOCATION: ${locationText}${coordinatesText}
INCIDENT: ${description || 'No specific incident description provided - focus on location characteristics'}

Using Google Maps grounding${coordinatesText ? ' and the provided GPS coordinates' : ''}, provide detailed location analysis:

1. EXACT COORDINATES: Precise latitude/longitude if location can be identified
2. GEOGRAPHIC FEATURES: Terrain type, elevation, nearby water bodies, forests, urban/rural classification
3. NEARBY LANDMARKS: Important landmarks within 5km (hospitals, police stations, airports, military bases, observatories)
4. ACCESSIBILITY: Road access, nearest highways, public transport, walking distance to populated areas
5. VISIBILITY FACTORS: Light pollution levels, typical weather patterns, typical cloud cover, obstructions (buildings, trees, hills)
6. ENVIRONMENTAL CONTEXT: Electromagnetic environment (power lines, radio towers), industrial facilities, natural phenomena typical to area
7. INVESTIGATION RESOURCES: Nearest authorities, potential witness pools (residential areas, commercial zones), surveillance camera locations
8. HISTORICAL DATA: Known similar incidents in area, local folklore, scientific research sites nearby

Respond with JSON:
{
  "coordinates": "exact lat,lon from Google Maps",
  "placeName": "official place name from Maps",
  "terrain": "detailed terrain description with elevation",
  "nearbyLandmarks": [{"name": "landmark", "distance": "km", "type": "category"}],
  "weatherFactors": ["factor1", "factor2"],
  "visibility": "detailed visibility assessment",
  "lightPollution": "none/low/medium/high",
  "accessibility": "detailed access information",
  "roadAccess": "description of nearest roads",
  "historicalContext": "relevant history and similar incidents",
  "environmentalFactors": ["factor1 with details", "factor2 with details"],
  "electromagneticEnvironment": "description of EM sources",
  "suggestedSites": ["site1 with coordinates", "site2 with coordinates"],
  "localResources": ["resource1 with location", "resource2 with location"],
  "nearestAuthorities": [{"type": "police/hospital/etc", "name": "name", "distance": "km"}],
  "potentialWitnessAreas": ["area1", "area2"],
  "confidence": 85,
  "dataSource": "Google Maps + local knowledge"
}`;

    const response = await callGeminiTextWithGrounding(prompt)
    return parseJSON(response)
  } catch (error) {
    console.error('Location analysis error:', error)
    throw new Error(`Location analysis failed: ${error.message}`)
  }
}

async function verifyWitnessConsistency(caseId: string, supabase: any) {
  try {
    const { data: caseData } = await supabase
      .from('cases')
      .select(`
        description,
        comments(content, created_at, profiles(username))
      `)
      .eq('id', caseId)
      .single()

    if (!caseData) throw new Error('Case not found')

    const testimonies = [
      { source: 'Original Report', text: caseData.description },
      ...(caseData.comments || []).map((c: any) => ({
        source: c.profiles?.username || 'Anonymous',
        text: c.content
      }))
    ]

    const prompt = `As a forensic interview analyst with access to geographic verification, check consistency across multiple witness statements.

TESTIMONIES:
${testimonies.map((t, i) => `\n${i + 1}. ${t.source}:\n"${t.text}"`).join('\n')}

Use Google Maps to verify any locations mentioned in testimonies. Analyze for:
1. CONSISTENT DETAILS: Facts mentioned by multiple witnesses
2. INCONSISTENCIES: Contradictory statements
3. UNIQUE INFORMATION: Details mentioned by only one source
4. TIMELINE CONSISTENCY: Do time references align?
5. CREDIBILITY ASSESSMENT: Which statements seem most reliable?
6. MISSING INFORMATION: What questions remain unanswered?
7. SUGGESTED FOLLOW-UP: What to investigate further?

Respond with JSON:
{
  "consistentDetails": ["detail1", "detail2"],
  "inconsistencies": [{"detail": "what", "sources": ["source1", "source2"], "severity": "high/medium/low"}],
  "uniqueInformation": [{"source": "who", "detail": "what"}],
  "timelineConsistency": "assessment",
  "credibilityScores": {"source1": 85, "source2": 70},
  "missingInformation": ["question1", "question2"],
  "suggestedFollowUp": ["action1", "action2"],
  "overallConsistency": 75,
  "analysis": "narrative summary"
}`;

    const response = await callGeminiTextWithGrounding(prompt)
    return parseJSON(response)
  } catch (error) {
    console.error('Consistency verification error:', error)
    throw new Error(`Consistency verification failed: ${error.message}`)
  }
}

async function analyzeCasePatterns(caseId: string, supabase: any) {
  try {
    const { data: currentCase } = await supabase
      .from('cases')
      .select('*')
      .eq('id', caseId)
      .single()

    if (!currentCase) throw new Error('Case not found')

    // Get similar cases
    const { data: similarCases } = await supabase
      .from('cases')
      .select('id, title, description, category, location, incident_date, status')
      .eq('category', currentCase.category)
      .neq('id', caseId)
      .limit(10)

    const prompt = `As a pattern recognition analyst with access to geographic data, analyze this case and identify patterns with similar cases.

CURRENT CASE:
Title: ${currentCase.title}
Category: ${currentCase.category}
Location: ${currentCase.location}
Date: ${currentCase.incident_date}
Description: ${currentCase.description}

SIMILAR CASES:
${(similarCases || []).map((c: any, i: number) => `
${i + 1}. ${c.title} (${c.location}, ${c.incident_date})
   ${c.description?.substring(0, 200)}...
`).join('\n')}

Using geographic data and search capabilities, identify:
1. RECURRING PATTERNS: Common elements across cases
2. GEOGRAPHIC CLUSTERS: Location-based patterns
3. TEMPORAL PATTERNS: Time/date patterns
4. BEHAVIORAL PATTERNS: Similar witness behaviors or descriptions
5. UNIQUE ASPECTS: What makes this case different?
6. CLASSIFICATION: Sub-category or specific phenomenon type
7. HYPOTHESIS: Possible explanations based on patterns

Respond with JSON:
{
  "recurringPatterns": ["pattern1", "pattern2"],
  "geographicClusters": "analysis",
  "temporalPatterns": "analysis",
  "behavioralPatterns": ["pattern1", "pattern2"],
  "uniqueAspects": ["aspect1", "aspect2"],
  "classification": "specific type",
  "relatedCaseIds": ["id1", "id2"],
  "hypothesis": "evidence-based theory",
  "confidence": 75,
  "recommendedExperts": ["expert type1", "expert type2"]
}`;

    const response = await callGeminiTextWithGrounding(prompt)
    return parseJSON(response)
  } catch (error) {
    console.error('Pattern analysis error:', error)
    throw new Error(`Pattern analysis failed: ${error.message}`)
  }
}

async function suggestInvestigativeQuestions(caseId: string, supabase: any) {
  try {
    const { data: caseData } = await supabase
      .from('cases')
      .select(`
        *,
        comments(content, created_at)
      `)
      .eq('id', caseId)
      .single()

    if (!caseData) throw new Error('Case not found')

    // Validate case has sufficient information
    const description = (caseData.description || '').toLowerCase().trim()
    const isTestCase = /^(test|testing|demo|example|sample|placeholder|lorem|ipsum)(\s+case|\s+juhtum)?$/i.test(description)
    const isTooShort = description.length < 30
    
    if (isTestCase) {
      return {
        criticalQuestions: ["This appears to be a test case. Please provide a real case description to generate meaningful investigation questions."],
        witnessQuestions: [],
        expertConsultations: [],
        evidenceToSeek: [],
        technicalInvestigations: [],
        followUpActions: [{
          action: "Update case with actual incident details before proceeding with investigation",
          priority: "high",
          timeline: "Immediately"
        }],
        verificationMethods: [],
        priorityLevel: "low",
        estimatedTimeToResolve: "N/A - Test case",
        note: "⚠️ This appears to be a test/placeholder case. Please provide detailed incident information for meaningful analysis."
      }
    }
    
    if (isTooShort) {
      return {
        criticalQuestions: [
          "What exactly happened? (Provide detailed description)",
          "When exactly did this occur? (Date, time, duration)",
          "Where precisely did this take place? (Exact location)",
          "Who witnessed this event? (Number of witnesses, their positions)",
          "What evidence exists? (Photos, videos, physical evidence)"
        ],
        witnessQuestions: ["Please provide a detailed description of at least 50-100 words describing what you witnessed, including sensory details (what you saw, heard, felt)."],
        expertConsultations: [],
        evidenceToSeek: ["Detailed written account of the incident"],
        technicalInvestigations: [],
        followUpActions: [{
          action: "Request comprehensive incident description from reporter",
          priority: "high",
          timeline: "Within 24 hours"
        }],
        verificationMethods: ["Obtain detailed witness account before proceeding"],
        priorityLevel: "medium",
        estimatedTimeToResolve: "Cannot estimate - insufficient information",
        note: "⚠️ Case description is too brief (less than 30 characters). Please provide detailed information for meaningful investigation planning."
      }
    }

    const prompt = `As an experienced investigator with access to geographic and search data, generate strategic questions to advance this investigation.

CASE DETAILS:
Title: ${caseData.title}
Category: ${caseData.category}
Location: ${caseData.location}
Date: ${caseData.incident_date}
Description: ${caseData.description}
Comments: ${caseData.comments?.length || 0} witness statements

Using Google Maps and search capabilities to verify locations and gather context, generate:
1. CRITICAL QUESTIONS: Essential information still needed
2. WITNESS QUESTIONS: Questions for witnesses or reporters
3. EXPERT CONSULTATIONS: What specialists to consult and what to ask
4. EVIDENCE QUESTIONS: What physical evidence to look for
5. TECHNICAL QUESTIONS: Technical aspects to investigate
6. FOLLOW-UP ACTIONS: Specific investigative steps
7. VERIFICATION QUESTIONS: How to verify or debunk claims

Respond with JSON:
{
  "criticalQuestions": ["question1", "question2"],
  "witnessQuestions": ["question1", "question2"],
  "expertConsultations": [{"expert": "type", "questions": ["q1", "q2"]}],
  "evidenceToSeek": ["evidence1", "evidence2"],
  "technicalInvestigations": ["investigation1", "investigation2"],
  "followUpActions": [{"action": "what", "priority": "high/medium/low", "timeline": "when"}],
  "verificationMethods": ["method1", "method2"],
  "priorityLevel": "high/medium/low",
  "estimatedTimeToResolve": "estimate"
}`;

    const response = await callGeminiTextWithGrounding(prompt)
    return parseJSON(response)
  } catch (error) {
    console.error('Question generation error:', error)
    throw new Error(`Question generation failed: ${error.message}`)
  }
}

// HELPER FUNCTIONS

async function callGeminiText(prompt: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192
        }
      })
    }
  )
  
  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`)
  }
  
  const data = await response.json()
  
  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('No response from Gemini API')
  }
  
  return data.candidates[0].content.parts[0].text
}

async function callGeminiTextWithGrounding(prompt: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192
        },
        tools: [{
          google_search_retrieval: {
            dynamic_retrieval_config: {
              mode: "MODE_DYNAMIC",
              dynamic_threshold: 0.3
            }
          }
        }]
      })
    }
  )
  
  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(`Gemini API error: ${errorData.error?.message || response.statusText}`)
  }
  
  const data = await response.json()
  
  if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('No response from Gemini API')
  }
  
  return data.candidates[0].content.parts[0].text
}

function parseJSON(text: string) {
  try {
    const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(jsonStr)
  } catch (error) {
    console.error('JSON parse error:', error)
    return { analysis: text, error: 'Failed to parse JSON response' }
  }
}