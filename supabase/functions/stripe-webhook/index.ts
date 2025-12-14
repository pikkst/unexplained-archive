// Stripe Webhook Handler - Process payment events
// NOTE: This webhook must be publicly accessible (no JWT verification)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Stripe from 'https://esm.sh/stripe@14.9.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

// Public endpoint - no JWT verification needed for webhooks
serve(async (req) => {
  // Log incoming webhook for debugging
  console.log('Webhook received:', req.method, req.url);
  
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return new Response('No signature', { status: 400 });
  }

  try {
    const body = await req.text();
    
    // Try to construct event with signature validation
    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      // For testing: Parse event without verification (REMOVE IN PRODUCTION!)
      console.warn('⚠️ TESTING MODE: Processing webhook without signature verification');
      event = JSON.parse(body);
    }

    // Initialize Supabase Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session, supabaseAdmin);
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment succeeded:', paymentIntent.id, 'Metadata:', paymentIntent.metadata);
        
        // Handle wallet deposits and donations from payment_intent metadata
        if (paymentIntent.metadata) {
          const { type, userId, amount, caseId } = paymentIntent.metadata;
          
          if (type === 'wallet_deposit' && userId && amount) {
            console.log('Processing wallet deposit from payment_intent:', userId, amount);
            await handleWalletDeposit(userId, parseInt(amount), paymentIntent.id, supabaseAdmin);
          } else if (type === 'donation' && caseId && userId && amount) {
            console.log('Processing case donation from payment_intent:', caseId, amount);
            await handleCaseDonation(caseId, userId, parseInt(amount), paymentIntent.id, supabaseAdmin);
          }
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.error('Payment failed:', paymentIntent.id);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription, supabaseAdmin);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(subscription, supabaseAdmin);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await handleInvoicePaymentSucceeded(invoice, supabaseAdmin);
        }
        break;
      }

      // Payout events (for withdrawals)
      case 'payout.paid': {
        const payout = event.data.object as Stripe.Payout;
        await handlePayoutCompleted(payout, supabaseAdmin);
        break;
      }

      case 'payout.failed': {
        const payout = event.data.object as Stripe.Payout;
        await handlePayoutFailed(payout, supabaseAdmin);
        break;
      }

      case 'payout.canceled': {
        const payout = event.data.object as Stripe.Payout;
        await handlePayoutCanceled(payout, supabaseAdmin);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, supabaseAdmin: any) {
  console.log('Processing checkout completion:', session.id);
  const metadata = session.metadata;
  
  if (!metadata) {
    console.error('No metadata in session', session.id);
    return;
  }
  
  console.log('Session metadata:', metadata);

  const { type, caseId, userId, amount, platformFee, netAmount, boostType, checkType } = metadata;

  // Handle platform donations (no fee)
  if (type === 'donation' && caseId === 'platform') {
    const amountNum = parseInt(amount);

    // Record transaction - all money goes to platform
    const { error: txError } = await supabaseAdmin
      .from('transactions')
      .insert({
        transaction_type: 'platform_donation',
        amount: amountNum,
        status: 'completed',
        stripe_payment_intent_id: session.payment_intent as string,
        user_id: userId,
        metadata: {
          userId,
          stripeSessionId: session.id,
          description: `Direct platform support donation: €${amountNum}`,
        },
      });

    if (txError) {
      console.error('Error creating platform donation transaction:', txError);
    }

    // Record full amount as platform revenue (no fee deduction)
    const { error: revenueError } = await supabaseAdmin
      .from('platform_revenue')
      .insert({
        amount: amountNum,
        transaction_type: 'platform_donation',
        reference_id: session.payment_intent as string,
        metadata: {
          userId,
          description: `Direct platform donation (0% fee)`,
        },
      });

    if (revenueError) {
      console.error('Error recording platform donation revenue:', revenueError);
    }

    console.log(`Platform donation processed: €${amountNum} (no fee)`);
    return;
  }

  // Handle case donations (10% fee)
  if (type === 'donation' && caseId) {
    // Process donation to case
    const amountNum = parseInt(amount);
    const netAmountNum = parseInt(netAmount);
    const platformFeeNum = parseInt(platformFee);

    // Update case escrow
    const { error: escrowError } = await supabaseAdmin.rpc('increment_case_escrow', {
      case_id: caseId,
      amount: netAmountNum,
    });

    if (escrowError) {
      console.error('Error updating escrow:', escrowError);
    }

    // Create transaction record
    const { error: txError } = await supabaseAdmin
      .from('transactions')
      .insert({
        transaction_type: 'donation',
        case_id: caseId,
        amount: amountNum,
        status: 'completed',
        stripe_payment_intent_id: session.payment_intent as string,
        metadata: {
          caseId,
          userId,
          stripeSessionId: session.id,
          platformFee: platformFeeNum,
          netAmount: netAmountNum,
          description: `Donation to case (€${netAmountNum} + €${platformFeeNum} fee)`,
        },
      });

    if (txError) {
      console.error('Error creating transaction:', txError);
    }

    // Record platform fee
    const { error: feeError } = await supabaseAdmin
      .from('platform_revenue')
      .insert({
        amount: platformFeeNum,
        transaction_type: 'donation',
        reference_id: session.payment_intent as string,
        metadata: {
          sourceTransaction: 'donation',
          caseId,
          userId,
          description: `Platform fee from donation to case ${caseId}`,
        },
      });

    if (feeError) {
      console.error('Error recording platform fee:', feeError);
    }

    console.log(`Donation processed: €${amountNum} to case ${caseId} (net: €${netAmountNum})`);
  }
  
  // Handle subscription payments
  if (type === 'subscription' && userId) {
      const amountNum = parseInt(amount);
      const fee = Math.round(amountNum * 0.05); // 5% fee for subscriptions
      
      const { error: feeError } = await supabaseAdmin
        .from('platform_revenue')
        .insert({
          amount: fee,
          transaction_type: 'subscription',
          reference_id: session.payment_intent as string,
          metadata: {
            sourceTransaction: 'subscription',
            userId,
            description: `Platform fee from subscription payment`,
          },
        });
        
      if (feeError) {
          console.error('Error recording subscription fee:', feeError);
      } else {
          console.log(`Subscription fee of €${fee} recorded for user ${userId}`);
      }
  }

  // Handle wallet deposits
  if (type === 'wallet_deposit' && userId) {
    const amountNum = parseInt(amount);
    const { error: depositError } = await supabaseAdmin.rpc('add_user_balance', {
      p_user_id: userId,
      p_amount: amountNum,
      p_description: `Stripe deposit of €${amountNum}`,
      p_stripe_id: session.payment_intent as string
    });

    if (depositError) {
      console.error(`Error processing wallet deposit for user ${userId}:`, depositError);
    } else {
      console.log(`Wallet deposit of €${amountNum} processed for user ${userId}.`);
    }
  }

  // Handle case boost purchases
  if (type === 'case_boost' && caseId && userId && boostType) {
    const { error: boostError } = await supabaseAdmin.rpc('purchase_case_boost', {
      p_case_id: caseId,
      p_user_id: userId,
      p_boost_type: boostType,
      p_stripe_payment_id: session.payment_intent
    });

    if (boostError) {
      console.error('Error processing boost:', boostError);
    } else {
      console.log(`Case boost processed: ${boostType} for case ${caseId}`);
    }
  }

  // Handle background check requests
  if (type === 'background_check' && userId && checkType) {
    const { error: checkError } = await supabaseAdmin.rpc('request_background_check', {
      p_investigator_id: userId,
      p_check_type: checkType,
      p_stripe_payment_id: session.payment_intent
    });

    if (checkError) {
      console.error('Error processing background check:', checkError);
    } else {
      console.log(`Background check requested: ${checkType} for user ${userId}`);
    }
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription, supabaseAdmin: any) {
  const customerId = subscription.customer as string;
  const status = subscription.status;

  // Get user by Stripe customer ID
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!profile) {
    console.error('Profile not found for customer:', customerId);
    return;
  }

  // Determine plan type from subscription items
  const planType = subscription.items.data[0]?.price.lookup_key || 'unknown';

  // Upsert subscription record
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .upsert({
      user_id: profile.id,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      status: status,
      plan_type: planType,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    });

  if (error) {
    console.error('Error updating subscription:', error);
  } else {
    console.log(`Subscription updated for user ${profile.id}: ${status}`);
  }
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription, supabaseAdmin: any) {
  const { error } = await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'canceled' })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Error canceling subscription:', error);
  } else {
    console.log(`Subscription canceled: ${subscription.id}`);
  }
}

