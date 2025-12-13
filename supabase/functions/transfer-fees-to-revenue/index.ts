// Transfer collected fees from Operations to Revenue account (Daily Batch Job)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Stripe from 'https://esm.sh/stripe@14.9.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Verify cron secret
  const authHeader = req.headers.get('Authorization');
  if (authHeader !== `Bearer ${Deno.env.get('CRON_SECRET_KEY')}` && authHeader !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const today = new Date().toISOString().split('T')[0];
    const opsAccountId = Deno.env.get('STRIPE_OPERATIONS_ACCOUNT_ID');
    const revAccountId = Deno.env.get('STRIPE_REVENUE_ACCOUNT_ID');

    if (!opsAccountId || !revAccountId) {
        throw new Error('Stripe account IDs not configured');
    }

    // 1. Calculate fees collected today
    // We look at 'transactions' where type is 'platform_fee' or 'withdrawal_fee'
    const { data: feesData, error } = await supabaseAdmin
      .from('transactions')
      .select('amount')
      .in('transaction_type', ['platform_fee', 'withdrawal_fee'])
      .gte('created_at', `${today}T00:00:00`)
      .lt('created_at', `${today}T23:59:59`);

    if (error) throw error;

    const totalFees = feesData?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    // 2. Calculate direct platform donations (if any went to operations by mistake, or just tracking)
    // Note: If platform donations go DIRECTLY to Revenue account via Checkout, we don't transfer them.
    // This script is for transferring money that LANDED in Operations (like fees deducted from wallet donations).

    if (totalFees > 0) {
      console.log(`Transferring €${totalFees} fees to Revenue Account...`);

      // 3. Create Stripe Transfer
      // NOTE: This assumes 'source_transaction' is not needed if we just transfer balance.
      // If we want to link it, it's harder with batch. Just transferring available balance.
      
      const transfer = await stripe.transfers.create({
        amount: Math.round(totalFees * 100),
        currency: 'eur',
        destination: revAccountId, // To Revenue Account
        description: `Daily fees transfer ${today}`,
        // Source is implicitly the platform account (if Operations is the Platform) 
        // OR we might need to specify source if we are operating on behalf of a connected account.
        // In the "Simplified" model, Operations = Platform (usually). 
        // If Operations is a separate Connect account, we need 'stripe-account' header or 'source' param.
        
        // Assuming Operations = The Main Platform Stripe Account
        // And Revenue = A Connected Standard/Express Account for holding profits
      });

      // 4. Log transfer
      await supabaseAdmin.from('internal_transfers').insert({
        transfer_date: today,
        fees_collected: totalFees,
        total_amount: totalFees,
        stripe_transfer_id: transfer.id,
        status: 'completed',
        completed_at: new Date().toISOString()
      });

      return new Response(JSON.stringify({ 
        success: true, 
        transferred: totalFees, 
        transferId: transfer.id 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
        return new Response(JSON.stringify({ 
            success: true, 
            message: 'No fees to transfer today' 
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

  } catch (error) {
    console.error('Transfer error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});