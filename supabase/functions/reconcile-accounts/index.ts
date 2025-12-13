// Daily Reconciliation Job
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

    const results = {
      operations: { expected: 0, actual: 0, diff: 0 },
      revenue: { expected: 0, actual: 0, diff: 0 },
      timestamp: new Date().toISOString()
    };

    // 1. Calculate Expected Operations Balance
    // Sum of all Wallets + Active Case Escrows
    
    // a. Wallets
    const { data: walletsData } = await supabaseAdmin.from('wallets').select('balance');
    const totalWallets = walletsData?.reduce((sum, w) => sum + (w.balance || 0), 0) || 0;
    
    // b. Case Escrows
    const { data: escrowData } = await supabaseAdmin.from('cases').select('current_escrow');
    const totalEscrow = escrowData?.reduce((sum, c) => sum + (c.current_escrow || 0), 0) || 0;
    
    // c. Pending Withdrawals (already deducted from wallet, but still in Operations account until payout)
    const { data: withdrawalsData } = await supabaseAdmin
        .from('withdrawal_requests')
        .select('net_amount')
        .eq('status', 'pending'); // Assuming processing ones are fleeting
    const totalPendingWithdrawals = withdrawalsData?.reduce((sum, w) => sum + (w.net_amount || 0), 0) || 0;

    results.operations.expected = totalWallets + totalEscrow + totalPendingWithdrawals;

    // 2. Get Actual Operations Balance from Stripe
    const opsAccountId = Deno.env.get('STRIPE_OPERATIONS_ACCOUNT_ID');
    if (opsAccountId) {
        try {
            const balance = await stripe.balance.retrieve({ stripeAccount: opsAccountId });
            const available = balance.available.reduce((acc, b) => acc + b.amount, 0) / 100;
            const pending = balance.pending.reduce((acc, b) => acc + b.amount, 0) / 100;
            results.operations.actual = available + pending;
            results.operations.diff = results.operations.actual - results.operations.expected;
            
            // Update DB
            await supabaseAdmin.from('stripe_accounts').upsert({
                account_type: 'operations',
                stripe_account_id: opsAccountId,
                available_balance: available,
                pending_balance: pending,
                db_balance: results.operations.expected,
                reconciliation_diff: results.operations.diff,
                last_reconciled_at: results.timestamp
            }, { onConflict: 'account_type' });
            
        } catch (e) {
            console.error('Failed to fetch Operations balance:', e);
        }
    }

    // 3. Calculate Expected Revenue Balance
    // Sum of platform_revenue table (if we had one separate) OR platform fees transactions
    // Simplified: We check the platform_revenue table we created
    const { data: revenueData } = await supabaseAdmin.from('platform_revenue').select('amount');
    const totalRevenue = revenueData?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
    
    results.revenue.expected = totalRevenue;

    // 4. Get Actual Revenue Balance from Stripe
    const revAccountId = Deno.env.get('STRIPE_REVENUE_ACCOUNT_ID');
    if (revAccountId) {
         try {
            const balance = await stripe.balance.retrieve({ stripeAccount: revAccountId });
            const available = balance.available.reduce((acc, b) => acc + b.amount, 0) / 100;
            const pending = balance.pending.reduce((acc, b) => acc + b.amount, 0) / 100;
            results.revenue.actual = available + pending;
            results.revenue.diff = results.revenue.actual - results.revenue.expected;
            
            // Update DB
            await supabaseAdmin.from('stripe_accounts').upsert({
                account_type: 'revenue',
                stripe_account_id: revAccountId,
                available_balance: available,
                pending_balance: pending,
                db_balance: results.revenue.expected,
                reconciliation_diff: results.revenue.diff,
                last_reconciled_at: results.timestamp
            }, { onConflict: 'account_type' });

        } catch (e) {
            console.error('Failed to fetch Revenue balance:', e);
        }
    }
    
    // Alerting (Console log for now, could be email)
    if (Math.abs(results.operations.diff) > 5) {
        console.error(`⚠️ Operations Account Mismatch: €${results.operations.diff}`);
    }
    if (Math.abs(results.revenue.diff) > 5) {
         console.error(`⚠️ Revenue Account Mismatch: €${results.revenue.diff}`);
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Reconciliation error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});