/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.4.1/src/edge-runtime.d.ts" />

import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Get the authorization header from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    // Extract the token and set the session for this request
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error("Auth failed inside function:", userError?.message);
      return new Response(
        JSON.stringify({ error: 'Unauthorized', details: userError?.message }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("User authenticated:", user.id);

    const { amount } = await req.json();
    const MINIMUM_WITHDRAWAL = 10;

    if (!amount || amount < MINIMUM_WITHDRAWAL) {
      return new Response(
        JSON.stringify({ error: `Invalid amount. Minimum is €${MINIMUM_WITHDRAWAL}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 🔒 SECURITY: Check rate limit (max 3 withdrawals per day)
    const { data: rateLimitCheck, error: rateLimitError } = await supabaseClient
      .rpc('check_withdrawal_rate_limit', { p_user_id: user.id });

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError);
      // Continue anyway - don't block on rate limit failures
    } else if (rateLimitCheck && !rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({ 
          error: rateLimitCheck.error,
          remaining: rateLimitCheck.remaining,
          reset_at: rateLimitCheck.reset_at
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Now, perform operations as the service role, but with the user's ID.
    // This is a common pattern for security and data integrity.
    const { data: wallet, error: walletError } = await supabaseClient
      .from('wallets')
      .select('id, balance')
      .eq('user_id', user.id)
      .single();

    if (walletError || !wallet) {
      console.error("Wallet error:", walletError);
      return new Response(
        JSON.stringify({ error: 'Wallet not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (wallet.balance < amount) {
      return new Response(
        JSON.stringify({ error: 'Insufficient balance' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fee = Number((amount * 0.02).toFixed(2));
    const netAmount = Number((amount - fee).toFixed(2));

    // Note: withdrawal_requests table doesn't have wallet_id, only user_id
    // Bank details should be collected from UI - for now using placeholder
    const { data: withdrawal, error: withdrawalError } = await supabaseClient
      .from('withdrawal_requests')
      .insert({
        user_id: user.id,
        amount: amount,
        fee: fee,
        net_amount: netAmount,
        status: 'pending',
        bank_name: 'TBD', // TODO: Collect from UI
        iban: 'TBD', // TODO: Collect from UI
        account_holder: 'TBD', // TODO: Collect from UI
      })
      .select()
      .single();

    if (withdrawalError) {
      console.error("Insert error:", withdrawalError);
      throw withdrawalError;
    }

    console.log(`Withdrawal request created: ${withdrawal.id} for user ${user.id}, amount: €${amount}`);

    // Deduct balance from wallet immediately
    const { error: balanceError } = await supabaseClient
      .from('wallets')
      .update({ 
        balance: wallet.balance - amount,
        reserved: (wallet.reserved || 0) + amount,
        updated_at: new Date().toISOString()
      })
      .eq('id', wallet.id);

    if (balanceError) {
      console.error("Balance update error:", balanceError);
      // Rollback withdrawal request
      await supabaseClient.from('withdrawal_requests').delete().eq('id', withdrawal.id);
      throw balanceError;
    }

    // Create transaction record for history
    await supabaseClient
      .from('transactions')
      .insert({
        from_wallet_id: wallet.id,
        transaction_type: 'withdrawal',
        amount: amount,
        status: 'pending',
        metadata: {
          withdrawal_request_id: withdrawal.id,
          fee: fee,
          net_amount: netAmount,
          description: `Withdrawal request (€${netAmount} after €${fee} fee)`,
        },
      });

    return new Response(
      JSON.stringify({
        success: true,
        withdrawalId: withdrawal.id,
        message: 'Withdrawal requested successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error("General error:", error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});