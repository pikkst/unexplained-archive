import { supabase } from '../lib/supabase';
import type { Database } from '../lib/supabase';

// Types for extended schema tables (subscriptions)
interface Subscription {
  id: string;
  user_id: string;
  plan_type: string;
  status: 'active' | 'canceled' | 'expired';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  stripe_subscription_id?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  features: string[];
  stripePriceId?: string;
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  investigator_basic: {
    id: 'investigator_basic',
    name: 'Investigator Basic',
    price: 10.00,
    currency: 'EUR',
    interval: 'monthly',
    features: [
      '50 AI image generations per month',
      'Basic case analysis tools',
      'Priority case notifications',
      'Badge on profile'
    ]
  },
  investigator_pro: {
    id: 'investigator_pro',
    name: 'Investigator Pro',
    price: 25.00,
    currency: 'EUR',
    interval: 'monthly',
    features: [
      'Unlimited AI image generations',
      'Advanced analysis tools',
      'AI-powered evidence enhancement',
      'Priority support',
      'Featured investigator badge',
      'Early access to new features'
    ]
  },
  user_premium: {
    id: 'user_premium',
    name: 'Premium Member',
    price: 5.00,
    currency: 'EUR',
    interval: 'monthly',
    features: [
      'Ad-free experience',
      'Priority support',
      'Early access to features',
      'Premium badge'
    ]
  }
};

export const subscriptionService = {
  // Get user's active subscription
  async getUserSubscription(userId: string): Promise<Subscription | null> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No subscription found
      console.error('Error fetching subscription:', error);
      return null;
    }
    return data;
  },

  // Check if user has active subscription
  async hasActiveSubscription(userId: string, planType?: string): Promise<boolean> {
    const subscription = await this.getUserSubscription(userId);
    if (!subscription) return false;
    if (planType) return subscription.plan_type === planType;
    return true;
  },

  // Create subscription (via Stripe)
  async createSubscription(userId: string, planType: string): Promise<{ sessionId: string; checkoutUrl: string } | null> {
    try {
      const plan = SUBSCRIPTION_PLANS[planType];
      if (!plan) throw new Error('Invalid plan type');

      const { data, error } = await supabase.functions.invoke('create-subscription-checkout', {
        body: {
          userId,
          planType,
          price: plan.price,
          successUrl: `${window.location.origin}/profile?subscription=success`,
          cancelUrl: `${window.location.origin}/profile?subscription=canceled`
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating subscription:', error);
      return null;
    }
  },

  // Cancel subscription
  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ cancel_at_period_end: true })
        .eq('id', subscriptionId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      return false;
    }
  },

  // Check AI usage limits
  async checkAIUsageLimit(userId: string, feature: string): Promise<{ allowed: boolean; remaining?: number; reason?: string }> {
    const subscription = await this.getUserSubscription(userId);
    
    // No subscription - no AI access for paid features
    if (!subscription || subscription.plan_type === 'user_premium') {
      return { allowed: false, reason: 'Subscribe to Investigator plan to use AI tools' };
    }

    // Investigator Pro - unlimited
    if (subscription.plan_type === 'investigator_pro') {
      return { allowed: true };
    }

    // Investigator Basic - check monthly limit (50)
    if (subscription.plan_type === 'investigator_basic' && feature === 'image_generation') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count, error } = await supabase
        .from('ai_usage')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('feature', feature)
        .gte('created_at', startOfMonth.toISOString());

      if (error) {
        console.error('Error checking AI usage:', error);
        return { allowed: false, reason: 'Unable to verify usage' };
      }

      const limit = 50;
      const used = count || 0;
      const remaining = limit - used;

      if (remaining <= 0) {
        return { 
          allowed: false, 
          reason: 'Monthly AI generation limit reached. Upgrade to Pro for unlimited access.' 
        };
      }

      return { allowed: true, remaining };
    }

    return { allowed: true };
  },

  // Track AI usage
  async trackAIUsage(userId: string, feature: string, cost: number, metadata?: any): Promise<boolean> {
    try {
      const subscription = await this.getUserSubscription(userId);

      const { error } = await supabase
        .from('ai_usage')
        .insert({
          user_id: userId,
          feature,
          cost,
          subscription_id: subscription?.id || null,
          metadata: metadata || {}
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error tracking AI usage:', error);
      return false;
    }
  }
};
