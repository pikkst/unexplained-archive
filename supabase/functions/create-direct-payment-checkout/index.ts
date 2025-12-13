// Create Stripe Checkout Session for Direct Platform Payments
import { corsHeaders } from '../_shared/cors.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';
const STRIPE_REVENUE_ACCOUNT_ID = Deno.env.get('STRIPE_REVENUE_ACCOUNT_ID') || '';

async function createStripeCheckoutSession(params: any) {
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Stripe API error: ${error}`);
  }
  return await response.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!STRIPE_SECRET_KEY || !STRIPE_REVENUE_ACCOUNT_ID) {
    console.error('Stripe environment variables for direct payments are not set.');
    return new Response(
      JSON.stringify({ error: 'Payment service is not configured.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { amount, productName, productDescription, userId, metadata } = await req.json();

    if (!amount || !productName || !userId || amount < 1) {
      return new Response(
        JSON.stringify({ error: 'Invalid input. Minimum amount is €1.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const session = await createStripeCheckoutSession({
      'mode': 'payment',
      'payment_method_types[]': 'card',
      'line_items[0][price_data][currency]': 'eur',
      'line_items[0][price_data][product_data][name]': productName,
      'line_items[0][price_data][product_data][description]': productDescription || `Payment of €${amount.toFixed(2)}`,
      'line_items[0][price_data][unit_amount]': Math.round(amount * 100).toString(),
      'line_items[0][quantity]': '1',
      'success_url': `${req.headers.get('origin')}/payment?status=success`,
      'cancel_url': `${req.headers.get('origin')}/payment?status=canceled`,
      'metadata[userId]': userId,
      'metadata[paymentType]': metadata?.paymentType || 'direct_payment',
      ...metadata,
      'payment_intent_data[transfer_data][destination]': STRIPE_REVENUE_ACCOUNT_ID,
    });

    return new Response(
      JSON.stringify({ sessionId: session.id, checkoutUrl: session.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating direct payment checkout session:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