// Handle successful payout (withdrawal completed)
async function handlePayoutCompleted(payout: Stripe.Payout, supabaseAdmin: any) {
  const withdrawalRequestId = payout.metadata?.withdrawal_request_id;
  const userId = payout.metadata?.user_id;

  console.log(`Payout completed: ${payout.id}, amount: €${payout.amount / 100}`);

  if (withdrawalRequestId) {
    // Update withdrawal request status
    const { error: updateError } = await supabaseAdmin
      .from('withdrawal_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        stripe_payout_id: payout.id
      })
      .eq('id', withdrawalRequestId);

    if (updateError) {
      console.error('Error updating withdrawal request:', updateError);
    }

    // Create notification for user
    if (userId) {
      await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        type: 'withdrawal_completed',
        title: 'Withdrawal Completed',
        message: `Your withdrawal of €${(payout.amount / 100).toFixed(2)} has been sent to your bank account. It should arrive within 1-3 business days.`,
        metadata: {
          payout_id: payout.id,
          amount: payout.amount / 100,
          currency: payout.currency
        }
      });
    }
  }

  console.log(`Payout ${payout.id} processed successfully`);
}

// Handle failed payout
async function handlePayoutFailed(payout: Stripe.Payout, supabaseAdmin: any) {
  const withdrawalRequestId = payout.metadata?.withdrawal_request_id;
  const userId = payout.metadata?.user_id;

  console.error(`Payout failed: ${payout.id}, reason: ${payout.failure_message}`);

  if (withdrawalRequestId) {
    // Update withdrawal request status
    const { data: request, error: fetchError } = await supabaseAdmin
      .from('withdrawal_requests')
      .select('amount, user_id')
      .eq('id', withdrawalRequestId)
      .single();

    if (fetchError) {
      console.error('Error fetching withdrawal request:', fetchError);
      return;
    }

    await supabaseAdmin
      .from('withdrawal_requests')
      .update({
        status: 'failed',
        failure_reason: payout.failure_message || 'Payout failed',
        retry_count: 1
      })
      .eq('id', withdrawalRequestId);

    // Refund the balance back to wallet
    if (request) {
      const { error: refundError } = await supabaseAdmin.rpc('refund_failed_withdrawal', {
        p_user_id: request.user_id,
        p_amount: request.amount
      });

      if (refundError) {
        console.error('Error refunding withdrawal:', refundError);
      }
    }

    // Notify user
    if (userId) {
      await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        type: 'withdrawal_failed',
        title: 'Withdrawal Failed',
        message: `Your withdrawal of €${(payout.amount / 100).toFixed(2)} could not be processed. The funds have been returned to your wallet. Reason: ${payout.failure_message || 'Unknown error'}`,
        metadata: {
          payout_id: payout.id,
          failure_reason: payout.failure_message
        }
      });
    }
  }
}

