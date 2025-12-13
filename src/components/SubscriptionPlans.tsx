import React, { useState, useEffect } from 'react';
import { Crown, Check, Zap, Shield, Sparkles } from 'lucide-react';
import { subscriptionService, SUBSCRIPTION_PLANS } from '../services/subscriptionService';
import { useAuth } from '../contexts/AuthContext';

export const SubscriptionPlans: React.FC = () => {
  const { user } = useAuth();
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => {
    if (user) loadSubscription();
  }, [user]);

  const loadSubscription = async () => {
    if (!user) return;
    const sub = await subscriptionService.getUserSubscription(user.id);
    setCurrentSubscription(sub);
    setLoading(false);
  };

  const handleSubscribe = async (planId: string) => {
    if (!user) {
      alert('Please log in to subscribe');
      return;
    }

    setSubscribing(planId);
    const result = await subscriptionService.createSubscription(user.id, planId);
    
    if (result) {
      // Redirect to Stripe checkout or show success
      alert('Subscription feature coming soon! This will redirect to Stripe checkout.');
      await loadSubscription();
    } else {
      alert('Failed to create subscription. Please try again.');
    }
    
    setSubscribing(null);
  };

  const handleCancel = async () => {
    if (!currentSubscription) return;
    
    const confirmed = confirm('Are you sure you want to cancel your subscription? You will keep access until the end of your billing period.');
    if (!confirmed) return;

    const success = await subscriptionService.cancelSubscription(currentSubscription.id);
    if (success) {
      alert('Subscription cancelled. You will keep access until the end of your billing period.');
      await loadSubscription();
    } else {
      alert('Failed to cancel subscription. Please try again.');
    }
  };

  const PlanCard = ({ plan, isPopular = false }: { plan: any; isPopular?: boolean }) => {
    const isCurrent = currentSubscription?.plan_type === plan.id;
    const isInvestigatorPlan = plan.id.startsWith('investigator_');

    return (
      <div className={`relative bg-mystery-800 rounded-2xl border-2 p-8 transition-all ${
        isPopular 
          ? 'border-mystery-400 shadow-xl shadow-mystery-500/20 scale-105' 
          : 'border-mystery-700 hover:border-mystery-600'
      }`}>
        {isPopular && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-mystery-500 text-white px-4 py-1 rounded-full text-sm font-bold">
            Most Popular
          </div>
        )}

        {isCurrent && (
          <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">
            Current Plan
          </div>
        )}

        <div className="mb-6">
          {isInvestigatorPlan ? (
            <Shield className="w-12 h-12 text-mystery-400 mb-4" />
          ) : (
            <Crown className="w-12 h-12 text-yellow-400 mb-4" />
          )}
          <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-white">€{plan.price}</span>
            <span className="text-gray-400">/{plan.interval}</span>
          </div>
        </div>

        <ul className="space-y-3 mb-8">
          {plan.features.map((feature: string, idx: number) => (
            <li key={idx} className="flex items-start gap-3 text-gray-300">
              <Check className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={() => isCurrent ? handleCancel() : handleSubscribe(plan.id)}
          disabled={subscribing === plan.id || (!user && !isCurrent)}
          className={`w-full py-3 px-6 rounded-lg font-bold transition-all ${
            isCurrent
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/50'
              : isPopular
              ? 'bg-mystery-500 hover:bg-mystery-400 text-white shadow-lg'
              : 'bg-mystery-700 hover:bg-mystery-600 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {subscribing === plan.id ? 'Processing...' : isCurrent ? 'Cancel Subscription' : 'Subscribe Now'}
        </button>
      </div>
    );
  };

  if (loading && user) {
    return <div className="text-center py-12 text-gray-500">Loading plans...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 flex items-center justify-center gap-3">
          <Sparkles className="w-10 h-10 text-mystery-400" />
          Subscription Plans
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Unlock premium features and support the platform. All plans include access to core features.
        </p>
      </div>

      {/* FREE AI Notice */}
      <div className="mb-12 p-6 bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/50 rounded-xl">
        <div className="flex items-start gap-4">
          <Zap className="w-8 h-8 text-green-400 flex-shrink-0" />
          <div>
            <h3 className="text-xl font-bold text-white mb-2">FREE AI Image Generation! 🎉</h3>
            <p className="text-gray-300">
              Every user gets <strong>2 FREE AI image generations</strong> per case submission. 
              You can regenerate once if you're not satisfied, and choose between both options - or upload your own media instead. 
              <strong className="text-mystery-400 ml-2">No subscription required!</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid md:grid-cols-3 gap-8 mb-12">
        <PlanCard plan={SUBSCRIPTION_PLANS.investigator_basic} />
        <PlanCard plan={SUBSCRIPTION_PLANS.investigator_pro} isPopular={true} />
        <PlanCard plan={SUBSCRIPTION_PLANS.user_premium} />
      </div>

      {/* FAQ */}
      <div className="bg-mystery-800 rounded-2xl p-8 border border-mystery-700">
        <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
        
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Can I cancel anytime?</h3>
            <p className="text-gray-400">
              Yes! You can cancel your subscription at any time. You'll keep access until the end of your current billing period.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-2">What's included in the free tier?</h3>
            <p className="text-gray-400">
              All users can submit cases, comment, vote, and use the AI image generator (2x per case submission). 
              Subscriptions unlock additional AI usage, advanced tools, and remove ads.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Is AI image generation really free?</h3>
            <p className="text-gray-400">
              Yes! Every case submission includes 2 free AI-generated images based on your description. 
              You can regenerate once and choose your favorite. Investigator plans add monthly AI credits for additional research tools.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-2">What payment methods do you accept?</h3>
            <p className="text-gray-400">
              We accept all major credit cards, debit cards, and other payment methods via Stripe.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
