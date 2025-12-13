// Upgrade or Downgrade Subscription Plan
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import Stripe from 'https://esm.sh/stripe@14.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2023-10-16',
});

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, newPlanCode, billingCycle } = await req.json();

    if (!userId || !newPlanCode || !billingCycle) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get current subscription
    const { data: currentSub, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (subError || !currentSub) {
      return new Response(
        JSON.stringify({ error: 'No active subscription found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Get new plan details
    const { data: newPlan, error: planError } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('plan_code', newPlanCode)
      .eq('is_active', true)
      .single();

    if (planError || !newPlan) {
      return new Response(
        JSON.stringify({ error: 'Invalid plan' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newPrice = billingCycle === 'monthly' 
      ? newPlan.price_monthly 
      : newPlan.price_yearly;

    // 3. Check if it's a Stripe subscription
    if (currentSub.stripe_subscription_id) {
      // ====== STRIPE UPGRADE ======
      return await handleStripeUpgrade(
        stripe,
        supabase,
        currentSub,
        newPlan,
        newPlanCode,
        billingCycle,
        newPrice
      );
    } else {
      // ====== WALLET SUBSCRIPTION UPGRADE ======
      return await handleWalletUpgrade(
        supabase,
        userId,
        currentSub,
        newPlan,
        newPlanCode,
        billingCycle,
        newPrice
      );
    }
  } catch (error: any) {
    console.error('Upgrade subscription error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ====== STRIPE UPGRADE HANDLER ======
async function handleStripeUpgrade(
  stripe: Stripe,
  supabase: any,
  currentSub: any,
  newPlan: any,
  newPlanCode: string,
  billingCycle: string,
  newPrice: number
) {
  try {
    // Get Stripe subscription
    const stripeSubscription = await stripe.subscriptions.retrieve(
      currentSub.stripe_subscription_id
    );

    // Find or create new price in Stripe
    const prices = await stripe.prices.list({
      product: newPlan.stripe_product_id,
      active: true,
      limit: 10,
    });

    const interval = billingCycle === 'monthly' ? 'month' : 'year';
    let stripePriceId = prices.data.find(
      (p) => p.unit_amount === Math.round(newPrice * 100) && p.recurring?.interval === interval
    )?.id;

    if (!stripePriceId) {
      // Create new price
      const newStripePrice = await stripe.prices.create({
        currency: 'eur',
        unit_amount: Math.round(newPrice * 100),
        recurring: { interval },
        product_data: {
          name: `${newPlan.plan_name} - ${billingCycle}`,
        },
      });
      stripePriceId = newStripePrice.id;
    }

    // Update Stripe subscription
    const updatedSubscription = await stripe.subscriptions.update(
      currentSub.stripe_subscription_id,
      {
        items: [
          {
            id: stripeSubscription.items.data[0].id,
            price: stripePriceId,
          },
        ],
        proration_behavior: 'always_invoice', // Pro-rate immediately
      }
    );

    // Update database (also resume if it was canceled)
    await supabase
      .from('subscriptions')
      .update({
        plan_type: newPlanCode,
        price: newPrice,
        billing_cycle: billingCycle,
        features: newPlan.features,
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentSub.id);

    // Re-initialize credits for new plan
    await supabase.rpc('initialize_subscription_credits', {
      p_user_id: currentSub.user_id,
      p_subscription_id: currentSub.id,
      p_plan_code: newPlanCode,
      p_billing_cycle: billingCycle,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Subscription upgraded successfully! Credits updated.',
        subscription: updatedSubscription,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (stripeError: any) {
    console.error('Stripe upgrade error:', stripeError);
    throw new Error(stripeError.message || 'Failed to upgrade Stripe subscription');
  }
}

// ====== WALLET UPGRADE HANDLER ======
async function handleWalletUpgrade(
  supabase: any,
  userId: string,
  currentSub: any,
  newPlan: any,
  newPlanCode: string,
  billingCycle: string,
  newPrice: number
) {
  // Check if upgrade or downgrade
  const currentPrice = currentSub.price;
  const priceDiff = newPrice - currentPrice;

  // Calculate prorated amount based on remaining time
  const now = new Date();
  const periodEnd = new Date(currentSub.current_period_end);
  const periodStart = new Date(currentSub.current_period_start);
  const totalDays = (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24);
  const remainingDays = (periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  const proratedCharge = (priceDiff * remainingDays) / totalDays;

  if (proratedCharge > 0) {
    // UPGRADE - Need to charge extra
    const { data: wallet } = await supabase
      .from('wallets')
      .select('id, balance')
      .eq('user_id', userId)
      .single();

    if (!wallet || wallet.balance < proratedCharge) {
      return new Response(
        JSON.stringify({
          error: 'Insufficient wallet balance for upgrade',
          requiredAmount: proratedCharge,
          currentBalance: wallet?.balance || 0,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduct prorated amount
    const { error: walletError } = await supabase
      .from('wallets')
      .update({
        balance: wallet.balance - proratedCharge,
        updated_at: new Date().toISOString(),
      })
      .eq('id', wallet.id);

    if (walletError) {
      console.error('Wallet update error:', walletError);
      throw new Error('Failed to update wallet balance');
    }

    // Create transaction record
    const { error: txError } = await supabase.from('transactions').insert({
      from_wallet_id: wallet.id,
      to_wallet_id: null,
      user_id: userId,
      amount: proratedCharge,
      transaction_type: 'subscription_fee',
      status: 'completed',
      metadata: {
        subscription_plan: newPlan.plan_name,
        old_plan: currentSub.plan_type,
        new_plan: newPlanCode,
        prorated: true,
        description: `Upgrade to ${newPlan.plan_name} (prorated)`,
      },
    });

    if (txError) {
      console.error('Transaction insert error:', txError);
      // Don't fail the upgrade, just log it
    }

    // Create subscription transaction record
    const { error: subTxError } = await supabase.from('subscription_transactions').insert({
      subscription_id: currentSub.id,
      user_id: userId,
      amount: proratedCharge,
      payment_method: 'wallet',
    });

    if (subTxError) {
      console.error('Subscription transaction insert error:', subTxError);
      // Don't fail the upgrade, just log it
    }
  }

  // Update subscription (also resume if it was canceled)
  await supabase
    .from('subscriptions')
    .update({
      plan_type: newPlanCode,
      price: newPrice,
      billing_cycle: billingCycle,
      features: newPlan.features,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', currentSub.id);

  // Re-initialize credits
  await supabase.rpc('initialize_subscription_credits', {
    p_user_id: userId,
    p_subscription_id: currentSub.id,
    p_plan_code: newPlanCode,
    p_billing_cycle: billingCycle,
  });

  return new Response(
    JSON.stringify({
      success: true,
      message: proratedCharge > 0
        ? `Upgraded successfully! Charged €${proratedCharge.toFixed(2)} prorated.`
        : 'Plan changed successfully! New rate applies next billing cycle.',
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
