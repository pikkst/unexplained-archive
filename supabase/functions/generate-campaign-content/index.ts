import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent'

serve(async (req) => {
  try {
    // CORS headers
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        }
      })
    }

    const { prompt, contentType, campaignData } = await req.json()

    if (!prompt) {
      return new Response(
        JSON.stringify({ error: 'Prompt is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Build context-aware prompt based on campaign data
    let enhancedPrompt = prompt
    if (campaignData) {
      const context = `
Campaign Context:
- Campaign Name: ${campaignData.name}
- Campaign Type: ${campaignData.type}
- Description: ${campaignData.description || 'N/A'}

Task: ${prompt}

Guidelines:
- Be exciting and engaging
- Use emojis sparingly (1-2 max)
- Keep it concise and actionable
- Focus on the value proposition
- Create urgency without being pushy
- Use professional but friendly tone
`
      enhancedPrompt = context
    }

    // Call Gemini API
    const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: enhancedPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.9,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: contentType === 'banner_text' ? 100 : 500,
        }
      })
    })

    if (!geminiResponse.ok) {
      const error = await geminiResponse.text()
      console.error('Gemini API Error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to generate content', details: error }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const geminiData = await geminiResponse.json()
    const generatedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // For image generation (future enhancement)
    let imageUrl = null
    if (contentType === 'banner_image') {
      // Could integrate with Gemini's image generation or other services
      // For now, return a placeholder
      imageUrl = 'https://via.placeholder.com/1200x400?text=AI+Generated+Banner'
    }

    return new Response(
      JSON.stringify({
        content: generatedText,
        imageUrl: imageUrl,
        model: 'gemini-2.0-flash-exp',
        timestamp: new Date().toISOString()
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  }
})
