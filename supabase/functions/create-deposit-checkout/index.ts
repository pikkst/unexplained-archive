// Supabase Edge Function: create-deposit-checkout
// Handles creating a Stripe Checkout session for a user to deposit funds into their wallet.

import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Stripe from 'https://esm.sh/stripe@14.9.0?target=deno';

Deno.serve(async (req) => {
  // Handle CORS preflight immediately
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Stripe inside the handler to avoid initialization errors blocking OPTIONS
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const STRIPE_OPERATIONS_ACCOUNT_ID = Deno.env.get('STRIPE_OPERATIONS_ACCOUNT_ID');
    
    if (!STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }
    
    if (!STRIPE_OPERATIONS_ACCOUNT_ID) {
      throw new Error('STRIPE_OPERATIONS_ACCOUNT_ID not configured');
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const { amount, userId } = await req.json();

    if (!amount || !userId || amount < 5) {
      return new Response(JSON.stringify({ error: 'User ID and a minimum amount of €5 are required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user details for Stripe customer info
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id, username')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;
    
    // Get email from auth.users
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (authError) throw authError;
    
    // Create Stripe customer if they don't have one
    let stripeCustomerId = userProfile.stripe_customer_id;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: authUser.user.email,
        metadata: {
          supabase_user_id: userId,
          username: userProfile.username || 'Unknown',
        },
      });
      stripeCustomerId = customer.id;
      
      // Update profile with new Stripe customer ID
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', userId);
    }

    // Create a Stripe Checkout session
    // Deposits go directly to the main Stripe account (Operations account)
    // No transfer needed - money stays in the account and we track it in wallet table
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Wallet Deposit',
            description: `Add €${amount.toFixed(2)} to your Unexplained Archive wallet.`,
          },
          unit_amount: Math.round(amount * 100), // Amount in cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      customer: stripeCustomerId,
      success_url: `${req.headers.get('origin')}/wallet?deposit=success`,
      cancel_url: `${req.headers.get('origin')}/wallet?deposit=canceled`,
      payment_intent_data: {
        metadata: {
          type: 'wallet_deposit',
          userId: userId,
          amount: amount.toString(),
        },
      },
      metadata: {
        type: 'wallet_deposit',
        userId: userId,
        amount: amount.toString(),
      },
    }, {
      stripeAccount: STRIPE_OPERATIONS_ACCOUNT_ID, // Use connected account
    });

    return new Response(JSON.stringify({ sessionId: session.id, checkoutUrl: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error creating deposit checkout session:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error',
      type: error.type || 'unknown',
      details: error.raw?.message || error.toString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