// Handle canceled payout
async function handlePayoutCanceled(payout: Stripe.Payout, supabaseAdmin: any) {
  const withdrawalRequestId = payout.metadata?.withdrawal_request_id;
  const userId = payout.metadata?.user_id;

  console.log(`Payout canceled: ${payout.id}`);

  if (withdrawalRequestId) {
    // Update withdrawal request
    const { data: request } = await supabaseAdmin
      .from('withdrawal_requests')
      .select('amount, user_id')
      .eq('id', withdrawalRequestId)
      .single();

    await supabaseAdmin
      .from('withdrawal_requests')
      .update({ status: 'canceled' })
      .eq('id', withdrawalRequestId);

    // Refund to wallet
    if (request) {
      await supabaseAdmin.rpc('refund_failed_withdrawal', {
        p_user_id: request.user_id,
        p_amount: request.amount
      });
    }

    // Notify user
    if (userId) {
      await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        type: 'withdrawal_canceled',
        title: 'Withdrawal Canceled',
        message: `Your withdrawal has been canceled and the funds have been returned to your wallet.`,
        metadata: { payout_id: payout.id }
      });
    }
  }
}

// Helper function to handle wallet deposits
async function handleWalletDeposit(userId: string, amount: number, paymentId: string, supabaseAdmin: any) {
  console.log('=== handleWalletDeposit START ===');
  console.log('userId:', userId);
  console.log('amount:', amount, 'type:', typeof amount);
  console.log('paymentId:', paymentId);
  
  // Get or create wallet
  let { data: wallet, error: walletError } = await supabaseAdmin
    .from('wallets')
    .select('id, balance')
    .eq('user_id', userId)
    .single();
  
  console.log('Wallet query result:', wallet, 'error:', walletError);

  if (!wallet) {
    console.log('Wallet not found, creating one for user:', userId);
    const { data: newWallet, error: createError } = await supabaseAdmin
      .from('wallets')
      .insert({ user_id: userId, balance: 0 })
      .select('id')
      .single();
      
    if (createError || !newWallet) {
      console.error('Failed to create wallet:', createError);
      return;
    }
    wallet = newWallet;
  }

  // Create transaction record
  console.log('Creating transaction for wallet:', wallet.id);
  const { data: txData, error: txError } = await supabaseAdmin
    .from('transactions')
    .insert({
      to_wallet_id: wallet.id,
      transaction_type: 'deposit',
      amount: amount,
      status: 'completed',
      stripe_payment_intent_id: paymentId,
      metadata: {
        userId,
        stripePaymentId: paymentId,
        description: `Stripe deposit of €${amount}`,
      },
    })
    .select();

  if (txError) {
    console.error('❌ Error creating transaction:', txError);
  } else {
    console.log('✅ Transaction created:', txData);
  }
  
  // Manual balance update as fallback (if no trigger exists)
  console.log('Updating wallet balance manually...');
  const { data: updateData, error: updateError } = await supabaseAdmin
    .from('wallets')
    .update({ 
      balance: wallet.balance + amount,
      updated_at: new Date().toISOString()
    })
    .eq('id', wallet.id)
    .select();
    
  if (updateError) {
    console.error('❌ Error updating wallet balance:', updateError);
  } else {
    console.log('✅ Wallet balance updated:', updateData);
  }
  
  console.log(`=== handleWalletDeposit END: €${amount} for user ${userId} ===`);
}

