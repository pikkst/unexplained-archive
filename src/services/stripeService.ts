// Stripe Payment Service
// Handles all payment operations without requiring wallet balance

import { supabase } from '../lib/supabase';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

export interface PaymentIntent {
  clientSecret: string;
  amount: number;
  currency: string;
}

export interface CheckoutSession {
  sessionId: string;
  checkoutUrl: string;
}

export const stripeService = {
  /**
   * Create donation payment (direct Stripe payment, no wallet required)
   */
  async createDonationPayment(
    caseId: string,
    amount: number,
    userId: string,
    caseName?: string
  ): Promise<CheckoutSession | null> {
    try {
      // Ensure proper URL format for mobile devices
      const origin = window.location.origin || `${window.location.protocol}//${window.location.host}`;
      const caseNameParam = caseName ? `&case_name=${encodeURIComponent(caseName)}` : '';
      const successUrl = `${origin}/payment/success?type=donation&amount=${amount}&case_id=${caseId}${caseNameParam}`;
      const cancelUrl = `${origin}/cases/${caseId}?donation=canceled`;

      console.log('Creating donation payment:', { caseId, amount, userId, origin });

      const { data, error } = await supabase.functions.invoke('create-escrow-payment-checkout', {
        body: {
          caseId,
          amount,
          userId,
          successUrl,
          cancelUrl
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (!data || !data.checkoutUrl) {
        console.error('Invalid response from payment function:', data);
        throw new Error('Invalid payment session response');
      }

      console.log('Payment session created successfully:', data.sessionId);
      return data;
    } catch (err: any) {
      console.error('Error creating donation payment:', {
        error: err,
        message: err?.message,
        details: err?.details || err?.hint
      });
      return null;
    }
  },

  /**
   * Create wallet deposit checkout session
   */
  async createDepositCheckout(
    amount: number,
    userId: string
  ): Promise<CheckoutSession | null> {
    try {
      const { data, error } = await supabase.functions.invoke('create-deposit-checkout', {
        body: {
          amount,
          userId,
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }
      
      if (data?.error) {
        console.error('Function returned error:', data.error);
        throw new Error(data.error);
      }
      
      return data;
    } catch (err) {
      console.error('Error creating deposit checkout:', err);
      return null;
    }
  },

  /**
   * Create subscription checkout session
   */
  async createSubscriptionCheckout(
    planType: 'investigator_pro' | 'user_premium',
    userId: string
  ): Promise<CheckoutSession | null> {
    try {
      const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
        body: {
          planType,
          userId,
          successUrl: `${window.location.origin}/unexplained-archive/payment/success?type=subscription`,
          cancelUrl: `${window.location.origin}/unexplained-archive/subscription?canceled=true`
        }
      });

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error creating subscription checkout:', err);
      return null;
    }
  },

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase.functions.invoke('cancel-subscription', {
        body: { userId }
      });

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error canceling subscription:', err);
      return false;
    }
  },

  /**
   * Get user's active subscription
   */
  async getSubscription(userId: string) {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      return data;
    } catch (err) {
      console.error('Error fetching subscription:', err);
      return null;
    }
  },

  /**
   * Check if user has active subscription
   */
  async hasActiveSubscription(userId: string, planType?: string): Promise<boolean> {
    const subscription = await this.getSubscription(userId);
    if (!subscription) return false;
    if (planType && subscription.plan_type !== planType) return false;
    
    // Check if subscription is still valid
    const now = new Date();
    const periodEnd = new Date(subscription.current_period_end);
    return now < periodEnd;
  },

  /**
   * Request withdrawal (for investigators)
   */
  async requestWithdrawal(userId: string, amount: number): Promise<boolean> {
    try {
      // Check minimum amount
      if (amount < 50) {
        alert('Minimum withdrawal amount is €50');
        return false;
      }

      // Check wallet balance
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (!wallet || wallet.balance < amount) {
        alert('Insufficient wallet balance');
        return false;
      }

      // Create withdrawal request
      const { error } = await supabase.functions.invoke('request-withdrawal', {
        body: { userId, amount }
      });

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error requesting withdrawal:', err);
      return false;
    }
  },

  /**
   * Get transaction history
   */
  async getTransactions(userId: string, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          case:cases(title),
          user:profiles(username)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching transactions:', err);
      return [];
    }
  },

  /**
   * Get wallet balance (investigators only)
   */
  async getWalletBalance(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data?.balance || 0;
    } catch (err) {
      console.error('Error fetching wallet balance:', err);
      return 0;
    }
  },

  /**
   * Initialize Stripe Connect for investigator payouts
   */
  async setupStripeConnect(userId: string): Promise<{ accountLink: string } | null> {
    try {
      const { data, error } = await supabase.functions.invoke('setup-stripe-connect', {
        body: { 
          userId,
          refreshUrl: `${window.location.origin}/unexplained-archive/wallet`,
          returnUrl: `${window.location.origin}/unexplained-archive/wallet?setup=complete`
        }
      });

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error setting up Stripe Connect:', err);
      return null;
    }
  },

  /**
   * Record platform revenue
   */
  async recordPlatformRevenue(amount: number, type: 'donation' | 'case_reward' | 'withdrawal' | 'subscription', referenceId?: string): Promise<void> {
    const fee = this.calculatePlatformFee(amount, type);
    if (fee > 0) {
      const { error } = await supabase.from('platform_revenue').insert({
        amount: fee,
        transaction_type: type,
        reference_id: referenceId,
      });
      if (error) {
        console.error('Error recording platform revenue:', error);
      }
    }
  },

  /**
   * Calculate platform fee
   * @param amount - Payment amount
   * @param type - Payment type
   * @param isPlatformDonation - If true, no fee is charged (money goes to platform development)
   */
  calculatePlatformFee(amount: number, type: 'donation' | 'case_reward' | 'withdrawal' | 'subscription', isPlatformDonation: boolean = false): number {
    // Platform donations: 0% fee (all money goes to platform)
    if (type === 'donation' && isPlatformDonation) {
      return 0;
    }

    switch (type) {
      case 'donation':
        return amount * 0.10; // 10% for case donations
      case 'case_reward':
        return amount * 0.15; // 15%
      case 'withdrawal':
        return 2 + (amount * 0.02); // €2 + 2%
      case 'subscription':
        return amount * 0.05; // 5% fee on subscriptions
      default:
        return 0;
    }
  },

  /**
   * Calculate net amount after fees
   */
  calculateNetAmount(amount: number, type: 'donation' | 'case_reward' | 'withdrawal' | 'subscription', isPlatformDonation: boolean = false): number {
    const fee = this.calculatePlatformFee(amount, type, isPlatformDonation);
    return amount - fee;
  }
};

export default stripeService;
