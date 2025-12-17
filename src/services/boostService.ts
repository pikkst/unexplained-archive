// Boost Service - Handle featured case boosts
import { supabase } from '../lib/supabase';

export interface BoostPricing {
  id: string;
  boost_type: string;
  duration_hours: number;
  price: number;
  display_name: string;
  features: string[];
}

export interface ActiveBoost {
  case_id: string;
  featured_until: string;
  boost_type: string;
  impressions: number;
  clicks: number;
  status: string;
}

export const boostService = {
  /**
   * Get all available boost pricing options
   */
  async getBoostPricing(): Promise<BoostPricing[]> {
    const { data, error } = await supabase
      .from('boost_pricing')
      .select('*')
      .order('price', { ascending: true });

    if (error) {
      console.error('Error fetching boost pricing:', error);
      return [];
    }

    return data as BoostPricing[];
  },

  /**
   * Check if a case is currently boosted
   */
  async isCaseBoosted(caseId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('featured_cases')
      .select('case_id')
      .eq('case_id', caseId)
      .eq('status', 'active')
      .gt('featured_until', new Date().toISOString())
      .maybeSingle();

    if (error || !data) {
      return false;
    }

    return true;
  },

  /**
   * Get boost details for a case
   */
  async getCaseBoost(caseId: string): Promise<ActiveBoost | null> {
    const { data, error } = await supabase
      .from('featured_cases')
      .select('*')
      .eq('case_id', caseId)
      .eq('status', 'active')
      .gt('featured_until', new Date().toISOString())
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as ActiveBoost;
  },

  /**
   * Get all active boosted cases
   */
  async getActiveBoostedCases(): Promise<any[]> {
    const { data, error } = await supabase
      .rpc('get_active_boosts');

    if (error) {
      console.error('Error fetching active boosts:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Purchase boost via Stripe (creates checkout session for direct platform payment)
   */
  async purchaseBoostWithStripe(
    caseId: string, 
    userId: string, 
    boostType: string,
    amount: number,
    productName: string
  ): Promise<{ checkoutUrl: string } | null> {
    try {
      const origin = window.location.origin;
      const { data, error } = await supabase.functions.invoke('create-direct-payment-checkout', {
        body: { 
          amount,
          productName,
          productDescription: `Boost for case ${caseId}`,
          userId,
          successUrl: `${origin}/payment/success?type=boost&amount=${amount}&case_id=${caseId}`,
          cancelUrl: `${origin}/cases/${caseId}?boost=canceled`,
          metadata: {
            paymentType: 'boost',
            caseId,
            boostType
          }
        }
      });

      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('Error creating boost checkout:', error);
      return null;
    }
  },

  /**
   * Purchase boost with wallet balance
   */
  async purchaseBoostWithWallet(caseId: string, userId: string, boostType: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('Purchasing boost with wallet:', { caseId, userId, boostType });
      
      const { data, error } = await supabase.rpc('purchase_case_boost', {
        p_case_id: caseId,
        p_user_id: userId,
        p_boost_type: boostType,
        p_stripe_payment_id: null
      });

      if (error) {
        console.error('RPC error:', error);
        return { success: false, error: error.message };
      }
      
      console.log('RPC response:', data);
      
      // Check if response indicates success
      if (data && typeof data === 'object' && 'success' in data) {
        if (!data.success) {
          console.error('Purchase failed:', data.error);
          return { success: false, error: data.error || 'Purchase failed' };
        }
        return { success: true };
      }
      
      return { success: false, error: 'Invalid response from server' };
    } catch (error: any) {
      console.error('Error purchasing boost with wallet:', error);
      return { success: false, error: error.message || 'Network error' };
    }
  },

  /**
   * Track boost impression (when case is displayed)
   */
  async trackImpression(caseId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('track_boost_impression', {
        p_case_id: caseId
      });

      if (error) console.error('Error tracking impression:', error);
    } catch (error) {
      console.error('Error tracking impression:', error);
    }
  },

  /**
   * Track boost click (when boosted case is clicked)
   */
  async trackClick(caseId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('track_boost_click', {
        p_case_id: caseId
      });

      if (error) console.error('Error tracking click:', error);
    } catch (error) {
      console.error('Error tracking click:', error);
    }
  },

  /**
   * Get boost analytics for user's cases (using optimized RPC)
   */
  async getUserBoostAnalytics(userId: string): Promise<any[]> {
    const { data, error } = await supabase.rpc('get_user_boost_analytics', {
      p_user_id: userId
    });

    if (error) {
      console.error('Error fetching user boost analytics:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Get boost analytics for user's cases (legacy method - kept for compatibility)
   */
  async getBoostAnalytics(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('featured_cases')
      .select(`
        case_id,
        boost_type,
        featured_until,
        impressions,
        clicks,
        price_paid,
        status,
        case:cases!case_id (title, created_at)
      `)
      .eq('paid_by', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching boost analytics:', error);
      return [];
    }

    return (data || []).map((item: any) => ({
      ...item,
      case_title: item.case?.title || 'Unknown Case',
      case_date: item.case?.created_at
    }));
  },

  /**
   * Calculate boost ROI (impressions and clicks per euro spent)
   */
  calculateROI(boost: ActiveBoost & { price_paid: number }): {
    impressionsPerEuro: number;
    clicksPerEuro: number;
    ctr: number; // Click-through rate
  } {
    const impressionsPerEuro = boost.price_paid > 0 ? boost.impressions / boost.price_paid : 0;
    const clicksPerEuro = boost.price_paid > 0 ? boost.clicks / boost.price_paid : 0;
    const ctr = boost.impressions > 0 ? (boost.clicks / boost.impressions) * 100 : 0;

    return {
      impressionsPerEuro: Math.round(impressionsPerEuro * 100) / 100,
      clicksPerEuro: Math.round(clicksPerEuro * 100) / 100,
      ctr: Math.round(ctr * 10) / 10
    };
  }
};
