// Request Background Check - Stripe Checkout
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
    const { userId, checkType = 'standard' } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing user ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is an investigator
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, username, investigator_status')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (profile.role !== 'investigator') {
      return new Response(
        JSON.stringify({ error: 'Only investigators can request background checks' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already has active verification
    const { data: existingCheck } = await supabase
      .from('background_checks')
      .select('id, status, expires_at')
      .eq('investigator_id', userId)
      .in('status', ['pending', 'in_progress', 'completed'])
      .single();

    if (existingCheck && existingCheck.status === 'completed' && 
        (!existingCheck.expires_at || new Date(existingCheck.expires_at) > new Date())) {
      return new Response(
        JSON.stringify({ error: 'You already have an active verification' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Set pricing
    const price = checkType === 'premium' ? 50.00 : 25.00;
    const displayName = checkType === 'premium' ? 'Premium Background Check' : 'Standard Background Check';
    const features = checkType === 'premium' 
      ? ['Identity verification', 'Credential verification', 'Criminal background check', 'Gold verification badge']
      : ['Identity verification', 'Credential verification', 'Blue verification badge'];

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: displayName,
              description: features.join(' • '),
              images: ['https://your-domain.com/verification-badge.png'],
            },
            unit_amount: Math.round(price * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'background_check',
        user_id: userId,
        check_type: checkType,
      },
      success_url: `${req.headers.get('origin')}/profile?verification=success`,
      cancel_url: `${req.headers.get('origin')}/profile?verification=cancelled`,
    });

    return new Response(
      JSON.stringify({ 
        url: session.url,
        sessionId: session.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating verification checkout:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
