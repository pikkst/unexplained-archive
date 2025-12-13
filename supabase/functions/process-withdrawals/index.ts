// Process pending withdrawals (Daily Batch Job)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Stripe from 'https://esm.sh/stripe@14.9.0?target=deno';
import { corsHeaders } from '../_shared/cors.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Skip auth for testing - REMOVE IN PRODUCTION
  console.log('AUTH BYPASSED FOR TESTING - Processing withdrawals...');

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Get all pending withdrawals
    const { data: requests, error: fetchError } = await supabaseAdmin
      .from('withdrawal_requests')
      .select('*')
      .eq('status', 'pending')
      .order('requested_at', { ascending: true });

    if (fetchError) throw fetchError;

    if (!requests || requests.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending withdrawals' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${requests.length} withdrawals...`);
    const results = { processed: 0, failed: 0 };

    for (const request of requests) {
      try {
        console.log(`Processing withdrawal ${request.id} for user ${request.user_id}, amount: ${request.amount}`);
        
        // 2. Mark as processing
        await supabaseAdmin
          .from('withdrawal_requests')
          .update({ status: 'processing', processed_at: new Date().toISOString() })
          .eq('id', request.id);

        // 3. Create Stripe Payout from Operations Account
        // NOTE: Get bank details from withdrawal request
        if (!request.iban || !request.account_holder) {
            throw new Error(`Bank details not found for withdrawal request ${request.id}`);
        }
        
        console.log(`Bank details: ${request.bank_name}, IBAN: ${request.iban}, Holder: ${request.account_holder}`);

        const operationsAccountId = Deno.env.get('STRIPE_OPERATIONS_ACCOUNT_ID');
        if (!operationsAccountId) {
            throw new Error('STRIPE_OPERATIONS_ACCOUNT_ID not configured');
        }
        
        console.log(`Using Operations Account: ${operationsAccountId}`);

        // Check if net_amount exists, otherwise calculate it
        const netAmount = request.net_amount || (request.amount - request.fee);
        
        // NOTE: In Stripe TEST mode, we can't actually send money to real bank accounts
        // In PRODUCTION, you would:
        // 1. Add bank account as external account to your Connect account
        // 2. Create payout to that external account
        // 
        // For TEST mode, we'll simulate the payout:
        console.log('TEST MODE: Simulating Stripe payout...');
        console.log(`Would send €${netAmount} to IBAN: ${request.iban}`);
        console.log(`Request details:`, JSON.stringify(request, null, 2));
        
        // Create a mock payout ID for testing
        const mockPayoutId = `po_test_${Date.now()}_${request.id.substring(0, 8)}`;
        
        // In PRODUCTION, uncomment this:
        /*
        const externalAccount = await stripe.accounts.createExternalAccount(
            operationsAccountId,
            {
                external_account: {
                    object: 'bank_account',
                    country: 'EE',
                    currency: 'eur',
                    account_holder_name: request.account_holder,
                    account_holder_type: 'individual',
                    routing_number: request.iban.substring(0, 4),
                    account_number: request.iban,
                }
            }
        );

        const payout = await stripe.payouts.create(
            {
                amount: Math.round(request.net_amount * 100),
                currency: 'eur',
                method: 'standard',
                destination: externalAccount.id,
                description: `Withdrawal for user ${request.user_id}`,
                metadata: {
                    withdrawal_request_id: request.id,
                    user_id: request.user_id
                }
            },
            {
                stripeAccount: operationsAccountId,
            }
        );
        
        await stripe.accounts.deleteExternalAccount(operationsAccountId, externalAccount.id);
        */

        // 4. Update withdrawal request with payout ID and status
        await supabaseAdmin
          .from('withdrawal_requests')
          .update({
            stripe_payout_id: mockPayoutId, // In PRODUCTION: payout.id
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', request.id);

        // 5. Finalize wallet - move reserved to deducted (balance already reduced in request-withdrawal)
        const { data: wallet } = await supabaseAdmin
          .from('wallets')
          .select('*')
          .eq('user_id', request.user_id)
          .single();
          
        if (wallet) {
          await supabaseAdmin
            .from('wallets')
            .update({
              reserved: (wallet.reserved || 0) - request.amount
            })
            .eq('user_id', request.user_id);
        }
        
        // 6. Update original transaction record status
        await supabaseAdmin
          .from('transactions')
          .update({ status: 'completed' })
          .eq('metadata->>withdrawal_request_id', request.id);

        results.processed++;

      } catch (error) {
        console.error(`Failed to process withdrawal ${request.id}:`, error);
        
        // Update status to failed
        await supabaseAdmin.from('withdrawal_requests').update({
          status: 'failed',
          failure_reason: error.message,
          retry_count: (request.retry_count || 0) + 1
        }).eq('id', request.id);
        
        // Un-reserve and return balance to wallet
        const { data: wallet } = await supabaseAdmin
          .from('wallets')
          .select('*')
          .eq('user_id', request.user_id)
          .single();
          
        if (wallet) {
          await supabaseAdmin
            .from('wallets')
            .update({
              balance: (wallet.balance || 0) + request.amount,
              reserved: (wallet.reserved || 0) - request.amount
            })
            .eq('user_id', request.user_id);
        }

        results.failed++;
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Batch processing error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.toString(),
        stack: error.stack
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});