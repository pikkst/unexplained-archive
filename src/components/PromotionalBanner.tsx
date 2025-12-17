import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Gift, Sparkles, Clock, Tag } from 'lucide-react';

interface PromotionalBannerProps {
  position?: 'top' | 'bottom' | 'modal';
  onClose?: () => void;
}

interface ActiveCampaign {
  id: string;
  name: string;
  description: string;
  campaign_type: string;
  banner_text: string;
  landing_page_text: string;
  cta_button_text: string;
  banner_image_url: string | null;
  free_credits: number | null;
  trial_days: number | null;
  discount_percentage: number | null;
  discount_amount: number | null;
  requires_code: boolean;
  end_date: string;
}

export const PromotionalBanner: React.FC<PromotionalBannerProps> = ({ 
  position = 'top',
  onClose 
}) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [campaign, setCampaign] = useState<ActiveCampaign | null>(null);
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [hasExistingBenefit, setHasExistingBenefit] = useState(false);

  // Get current user and profile
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        
        // Get profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          setProfile(profile);
        }
      }
    };
    
    getUser();
    
    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        getUser();
      } else {
        setUser(null);
        setProfile(null);
      }
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    checkActiveCampaigns(); // Check campaigns for everyone
    if (user) {
      checkUserBenefits();
    }
  }, [user]);

  const checkActiveCampaigns = async () => {
    try {
      // Get active campaigns that don't require code or are targeted to user
      const { data, error } = await supabase
        .from('promotional_campaigns')
        .select('*')
        .eq('status', 'active')
        .lte('start_date', new Date().toISOString())
        .gte('end_date', new Date().toISOString())
        .limit(1);

      if (error) {
        console.error('Campaign query error:', error);
        return;
      }

      if (!data || data.length === 0) {
        console.log('No active campaigns found');
        return;
      }

      const activeCampaign = data[0];

      // Check if user is eligible based on target segment
      const isEligible = await checkEligibility(activeCampaign);
      if (isEligible) {
        setCampaign(activeCampaign);
        trackImpression(activeCampaign.id);
      }
    } catch (error) {
      console.error('Error checking campaigns:', error);
    }
  };

  const checkEligibility = async (campaign: any): Promise<boolean> => {
    // Anonymous users can see campaigns (they just can't redeem without logging in)
    if (!user) return true;

    // Check if already redeemed
    const { data: redemptions } = await supabase
      .from('campaign_redemptions')
      .select('id')
      .eq('campaign_id', campaign.id)
      .eq('user_id', user.id);

    if (redemptions && redemptions.length > 0) {
      return false; // Already redeemed
    }

    // Check target segment
    if (campaign.target_user_segment === 'new_users') {
      const userAge = new Date().getTime() - new Date(profile?.created_at).getTime();
      const daysSinceJoin = userAge / (1000 * 60 * 60 * 24);
      return daysSinceJoin < 7; // New user = joined within 7 days
    }

    if (campaign.target_user_segment === 'investigators') {
      return profile?.role === 'investigator';
    }

    if (campaign.target_user_segment === 'first_100') {
      return campaign.current_redemptions < 100;
    }

    return true; // all_users
  };

  const checkUserBenefits = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('get_user_active_benefits', {
        p_user_id: user.id
      });

      if (!error && data && data.length > 0) {
        setHasExistingBenefit(true);
      }
    } catch (error) {
      console.error('Error checking benefits:', error);
    }
  };

  const trackImpression = async (campaignId: string) => {
    try {
      await supabase.rpc('track_campaign_impression', { 
        p_campaign_id: campaignId 
      });
    } catch (error) {
      console.error('Error tracking impression:', error);
    }
  };

  const trackClick = async (campaignId: string) => {
    try {
      await supabase.rpc('track_campaign_click', { 
        p_campaign_id: campaignId 
      });
    } catch (error) {
      console.error('Error tracking click:', error);
    }
  };

  const redeemCampaign = async () => {
    if (!campaign || !user) return;

    setIsRedeeming(true);
    try {
      let result;

      if (campaign.requires_code) {
        if (!promoCode.trim()) {
          alert('Please enter a promo code');
          return;
        }

        // Redeem with promo code
        const { data, error } = await supabase.rpc('redeem_promo_code', {
          p_code: promoCode.toUpperCase(),
          p_user_id: user.id
        });

        if (error) throw error;
        result = data;
      } else {
        // Direct redemption without code
        const { data, error } = await supabase
          .from('campaign_redemptions')
          .insert([{
            campaign_id: campaign.id,
            user_id: user.id,
            benefit_type: campaign.campaign_type,
            benefit_value: {
              discount_percentage: campaign.discount_percentage,
              discount_amount: campaign.discount_amount,
              free_credits: campaign.free_credits,
              trial_days: campaign.trial_days
            }
          }])
          .select()
          .single();

        if (error) throw error;
        result = { success: true, redemption_id: data.id };
      }

      if (result.success) {
        alert('🎉 Promotion successfully claimed! Check your account for your benefits.');
        trackClick(campaign.id);
        setCampaign(null);
        setDismissed(true);
        
        // Reload page to reflect new benefits
        window.location.reload();
      } else {
        alert('❌ ' + (result.error || 'Failed to redeem promotion'));
      }
    } catch (error: any) {
      alert('❌ Error: ' + error.message);
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    if (onClose) onClose();
  };

  if (!campaign || dismissed || hasExistingBenefit) {
    return null;
  }

  const getBenefitDisplay = () => {
    if (campaign.free_credits) {
      return `${campaign.free_credits} Free Credits`;
    }
    if (campaign.trial_days) {
      return `${campaign.trial_days} Days Free Trial`;
    }
    if (campaign.discount_percentage) {
      return `${campaign.discount_percentage}% Off`;
    }
    if (campaign.discount_amount) {
      return `$${campaign.discount_amount} Off`;
    }
    return 'Special Offer';
  };

  const timeRemaining = () => {
    if (!campaign.end_date) return null;
    const end = new Date(campaign.end_date);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days} days left`;
    if (hours > 0) return `${hours} hours left`;
    return 'Ending soon';
  };

  // Modal style
  if (position === 'modal') {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-mystery-800 to-mystery-900 rounded-xl max-w-2xl w-full shadow-2xl border border-mystery-500/30 overflow-hidden">
          {campaign.banner_image_url && (
            <div className="h-48 overflow-hidden">
              <img 
                src={campaign.banner_image_url} 
                alt={campaign.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          
          <div className="p-8">
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-mystery-500/20 rounded-lg">
                <Gift className="w-8 h-8 text-mystery-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">{campaign.name}</h2>
                <p className="text-mystery-400 font-semibold">{getBenefitDisplay()}</p>
              </div>
            </div>

            {campaign.landing_page_text && (
              <p className="text-gray-300 mb-6 leading-relaxed">
                {campaign.landing_page_text}
              </p>
            )}

            {campaign.requires_code ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Enter Promo Code
                  </label>
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="PROMO CODE"
                    className="w-full bg-mystery-900 border border-mystery-700 rounded-lg px-4 py-3 text-white uppercase text-center text-lg font-mono"
                  />
                </div>
                <button
                  onClick={redeemCampaign}
                  disabled={isRedeeming || !promoCode.trim()}
                  className="w-full bg-mystery-500 hover:bg-mystery-600 disabled:bg-mystery-700 disabled:cursor-not-allowed text-white px-6 py-4 rounded-lg font-semibold text-lg transition-colors flex items-center justify-center gap-2"
                >
                  {isRedeeming ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Redeeming...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      {campaign.cta_button_text || 'Claim Offer'}
                    </>
                  )}
                </button>
              </div>
            ) : (
              <button
                onClick={redeemCampaign}
                disabled={isRedeeming}
                className="w-full bg-mystery-500 hover:bg-mystery-600 disabled:bg-mystery-700 disabled:cursor-not-allowed text-white px-6 py-4 rounded-lg font-semibold text-lg transition-colors flex items-center justify-center gap-2"
              >
                {isRedeeming ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Claiming...
                  </>
                ) : (
                  <>
                    <Gift className="w-5 h-5" />
                    {campaign.cta_button_text || 'Claim Now'}
                  </>
                )}
              </button>
            )}

            {timeRemaining() && (
              <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-400">
                <Clock className="w-4 h-4" />
                {timeRemaining()}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Banner style (top or bottom)
  return (
    <div className={`${position === 'top' ? 'top-0' : 'bottom-0'} left-0 right-0 z-40 bg-gradient-to-r from-mystery-600 to-mystery-500 shadow-lg`}>
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Gift className="w-6 h-6 text-white flex-shrink-0" />
            <div className="flex-1">
              <p className="text-white font-semibold">
                {campaign.banner_text || campaign.name}
              </p>
              {campaign.requires_code && (
                <p className="text-mystery-100 text-sm">Enter code at checkout</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {timeRemaining() && (
              <div className="hidden sm:flex items-center gap-1 text-white/80 text-sm">
                <Clock className="w-4 h-4" />
                {timeRemaining()}
              </div>
            )}
            
            {campaign.requires_code ? (
              <button
                onClick={() => setShowPromoInput(!showPromoInput)}
                className="bg-white text-mystery-600 hover:bg-mystery-50 px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <Tag className="w-4 h-4" />
                Enter Code
              </button>
            ) : (
              <button
                onClick={redeemCampaign}
                disabled={isRedeeming}
                className="bg-white text-mystery-600 hover:bg-mystery-50 disabled:opacity-50 px-4 py-2 rounded-lg font-semibold transition-colors whitespace-nowrap"
              >
                {isRedeeming ? 'Claiming...' : campaign.cta_button_text || 'Claim Now'}
              </button>
            )}

            <button
              onClick={handleDismiss}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {showPromoInput && campaign.requires_code && (
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
              placeholder="ENTER CODE"
              className="flex-1 bg-white/10 backdrop-blur border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/50 uppercase font-mono"
            />
            <button
              onClick={redeemCampaign}
              disabled={isRedeeming || !promoCode.trim()}
              className="bg-white text-mystery-600 hover:bg-mystery-50 disabled:opacity-50 px-6 py-2 rounded-lg font-semibold transition-colors"
            >
              {isRedeeming ? 'Applying...' : 'Apply'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
