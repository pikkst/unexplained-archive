import React, { useEffect, useState } from 'react';
import { Check, X, Sparkles, Zap, Crown, Users, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { subscriptionService, type SubscriptionPlan } from '../services/investigatorSubscriptionService';
import { walletService } from '../services/walletService';

export const InvestigatorSubscriptionPlans: React.FC = () => {
  const { user } = useAuth();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [walletBalance, setWalletBalance] = useState(0);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => {
    loadPlans();
    if (user) {
      walletService.getBalance(user.id).then(setWalletBalance);
    }
  }, [user]);

  const loadPlans = async () => {
    const plansData = await subscriptionService.getPlans();
    setPlans(plansData);
    setLoading(false);
  };

  const handleSubscribe = async (plan: SubscriptionPlan, paymentMethod: 'stripe' | 'wallet') => {
    if (!user) {
      alert('Please sign in to subscribe');
      return;
    }

    setSubscribing(plan.plan_code);

    try {
      if (paymentMethod === 'wallet') {
        const price = billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly;
        
        if (walletBalance < price) {
          alert(`Insufficient wallet balance. You need €${price.toFixed(2)}`);
          setSubscribing(null);
          return;
        }

        const result = await subscriptionService.subscribeWithWallet(user.id, plan.plan_code, billingCycle);
        if (result.success) {
          alert('Subscription activated instantly!');
          window.location.reload();
        } else {
          alert(result.error || 'Failed to subscribe');
        }
      } else {
        const result = await subscriptionService.subscribeWithStripe(user.id, plan.plan_code, billingCycle);
        if (result && result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
        } else {
          alert('Failed to create checkout session');
        }
      }
    } catch (error: any) {
      console.error('Subscription error:', error);
      alert(error.message || 'Failed to subscribe');
    } finally {
      setSubscribing(null);
    }
  };

  const getPlanIcon = (planCode: string) => {
    switch (planCode) {
      case 'basic':
        return <Sparkles className="w-8 h-8" />;
      case 'premium':
        return <Zap className="w-8 h-8" />;
      case 'pro':
        return <Crown className="w-8 h-8" />;
      default:
        return <Sparkles className="w-8 h-8" />;
    }
  };

  const getPlanColor = (planCode: string) => {
    switch (planCode) {
      case 'basic':
        return 'from-gray-600 to-gray-700';
      case 'premium':
        return 'from-yellow-600 to-yellow-700';
      case 'pro':
        return 'from-purple-600 to-purple-700';
      default:
        return 'from-gray-600 to-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-mystery-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-mystery-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mystery-900 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Professional AI Investigation Tools
          </h1>
          <p className="text-xl text-gray-400 mb-8">
            Forget manual analysis. Use AI to solve mysterious cases faster and more accurately.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="inline-flex items-center gap-4 bg-mystery-800 p-2 rounded-lg border border-mystery-700">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-md transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-mystery-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2 rounded-md transition-all flex items-center gap-2 ${
                billingCycle === 'yearly'
                  ? 'bg-mystery-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Yearly
              <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        {/* Social Proof */}
        <div className="flex justify-center gap-8 mb-12 text-gray-400 text-sm">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            <span>2,500+ Active Investigators</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            <span>15,000+ Cases Analyzed</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-500" />
            <span>92% Satisfaction</span>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan) => {
            const price = billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly;
            const pricePerMonth =
              billingCycle === 'yearly' ? price / 12 : price;
            const savings = billingCycle === 'yearly' ? plan.price_monthly * 12 - plan.price_yearly : 0;
            const isPopular = plan.features?.most_popular;
            const isBestValue = plan.features?.best_value;

            return (
              <div
                key={plan.id}
                className={`relative bg-mystery-800 rounded-2xl border-2 transition-all hover:scale-105 ${
                  isPopular || isBestValue
                    ? 'border-mystery-400 shadow-lg shadow-mystery-500/50'
                    : 'border-mystery-700'
                }`}
              >
                {/* Badge */}
                {(isPopular || isBestValue) && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-mystery-500 to-mystery-600 text-white px-6 py-1 rounded-full text-sm font-semibold">
                      {isPopular && '🔥 Most Popular!'}
                      {isBestValue && '⭐ Best Value!'}
                    </span>
                  </div>
                )}

                <div className="p-8">
                  {/* Icon & Name */}
                  <div
                    className={`w-16 h-16 rounded-xl bg-gradient-to-br ${getPlanColor(
                      plan.plan_code
                    )} flex items-center justify-center mb-4 text-white`}
                  >
                    {getPlanIcon(plan.plan_code)}
                  </div>

                  <h3 className="text-2xl font-bold text-white mb-2">{plan.plan_name}</h3>
                  <p className="text-gray-400 mb-6 min-h-[48px]">{plan.description}</p>

                  {/* Pricing */}
                  <div className="mb-6">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-white">
                        €{pricePerMonth.toFixed(2)}
                      </span>
                      <span className="text-gray-400">/month</span>
                    </div>
                    {billingCycle === 'yearly' && (
                      <div className="text-sm text-green-400 mt-1">
                        Save: €{savings.toFixed(2)}/year
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <div className="space-y-3 mb-8">
                    <div className="flex items-center gap-2 text-white">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span>
                        {plan.ai_credits_monthly === 9999999
                          ? 'UNLIMITED AI credits'
                          : `${plan.ai_credits_monthly} AI credits/month`}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-white">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span>Processing: {plan.processing_speed === 'standard' ? 'Standard' : plan.processing_speed === 'fast' ? 'Fast' : 'Fastest'}</span>
                    </div>

                    {plan.boost_discount > 0 && (
                      <div className="flex items-center gap-2 text-white">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span>Case boost: {plan.boost_discount}% discount</span>
                      </div>
                    )}

                    {plan.boost_free_monthly > 0 && (
                      <div className="flex items-center gap-2 text-white">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span>{plan.boost_free_monthly}x FREE boost/month</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-white">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span>Support: {plan.support_level === 'standard' ? '24h response' : plan.support_level === 'priority' ? '12h + Chat' : '24/7 + Manager'}</span>
                    </div>

                    {plan.team_members > 1 && (
                      <div className="flex items-center gap-2 text-white">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span>Up to {plan.team_members} team members</span>
                      </div>
                    )}

                    {plan.api_access && (
                      <div className="flex items-center gap-2 text-white">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span>API access ({plan.api_requests_monthly.toLocaleString()}/month)</span>
                      </div>
                    )}

                    {plan.features?.analytics_dashboard && (
                      <div className="flex items-center gap-2 text-white">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span>Analytics dashboard</span>
                      </div>
                    )}
                  </div>

                  {/* CTA Buttons */}
                  <div className="space-y-3">
                    <button
                      onClick={() => handleSubscribe(plan, 'stripe')}
                      disabled={subscribing === plan.plan_code}
                      className="w-full bg-gradient-to-r from-mystery-500 to-mystery-600 hover:from-mystery-600 hover:to-mystery-700 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {subscribing === plan.plan_code ? 'Processing...' : 'Subscribe with Card'}
                    </button>

                    {user && walletBalance >= price && (
                      <button
                        onClick={() => handleSubscribe(plan, 'wallet')}
                        disabled={subscribing === plan.plan_code}
                        className="w-full bg-mystery-700 hover:bg-mystery-600 text-white font-semibold py-3 rounded-lg transition-all border border-mystery-600 disabled:opacity-50"
                      >
                        Subscribe from Wallet (€{walletBalance.toFixed(2)})
                      </button>
                    )}
                  </div>

                  {plan.features?.trial_days && (
                    <p className="text-center text-sm text-gray-400 mt-4">
                      ✨ {plan.features.trial_days}-day FREE trial
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto bg-mystery-800 rounded-2xl p-8 border border-mystery-700">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Frequently Asked Questions</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">❓ How do credits work?</h3>
              <p className="text-gray-400">
                Each AI tool usage consumes credits (1-5 credits). Basic: 50/month, Premium/Pro: unlimited.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-2">❓ Can I change my plan?</h3>
              <p className="text-gray-400">
                Yes, anytime. Upgrade activates immediately, downgrade on next cycle.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-2">❓ Can I cancel?</h3>
              <p className="text-gray-400">
                Yes, anytime. Use until end of period. No questions asked.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-2">❓ Is there a money-back guarantee?</h3>
              <p className="text-gray-400">
                Yes, 30-day money-back guarantee. If not satisfied, we'll refund in full.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
