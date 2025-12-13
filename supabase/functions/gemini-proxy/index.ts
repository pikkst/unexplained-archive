import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { prompt, imageUrl } = await req.json()

    // Get user from auth header
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      )
    }

    // Initialize Supabase client for rate limiting check
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabase = createClient(supabaseUrl!, supabaseAnonKey!)

    // Extract user ID from JWT token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: corsHeaders }
      )
    }

    const userId = user.id

    // Check rate limit (5 calls per day per user)
    const today = new Date().toISOString().split('T')[0]
    const { data: rateLimitData, error: rateLimitError } = await supabase
      .from('gemini_api_calls')
      .select('count', { count: 'exact' })
      .eq('user_id', userId)
      .eq('date', today)

    if (!rateLimitError && rateLimitData && rateLimitData.length > 0) {
      const callCount = rateLimitData[0].count || 0
      if (callCount >= 5) {
        return new Response(
          JSON.stringify({ error: 'Daily rate limit exceeded (5 calls/day)' }),
          { status: 429, headers: corsHeaders }
        )
      }
    }

    // Get Gemini API key from secrets
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: corsHeaders }
      )
    }

    let geminiResponse

    // Call Gemini API
    if (imageUrl) {
      // Image analysis
      geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: 'image/jpeg',
                      data: imageUrl.split(',')[1] || imageUrl,
                    },
                  },
                ],
              },
            ],
          }),
        }
      )
    } else {
      // Text generation
      geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      )
    }

    const result = await geminiResponse.json()

    // Log API call for rate limiting
    await supabase.from('gemini_api_calls').insert({
      user_id: userId,
      prompt: prompt.substring(0, 500),
      date: today,
      timestamp: new Date().toISOString(),
    })

    return new Response(
      JSON.stringify(result),
      {
        status: geminiResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    )
  }
})
