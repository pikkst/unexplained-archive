// Subscription Service - Handle investigator subscriptions
import { supabase } from '../lib/supabase';

export interface SubscriptionPlan {
  id: string;
  plan_code: 'basic' | 'premium' | 'pro';
  plan_name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  price_onetime: number;
  ai_credits_monthly: number;
  processing_speed: 'standard' | 'fast' | 'fastest';
  boost_discount: number;
  boost_free_monthly: number;
  support_level: string;
  team_members: number;
  api_access: boolean;
  api_requests_monthly: number;
  features: any;
  display_order: number;
}

export interface SubscriptionCredits {
  id: string;
  user_id: string;
  subscription_id: string;
  credits_total: number;
  credits_used: number;
  credits_remaining: number;
  billing_cycle: 'monthly' | 'yearly' | 'onetime';
  current_period_start: string;
  current_period_end: string;
  resets_at: string | null;
  expires_at: string | null;
  is_active: boolean;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_type: string;
  status: 'active' | 'cancelled' | 'expired' | 'past_due' | 'trialing';
  price: number;
  billing_cycle: 'monthly' | 'yearly';
  stripe_subscription_id: string | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  features: any;
}

export const subscriptionService = {
  /**
   * Get all available subscription plans
   */
  async getPlans(): Promise<SubscriptionPlan[]> {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching plans:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Get specific plan by code
   */
  async getPlan(planCode: string): Promise<SubscriptionPlan | null> {
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('plan_code', planCode)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('Error fetching plan:', error);
      return null;
    }

    return data;
  },

  /**
   * Get user's current subscription
   */
  async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching subscription:', error);
    }

    return data || null;
  },

  /**
   * Get user's credit balance
   */
  async getUserCredits(userId: string): Promise<SubscriptionCredits | null> {
    const { data, error } = await supabase
      .from('subscription_credits')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching credits:', error);
      return null;
    }

    return data;
  },

  /**
   * Check if user has enough credits for an action
   */
  async checkCredits(userId: string, requiredCredits: number): Promise<{
    hasCredits: boolean;
    remaining: number;
    reason?: string;
  }> {
    const credits = await this.getUserCredits(userId);

    if (!credits) {
      return {
        hasCredits: false,
        remaining: 0,
        reason: 'No active subscription. Subscribe to use AI tools.',
      };
    }

    // Check if expired (one-time packs)
    if (credits.expires_at && new Date(credits.expires_at) < new Date()) {
      return {
        hasCredits: false,
        remaining: 0,
        reason: 'Your subscription has expired. Please renew.',
      };
    }

    const hasEnough = credits.credits_remaining >= requiredCredits;

    return {
      hasCredits: hasEnough,
      remaining: credits.credits_remaining,
      reason: hasEnough ? undefined : 'Insufficient credits. Upgrade or wait for reset.',
    };
  },

  /**
   * Get credit cost for a tool
   */
  getToolCreditCost(toolName: string): number {
    const costs: Record<string, number> = {
      ai_analyze_image: 2,
      ai_analyze_text: 2,
      ai_find_similar: 1,
      ai_generate_report: 5,
      ai_verify_authenticity: 3,
      ai_verify_consistency: 3,
      ai_extract_timeline: 2,
      ai_analyze_patterns: 3,
      ai_generate_questions: 2,
    };

    return costs[toolName] || 1;
  },

  /**
   * Subscribe with Stripe (create checkout session)
   */
  async subscribeWithStripe(
    userId: string,
    planCode: string,
    billingCycle: 'monthly' | 'yearly' | 'onetime'
  ): Promise<{ checkoutUrl: string } | null> {
    try {
      const { data, error } = await supabase.functions.invoke('subscribe', {
        body: {
          userId,
          planCode,
          billingCycle,
          paymentMethod: 'stripe',
        },
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating Stripe subscription:', error);
      return null;
    }
  },

  /**
   * Subscribe with Wallet (instant activation)
   */
  async subscribeWithWallet(
    userId: string,
    planCode: string,
    billingCycle: 'monthly' | 'yearly' | 'onetime'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('subscribe', {
        body: {
          userId,
          planCode,
          billingCycle,
          paymentMethod: 'wallet',
        },
      });

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error subscribing with wallet:', error);
      return {
        success: false,
        error: error.message || 'Failed to subscribe with wallet',
      };
    }
  },

  /**
   * Cancel subscription (at period end)
   */
  async cancelSubscription(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('cancel-subscription', {
        body: { userId },
      });

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error canceling subscription:', error);
      return {
        success: false,
        error: error.message || 'Failed to cancel subscription',
      };
    }
  },

  /**
   * Resume canceled subscription
   */
  async resumeSubscription(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const subscription = await this.getUserSubscription(userId);
      if (!subscription) {
        return { success: false, error: 'No subscription found' };
      }

      const { data, error } = await supabase.functions.invoke('resume-subscription', {
        body: {
          userId,
          stripeSubscriptionId: subscription.stripe_subscription_id || '',
        },
      });

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      console.error('Error resuming subscription:', error);
      return {
        success: false,
        error: error.message || 'Failed to resume subscription',
      };
    }
  },

  /**
   * Upgrade or change subscription plan
   */
  async upgradeSubscription(
    userId: string,
    newPlanCode: string,
    billingCycle: 'monthly' | 'yearly'
  ): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      const { data, error } = await supabase.functions.invoke('upgrade-subscription', {
        body: {
          userId,
          newPlanCode,
          billingCycle,
        },
      });

      if (error) throw error;
      return { success: true, message: data?.message };
    } catch (error: any) {
      console.error('Error upgrading subscription:', error);
      return {
        success: false,
        error: error.message || 'Failed to upgrade subscription',
      };
    }
  },

  /**
   * Get subscription usage history
   */
  async getUsageHistory(userId: string, limit = 50): Promise<any[]> {
    const { data, error } = await supabase
      .from('subscription_usage_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching usage history:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Get subscription payment history
   */
  async getPaymentHistory(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('subscription_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payment history:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Check if user has active subscription
   */
  async hasActiveSubscription(userId: string): Promise<boolean> {
    const subscription = await this.getUserSubscription(userId);
    return subscription !== null && subscription.status === 'active';
  },

  /**
   * Get subscription status summary
   */
  async getSubscriptionStatus(userId: string): Promise<{
    hasSubscription: boolean;
    plan: SubscriptionPlan | null;
    subscription: UserSubscription | null;
    credits: SubscriptionCredits | null;
    daysUntilRenewal: number | null;
    canceledAtPeriodEnd: boolean;
  }> {
    const [subscription, credits] = await Promise.all([
      this.getUserSubscription(userId),
      this.getUserCredits(userId),
    ]);

    let plan: SubscriptionPlan | null = null;
    let daysUntilRenewal: number | null = null;

    if (subscription) {
      plan = await this.getPlan(subscription.plan_type);
      const periodEnd = new Date(subscription.current_period_end);
      const now = new Date();
      daysUntilRenewal = Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    return {
      hasSubscription: subscription !== null,
      plan,
      subscription,
      credits,
      daysUntilRenewal,
      canceledAtPeriodEnd: subscription?.cancel_at_period_end || false,
    };
  },

  /**
   * Format price for display
   */
  formatPrice(amount: number, currency = 'EUR'): string {
    return new Intl.NumberFormat('et-EE', {
      style: 'currency',
      currency,
    }).format(amount);
  },

  /**
   * Calculate savings for yearly billing
   */
  calculateYearlySavings(monthlyPrice: number, yearlyPrice: number): {
    savings: number;
    percentage: number;
  } {
    const monthlyTotal = monthlyPrice * 12;
    const savings = monthlyTotal - yearlyPrice;
    const percentage = Math.round((savings / monthlyTotal) * 100);

    return { savings, percentage };
  },
};
