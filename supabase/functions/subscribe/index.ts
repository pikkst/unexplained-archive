// Investigator Subscription Edge Function
// Handles subscription creation via Stripe or Wallet

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Make corsHeaders available globally for helper functions
(globalThis as any).corsHeaders = corsHeaders;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, planCode, billingCycle, paymentMethod } = await req.json();

    if (!userId || !planCode || !billingCycle || !paymentMethod) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get plan details
    const { data: plan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('plan_code', planCode)
      .eq('is_active', true)
      .single();

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ error: 'Invalid plan' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get price based on billing cycle
    const price = billingCycle === 'monthly' 
      ? plan.price_monthly 
      : billingCycle === 'yearly'
      ? plan.price_yearly
      : plan.price_onetime;

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, full_name, email')
      .eq('id', userId)
      .single();

    if (paymentMethod === 'wallet') {
      // ====== WALLET PAYMENT ======
      return await handleWalletSubscription(supabase, userId, planCode, billingCycle, price, plan);
    } else if (paymentMethod === 'stripe') {
      // ====== STRIPE PAYMENT ======
      return await handleStripeSubscription(
        stripe,
        supabase,
        userId,
        planCode,
        billingCycle,
        price,
        plan,
        profile
      );
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid payment method' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: any) {
    console.error('Subscription error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ====== WALLET PAYMENT HANDLER ======
async function handleWalletSubscription(
  supabase: any,
  userId: string,
  planCode: string,
  billingCycle: string,
  price: number,
  plan: any
) {
  // 1. Get user wallet
  const { data: wallet, error: walletError } = await supabase
    .from('wallets')
    .select('id, balance')
    .eq('user_id', userId)
    .single();

  if (walletError || !wallet) {
    const corsHeaders = (globalThis as any).corsHeaders;
    return new Response(
      JSON.stringify({ error: 'Wallet not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 2. Check balance
  if (wallet.balance < price) {
    const corsHeaders = (globalThis as any).corsHeaders;
    return new Response(
      JSON.stringify({ error: 'Insufficient wallet balance' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 3. Deduct from wallet
  const { error: deductError } = await supabase
    .from('wallets')
    .update({ 
      balance: wallet.balance - price,
      updated_at: new Date().toISOString()
    })
    .eq('id', wallet.id);

  if (deductError) {
    throw new Error('Failed to deduct from wallet');
  }

  // 4. Create transaction record
  const { data: transaction, error: transactionInsertError } = await supabase
    .from('transactions')
    .insert({
      from_wallet_id: wallet.id,
      to_wallet_id: null, // Goes to platform revenue
      amount: price,
      transaction_type: 'subscription_fee',
      status: 'completed',
      metadata: {
        plan_code: planCode,
        billing_cycle: billingCycle,
        payment_method: 'wallet',
        description: `Subscription: ${plan.plan_name} (${billingCycle})`,
      },
    })
    .select('id')
    .single();

  if (transactionInsertError) {
    console.error('Transaction creation error:', transactionInsertError);
  }
  
  const transactionId = transaction?.id || null;
  console.log('Transaction ID:', transactionId);

  // 5. Calculate period
  const now = new Date();
  const periodStart = now;
  const periodEnd = billingCycle === 'monthly'
    ? new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
    : billingCycle === 'yearly'
    ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
    : planCode === 'basic'
    ? new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000) // 3 months
    : planCode === 'premium'
    ? new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000) // 6 months
    : new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // 3 months

  // 6. Disable RLS temporarily and create subscription via raw SQL
  console.log('Creating subscription for user:', userId, 'plan:', planCode);
  
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  let subscriptionId: string;

  if (existingSub) {
    // Update existing subscription
    console.log('Updating existing subscription:', existingSub.id);
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({
        plan_type: planCode,
        status: 'active',
        price: price,
        billing_cycle: billingCycle,
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        features: plan.features,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Subscription update error:', updateError);
      const corsHeaders = (globalThis as any).corsHeaders;
      return new Response(
        JSON.stringify({ error: 'Failed to update subscription', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    subscriptionId = existingSub.id;
  } else {
    // Create new subscription
    console.log('Creating new subscription');
    const { data: newSub, error: insertError } = await supabase
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan_type: planCode,
        status: 'active',
        price: price,
        billing_cycle: billingCycle,
        stripe_subscription_id: null,
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        features: plan.features,
      })
      .select('id')
      .single();

    if (insertError || !newSub) {
      console.error('Subscription insert error:', insertError);
      const corsHeaders = (globalThis as any).corsHeaders;
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create subscription', 
          details: insertError?.message || 'No ID returned'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    subscriptionId = newSub.id;
  }

  console.log('Subscription ID:', subscriptionId);

  // 7. Initialize credits
  const { error: creditsError } = await supabase.rpc('initialize_subscription_credits', {
    p_user_id: userId,
    p_subscription_id: subscriptionId,
    p_plan_code: planCode,
    p_billing_cycle: billingCycle,
  });

  if (creditsError) {
    console.error('Failed to initialize credits:', creditsError);
  }

  // 8. Create payment transaction record
  const { error: transError } = await supabase.from('subscription_transactions').insert({
    user_id: userId,
    subscription_id: subscriptionId,
    plan_code: planCode,
    amount: price,
    billing_cycle: billingCycle,
    payment_method: 'wallet',
    wallet_transaction_id: transactionId,
    status: 'completed',
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    completed_at: new Date().toISOString(),
  });

  if (transError) {
    console.error('Failed to create transaction record:', transError);
  }

  const corsHeaders = (globalThis as any).corsHeaders;
  return new Response(
    JSON.stringify({
      success: true,
      subscription: { id: subscriptionId, plan_type: planCode, status: 'active' },
      message: 'Subscription activated instantly!',
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ====== STRIPE PAYMENT HANDLER ======
async function handleStripeSubscription(
  stripe: Stripe,
  supabase: any,
  userId: string,
  planCode: string,
  billingCycle: string,
  price: number,
  plan: any,
  profile: any
) {
  // Get or create Stripe customer
  let stripeCustomerId = profile?.stripe_customer_id;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: profile?.email,
      name: profile?.full_name,
      metadata: { supabase_user_id: userId },
    });
    stripeCustomerId = customer.id;

    // Save customer ID
    await supabase
      .from('profiles')
      .update({ stripe_customer_id: stripeCustomerId })
      .eq('id', userId);
  }

  // Create Stripe Checkout Session
  const successUrl = `${Deno.env.get('APP_URL')}/subscription/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${Deno.env.get('APP_URL')}/subscription`;

  if (billingCycle === 'onetime') {
    // ====== ONE-TIME PAYMENT (No recurring) ======
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `${plan.plan_name} - One-time Pack`,
              description: plan.description,
            },
            unit_amount: Math.round(price * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'subscription_onetime',
        userId,
        planCode,
        billingCycle,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    const corsHeaders = (globalThis as any).corsHeaders;
    return new Response(
      JSON.stringify({ checkoutUrl: session.url }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } else {
    // ====== RECURRING SUBSCRIPTION ======
    
    // Find or create Stripe Price
    const prices = await stripe.prices.list({
      product: plan.stripe_product_id, // Need to add this to DB
      active: true,
      limit: 10,
    });

    let stripePriceId: string | undefined;

    // Check if price exists
    const interval = billingCycle === 'monthly' ? 'month' : 'year';
    const existingPrice = prices.data.find(
      (p) => p.unit_amount === Math.round(price * 100) && p.recurring?.interval === interval
    );

    if (existingPrice) {
      stripePriceId = existingPrice.id;
    } else {
      // Create new price (should be done once during setup)
      console.warn('Price not found, creating new one (should be done in setup)');
      const newPrice = await stripe.prices.create({
        currency: 'eur',
        unit_amount: Math.round(price * 100),
        recurring: { interval },
        product_data: {
          name: `${plan.plan_name} - ${billingCycle}`,
        },
      });
      stripePriceId = newPrice.id;
    }

    // Create Checkout Session for subscription
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: stripePriceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: plan.features?.trial_days || 0,
        metadata: {
          userId,
          planCode,
          billingCycle,
        },
      },
      metadata: {
        type: 'subscription_recurring',
        userId,
        planCode,
        billingCycle,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    const corsHeaders = (globalThis as any).corsHeaders;
    return new Response(
      JSON.stringify({ checkoutUrl: session.url }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