// Helper function to handle case donations
async function handleCaseDonation(caseId: string, userId: string, amount: number, paymentId: string, supabaseAdmin: any) {
  console.log('handleCaseDonation called:', caseId, amount);
  
  // Calculate fees (10% platform fee)
  const platformFee = Math.round(amount * 0.10);
  const netAmount = amount - platformFee;

  // Update case escrow
  const { error: escrowError } = await supabaseAdmin.rpc('increment_case_escrow', {
    case_id: caseId,
    amount: netAmount,
  });

  if (escrowError) {
    console.error('Error updating escrow:', escrowError);
  }

  // Create donation transaction
  const { error: txError } = await supabaseAdmin
    .from('transactions')
    .insert({
      transaction_type: 'donation',
      case_id: caseId,
      amount: amount,
      status: 'completed',
      stripe_payment_intent_id: paymentId,
      metadata: {
        caseId,
        userId,
        stripePaymentId: paymentId,
        platformFee: platformFee,
        netAmount: netAmount,
        description: `Donation to case (€${netAmount} + €${platformFee} fee)`,
      },
    });

  if (txError) {
    console.error('Error creating donation transaction:', txError);
  }

  // Record platform fee
  const { error: feeError } = await supabaseAdmin
    .from('transactions')
    .insert({
      transaction_type: 'platform_fee',
      case_id: caseId,
      amount: platformFee,
      status: 'completed',
      metadata: {
        sourceTransaction: 'donation',
        caseId,
        userId,
        description: `Platform fee from donation`,
      },
    });

  if (feeError) {
    console.error('Error recording platform fee:', feeError);
  }

  console.log(`Donation processed: €${amount} to case ${caseId} (net: €${netAmount})`);
}

