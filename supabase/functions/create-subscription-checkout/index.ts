// Create Stripe Checkout Session for subscriptions
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import stripe from '../_shared/stripe.ts';
import { corsHeaders } from '../_shared/cors.ts';

const PLAN_PRICES = {
  investigator_pro: 'price_investigator_pro', // Replace with actual Stripe Price ID
  user_premium: 'price_user_premium',         // Replace with actual Stripe Price ID
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { planType, userId, successUrl, cancelUrl } = await req.json();

    if (!planType || !userId || !PLAN_PRICES[planType as keyof typeof PLAN_PRICES]) {
      return new Response(
        JSON.stringify({ error: 'Invalid plan type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Get user profile
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('id, email, stripe_customer_id')
      .eq('id', userId)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create or get Stripe customer
    let customerId = profile.stripe_customer_id;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: profile.email,
        metadata: { userId: profile.id },
      });
      customerId = customer.id;

      // Update profile with customer ID
      await supabaseClient
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: PLAN_PRICES[planType as keyof typeof PLAN_PRICES],
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${req.headers.get('origin')}/subscription?success=true`,
      cancel_url: cancelUrl || `${req.headers.get('origin')}/subscription?canceled=true`,
      metadata: {
        userId,
        planType,
      },
    });

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        checkoutUrl: session.url,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating subscription checkout:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
