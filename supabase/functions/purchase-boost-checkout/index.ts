// Purchase Case Boost - Stripe Checkout
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Stripe from 'https://esm.sh/stripe@14.0.0';
import { corsHeaders } from '../_shared/cors.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { caseId, userId, boostType } = await req.json();

    if (!caseId || !userId || !boostType) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get boost pricing
    const { data: pricing, error: pricingError } = await supabase
      .from('boost_pricing')
      .select('*')
      .eq('boost_type', boostType)
      .single();

    if (pricingError || !pricing) {
      return new Response(
        JSON.stringify({ error: 'Invalid boost type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify case ownership
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('id, title, user_id')
      .eq('id', caseId)
      .single();

    if (caseError || !caseData) {
      return new Response(
        JSON.stringify({ error: 'Case not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (caseData.user_id !== userId) {
      return new Response(
        JSON.stringify({ error: 'You can only boost your own cases' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Featured Case Boost - ${pricing.display_name}`,
              description: `Boost "${caseData.title}" for ${pricing.duration_hours} hours`,
              images: ['https://your-domain.com/boost-icon.png'], // Optional
            },
            unit_amount: Math.round(pricing.price * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'case_boost',
        case_id: caseId,
        user_id: userId,
        boost_type: boostType,
      },
      success_url: `${req.headers.get('origin')}/cases/${caseId}?boost=success`,
      cancel_url: `${req.headers.get('origin')}/cases/${caseId}?boost=cancelled`,
    });

    return new Response(
      JSON.stringify({ 
        url: session.url,
        sessionId: session.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating boost checkout:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