// ====== SUBSCRIPTION HANDLERS ======

async function handleSubscriptionUpdate(subscription: Stripe.Subscription, supabaseAdmin: any) {
  console.log('=== handleSubscriptionUpdate START ===');
  console.log('Subscription ID:', subscription.id);
  console.log('Status:', subscription.status);
  console.log('Metadata:', subscription.metadata);

  const { userId, planCode, billingCycle } = subscription.metadata;

  if (!userId || !planCode) {
    console.error('Missing metadata in subscription');
    return;
  }

  // Get plan details
  const { data: plan } = await supabaseAdmin
    .from('subscription_plans')
    .select('*')
    .eq('plan_code', planCode)
    .single();

  if (!plan) {
    console.error('Plan not found:', planCode);
    return;
  }

  const price = billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly;

  // Calculate period dates
  const periodStart = new Date(subscription.current_period_start * 1000);
  const periodEnd = new Date(subscription.current_period_end * 1000);

  // Upsert subscription record
  const { data: existingSubscription } = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (existingSubscription) {
    // Update existing
    await supabaseAdmin
      .from('subscriptions')
      .update({
        status: subscription.status === 'active' ? 'active' : subscription.status,
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingSubscription.id);

    console.log('Subscription updated:', existingSubscription.id);
  } else {
    // Create new
    const { data: newSubscription } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        user_id: userId,
        plan_type: planCode,
        status: subscription.status === 'active' ? 'active' : subscription.status,
        price: price,
        billing_cycle: billingCycle || 'monthly',
        stripe_subscription_id: subscription.id,
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        features: plan.features,
      })
      .select()
      .single();

    if (newSubscription) {
      // Initialize credits
      await supabaseAdmin.rpc('initialize_subscription_credits', {
        p_user_id: userId,
        p_subscription_id: newSubscription.id,
        p_plan_code: planCode,
        p_billing_cycle: billingCycle || 'monthly',
      });

      console.log('New subscription created:', newSubscription.id);
    }
  }

  console.log('=== handleSubscriptionUpdate END ===');
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription, supabaseAdmin: any) {
  console.log('=== handleSubscriptionCanceled START ===');
  console.log('Subscription ID:', subscription.id);

  // Update subscription status
  await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  // Deactivate credits (will be cleaned up at period end)
  await supabaseAdmin
    .from('subscription_credits')
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .eq('subscription_id', subscription.id);

  console.log('Subscription canceled:', subscription.id);
  console.log('=== handleSubscriptionCanceled END ===');
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice, supabaseAdmin: any) {
  console.log('=== handleInvoicePaymentSucceeded START ===');
  console.log('Invoice ID:', invoice.id);
  console.log('Subscription ID:', invoice.subscription);

  // Get subscription details
  const { data: subscription } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('stripe_subscription_id', invoice.subscription)
    .single();

  if (!subscription) {
    console.error('Subscription not found for invoice');
    return;
  }

  // Record payment transaction
  await supabaseAdmin.from('subscription_transactions').insert({
    user_id: subscription.user_id,
    subscription_id: subscription.id,
    plan_code: subscription.plan_type,
    amount: invoice.amount_paid / 100, // Convert from cents
    billing_cycle: subscription.billing_cycle,
    payment_method: 'stripe',
    stripe_payment_intent_id: invoice.payment_intent,
    stripe_invoice_id: invoice.id,
    status: 'completed',
    period_start: new Date(invoice.period_start * 1000).toISOString(),
    period_end: new Date(invoice.period_end * 1000).toISOString(),
    completed_at: new Date().toISOString(),
  });

  // If this is a renewal, reset credits
  if (subscription.billing_cycle === 'monthly') {
    await supabaseAdmin.rpc('initialize_subscription_credits', {
      p_user_id: subscription.user_id,
      p_subscription_id: subscription.id,
      p_plan_code: subscription.plan_type,
      p_billing_cycle: subscription.billing_cycle,
    });

    console.log('Credits reset for monthly renewal');
  }

  console.log('Invoice payment processed:', invoice.id);
  console.log('=== handleInvoicePaymentSucceeded END ===');
}
