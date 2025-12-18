// Supabase Edge Function: retry-webhook
// Manually retry a failed webhook event

import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Stripe from 'https://esm.sh/stripe@14.9.0?target=deno';

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { failureId } = await req.json();

    if (!failureId) {
      return new Response(JSON.stringify({ error: 'failureId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get failure details and increment retry count
    const { data: retryData, error: retryError } = await supabaseAdmin.rpc(
      'retry_failed_webhook',
      { p_failure_id: failureId }
    );

    if (retryError || !retryData?.success) {
      return new Response(
        JSON.stringify({ error: retryData?.error || 'Failed to get webhook data' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Now reprocess the event
    const { event_type, payload } = retryData;

    console.log(`Retrying webhook: ${event_type}, attempt ${retryData.retry_count}`);

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    let success = false;
    let errorMessage = '';

    try {
      // Process based on event type
      switch (event_type) {
        case 'checkout.session.completed': {
          const session = payload.data.object;
          await handleCheckoutCompleted(session, supabaseAdmin);
          success = true;
          break;
        }

        case 'payment_intent.succeeded': {
          const paymentIntent = payload.data.object;
          await handlePaymentIntentSucceeded(paymentIntent, supabaseAdmin);
          success = true;
          break;
        }

        default:
          errorMessage = `Unsupported event type: ${event_type}`;
      }

      if (success) {
        // Mark as resolved
        await supabaseAdmin.rpc('resolve_webhook_failure', {
          p_failure_id: failureId,
          p_resolved_by: null, // System resolved
        });

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Webhook successfully reprocessed',
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      } else {
        throw new Error(errorMessage || 'Unknown error');
      }
    } catch (error: any) {
      console.error('Retry failed:', error.message);

      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
          canRetry: retryData.retry_count < 5,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error: any) {
    console.error('Error in retry-webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// Reuse handlers from stripe-webhook
async function handleCheckoutCompleted(session: any, supabaseAdmin: any) {
  const metadata = session.metadata;
  if (!metadata) return;

  const { type, userId, amount, caseId, platformFee, netAmount } = metadata;

  // Platform donation
  if (type === 'donation' && caseId === 'platform') {
    const amountNum = parseInt(amount);

    await supabaseAdmin.from('transactions').insert({
      transaction_type: 'platform_donation',
      amount: amountNum,
      status: 'completed',
      stripe_payment_intent_id: session.payment_intent,
      user_id: userId,
      metadata: {
        userId,
        stripeSessionId: session.id,
        description: `Direct platform support donation: €${amountNum}`,
      },
    });

    await supabaseAdmin.from('platform_revenue').insert({
      amount: amountNum,
      transaction_type: 'platform_donation',
      reference_id: session.payment_intent,
      metadata: {
        userId,
        description: `Direct platform donation (0% fee)`,
      },
    });

    console.log(`Platform donation processed: €${amountNum}`);
  }

  // Case donation
  if (type === 'donation' && caseId && caseId !== 'platform') {
    const amountNum = parseInt(amount);
    const netAmountNum = parseInt(netAmount);
    const platformFeeNum = parseInt(platformFee);

    await supabaseAdmin.rpc('increment_case_escrow', {
      case_id: caseId,
      amount: netAmountNum,
    });

    await supabaseAdmin.from('transactions').insert({
      transaction_type: 'donation',
      case_id: caseId,
      amount: amountNum,
      status: 'completed',
      stripe_payment_intent_id: session.payment_intent,
      metadata: {
        caseId,
        userId,
        stripeSessionId: session.id,
        platformFee: platformFeeNum,
        netAmount: netAmountNum,
        description: `Donation to case (€${netAmountNum} + €${platformFeeNum} fee)`,
      },
    });

    await supabaseAdmin.from('platform_revenue').insert({
      amount: platformFeeNum,
      transaction_type: 'donation',
      reference_id: session.payment_intent,
      metadata: {
        sourceTransaction: 'donation',
        caseId,
        userId,
        description: `Platform fee from donation to case ${caseId}`,
      },
    });

    console.log(`Donation processed: €${amountNum} to case ${caseId}`);
  }

  // Wallet deposit
  if (type === 'wallet_deposit' && userId) {
    const amountNum = parseInt(amount);
    await supabaseAdmin.rpc('add_user_balance', {
      p_user_id: userId,
      p_amount: amountNum,
      p_description: `Stripe deposit of €${amountNum}`,
      p_stripe_id: session.payment_intent,
    });

    console.log(`Wallet deposit processed: €${amountNum} for user ${userId}`);
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: any, supabaseAdmin: any) {
  if (!paymentIntent.metadata) return;

  const { type, userId, amount, caseId } = paymentIntent.metadata;

  if (type === 'wallet_deposit' && userId && amount) {
    console.log('Processing wallet deposit from payment_intent:', userId, amount);
    await supabaseAdmin.rpc('add_user_balance', {
      p_user_id: userId,
      p_amount: parseInt(amount),
      p_description: `Stripe deposit of €${amount}`,
      p_stripe_id: paymentIntent.id,
    });
  }
}
