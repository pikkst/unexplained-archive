// Create Stripe Checkout Session - Pure Deno (no NPM packages)
import { corsHeaders } from '../_shared/cors.ts';

// Environment variables
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') || '';
const STRIPE_OPERATIONS_ACCOUNT_ID = Deno.env.get('STRIPE_OPERATIONS_ACCOUNT_ID') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

// Platform fee calculation
const PLATFORM_FEE_PERCENTAGE = 0.10;
function calculatePlatformFee(amount: number): number {
  return Math.round(amount * PLATFORM_FEE_PERCENTAGE);
}
function calculateNetAmount(amount: number): number {
  return amount - calculatePlatformFee(amount);
}

// Native Stripe API call using fetch
async function createStripeCheckoutSession(params: any, stripeAccountId: string) {
  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Account': stripeAccountId, // Use the connected account ID
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
  // Handle CORS preflight requests FIRST
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Environment variable checks
  if (!STRIPE_SECRET_KEY || !STRIPE_OPERATIONS_ACCOUNT_ID) {
    console.error('Stripe environment variables are not set. The payment function cannot operate.');
    return new Response(
      JSON.stringify({ error: 'Payment service is not configured by the administrator.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { caseId, amount, userId, successUrl, cancelUrl } = await req.json();

    // Validate input
    if (!caseId || !amount || !userId || amount < 5) {
      return new Response(
        JSON.stringify({ error: 'Invalid input. Minimum amount is €5.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get auth token from request
    const authHeader = req.headers.get('Authorization') || '';

    // Determine if this is a wallet deposit or case donation
    const isWalletDeposit = caseId === 'wallet_deposit';
    let productName = 'Wallet Deposit';
    let productDescription = `Add €${amount.toFixed(2)} to your wallet`;
    let platformFee = 0;
    let netAmount = amount;

    if (!isWalletDeposit) {
      // Verify case using Supabase REST API (no SDK)
      const caseResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/cases?id=eq.${caseId}&select=id,title,status`,
        {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': authHeader,
          },
        }
      );

      if (!caseResponse.ok) {
        const errorText = await caseResponse.text();
        console.error('Failed to verify case:', errorText);
        return new Response(
          JSON.stringify({ error: 'Failed to verify case' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const cases = await caseResponse.json();
      if (!cases || cases.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Case not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const caseData = cases[0];

      if (caseData.status === 'resolved' || caseData.status === 'closed') {
        return new Response(
          JSON.stringify({ error: 'Cannot donate to closed or solved cases' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Calculate fees for case donations
      platformFee = calculatePlatformFee(amount);
      netAmount = calculateNetAmount(amount);
      productName = `Donation to: ${caseData.title}`;
      productDescription = `Net: €${netAmount.toFixed(2)} | Fee: €${platformFee.toFixed(2)}`;
    }
    
    // Per the architecture, all wallet deposits and case donations go to the Operations account
    const destinationAccountId = STRIPE_OPERATIONS_ACCOUNT_ID;

    // Create Stripe Checkout Session using native fetch
    const session = await createStripeCheckoutSession({
      'mode': 'payment',
      'payment_method_types[]': 'card',
      'line_items[0][price_data][currency]': 'eur',
      'line_items[0][price_data][product_data][name]': productName,
      'line_items[0][price_data][product_data][description]': productDescription,
      'line_items[0][price_data][unit_amount]': Math.round(amount * 100).toString(),
      'line_items[0][quantity]': '1',
      'success_url': successUrl || `${req.headers.get('origin')}${isWalletDeposit ? '/wallet?deposit=success' : `/cases/${caseId}?donation=success`}`,
      'cancel_url': cancelUrl || `${req.headers.get('origin')}${isWalletDeposit ? '/wallet?deposit=canceled' : `/cases/${caseId}?donation=canceled`}`,
      'metadata[caseId]': caseId,
      'metadata[userId]': userId,
      'metadata[type]': isWalletDeposit ? 'wallet_deposit' : 'donation',
      'metadata[amount]': amount.toString(),
      'metadata[platformFee]': platformFee.toString(),
      'metadata[netAmount]': netAmount.toString(),
      // Also attach metadata to the payment intent so it appears in Charge events
      'payment_intent_data[metadata][caseId]': caseId,
      'payment_intent_data[metadata][userId]': userId,
      'payment_intent_data[metadata][type]': isWalletDeposit ? 'wallet_deposit' : 'donation',
      'payment_intent_data[metadata][amount]': amount.toString(),
    }, destinationAccountId);

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        checkoutUrl: session.url,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error creating checkout session:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});