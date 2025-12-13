import React, { useEffect, useState } from 'react';
import {
  CreditCard,
  Calendar,
  Zap,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Download,
  Settings,
  ArrowUp,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { subscriptionService, type SubscriptionPlan } from '../services/investigatorSubscriptionService';
import { useNavigate } from 'react-router-dom';

export const SubscriptionManagement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<any>(null);
  const [usageHistory, setUsageHistory] = useState<any[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [availablePlans, setAvailablePlans] = useState<SubscriptionPlan[]>([]);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    if (user) {
      loadSubscriptionData();
      loadPlans();
    }
  }, [user]);

  const loadPlans = async () => {
    const plans = await subscriptionService.getPlans();
    setAvailablePlans(plans);
  };

  const loadSubscriptionData = async () => {
    if (!user) return;

    const [statusData, usage, payments] = await Promise.all([
      subscriptionService.getSubscriptionStatus(user.id),
      subscriptionService.getUsageHistory(user.id, 20),
      subscriptionService.getPaymentHistory(user.id),
    ]);

    setStatus(statusData);
    setUsageHistory(usage);
    setPaymentHistory(payments);
    setLoading(false);
  };

  const handleCancelSubscription = async () => {
    if (!user || !confirm('Are you sure you want to cancel your subscription?')) return;

    setCanceling(true);
    const result = await subscriptionService.cancelSubscription(user.id);
    
    if (result.success) {
      alert('Subscription will be canceled at the end of the period');
      await loadSubscriptionData();
    } else {
      alert(result.error || 'Cancellation failed');
    }
    setCanceling(false);
  };

  const handleResumeSubscription = async () => {
    if (!user) return;

    const result = await subscriptionService.resumeSubscription(user.id);
    
    if (result.success) {
      alert('Subscription resumed!');
      await loadSubscriptionData();
    } else {
      alert(result.error || 'Failed to resume');
    }
  };

  const handleUpgrade = async (newPlanCode: string, billingCycle: 'monthly' | 'yearly') => {
    if (!user || !confirm(`Upgrade to ${newPlanCode} (${billingCycle})?`)) return;

    setUpgrading(true);
    const result = await subscriptionService.upgradeSubscription(user.id, newPlanCode, billingCycle);
    
    if (result.success) {
      alert(result.message || 'Plan upgraded successfully!');
      setShowUpgradeModal(false);
      await loadSubscriptionData();
    } else {
      alert(result.error || 'Upgrade failed');
    }
    setUpgrading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-mystery-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-mystery-400"></div>
      </div>
    );
  }

  if (!status || !status.hasSubscription) {
    return (
      <div className="min-h-screen bg-mystery-900 py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <AlertCircle className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-4">No Subscription</h2>
          <p className="text-gray-400 mb-8">
            You don't have an active subscription. Choose a plan to start using AI tools.
          </p>
          <a
            href="/subscription/plans"
            className="inline-block bg-mystery-500 hover:bg-mystery-600 text-white px-8 py-3 rounded-lg font-semibold transition-all"
          >
            View Plans
          </a>
        </div>
      </div>
    );
  }

  const { plan, subscription, credits, daysUntilRenewal, canceledAtPeriodEnd } = status;

  return (
    <div className="min-h-screen bg-mystery-900 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Subscription Management</h1>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Current Plan */}
          <div className="bg-mystery-800 rounded-xl p-6 border border-mystery-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Current Plan</h2>
              {subscription.status === 'active' ? (
                <CheckCircle className="w-6 h-6 text-green-500" />
              ) : (
                <AlertCircle className="w-6 h-6 text-yellow-500" />
              )}
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-gray-400 text-sm">Plan:</span>
                <p className="text-white font-semibold text-lg">{plan?.plan_name}</p>
              </div>

              <div>
                <span className="text-gray-400 text-sm">Price:</span>
                <p className="text-white font-semibold">
                  €{subscription.price.toFixed(2)}/{subscription.billing_cycle === 'monthly' ? 'month' : 'year'}
                </p>
              </div>

              <div>
                <span className="text-gray-400 text-sm">Status:</span>
                <p className="text-white font-semibold capitalize">{subscription.status}</p>
              </div>

              {canceledAtPeriodEnd && (
                <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-3">
                  <p className="text-yellow-500 text-sm">
                    ⚠️ Subscription will be canceled on {new Date(subscription.current_period_end).toLocaleDateString('en-US')}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-mystery-700 space-y-3">
              {!canceledAtPeriodEnd ? (
                <button
                  onClick={handleCancelSubscription}
                  disabled={canceling}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg transition-all disabled:opacity-50"
                >
                  {canceling ? 'Canceling...' : 'Cancel Subscription'}
                </button>
              ) : (
                <button
                  onClick={handleResumeSubscription}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg transition-all"
                >
                  Resume Subscription
                </button>
              )}
              
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="w-full bg-mystery-700 hover:bg-mystery-600 text-white py-2 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <ArrowUp className="w-4 h-4" />
                Change Plan
              </button>
            </div>
          </div>

          {/* Credits Balance */}
          <div className="bg-mystery-800 rounded-xl p-6 border border-mystery-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">AI Credits</h2>
              <Zap className="w-6 h-6 text-yellow-500" />
            </div>

            {credits ? (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400">Used</span>
                    <span className="text-white font-semibold">
                      {credits.credits_used} / {credits.credits_total === 9999999 ? '∞' : credits.credits_total}
                    </span>
                  </div>
                  {credits.credits_total !== 9999999 && (
                    <div className="w-full bg-mystery-700 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-mystery-500 to-mystery-600 h-3 rounded-full transition-all"
                        style={{
                          width: `${(credits.credits_used / credits.credits_total) * 100}%`,
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="bg-mystery-700 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-gray-400 text-sm">Remaining</span>
                      <p className="text-white font-semibold text-xl">
                        {credits.credits_total === 9999999 ? '∞' : credits.credits_remaining}
                      </p>
                    </div>
                    {credits.resets_at && (
                      <div>
                        <span className="text-gray-400 text-sm">Reset</span>
                        <p className="text-white font-semibold text-sm">
                          {new Date(credits.resets_at).toLocaleDateString('en-US')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {daysUntilRenewal && (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Calendar className="w-4 h-4" />
                    <span>Renews in {daysUntilRenewal} days</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-400">Loading credits...</p>
            )}
          </div>
        </div>

        {/* Usage History */}
        <div className="bg-mystery-800 rounded-xl p-6 border border-mystery-700 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-6 h-6" />
            Recent Usage
          </h2>

          {usageHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-mystery-700">
                    <th className="text-left text-gray-400 py-3 px-4">Tool</th>
                    <th className="text-left text-gray-400 py-3 px-4">Credits</th>
                    <th className="text-left text-gray-400 py-3 px-4">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {usageHistory.slice(0, 10).map((usage, idx) => (
                    <tr key={idx} className="border-b border-mystery-700/50">
                      <td className="py-3 px-4 text-white">{usage.tool_name}</td>
                      <td className="py-3 px-4 text-white">-{usage.credits_cost}</td>
                      <td className="py-3 px-4 text-gray-400 text-sm">
                        {new Date(usage.created_at).toLocaleString('en-US')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">No usage yet</p>
          )}
        </div>

        {/* Payment History */}
        <div className="bg-mystery-800 rounded-xl p-6 border border-mystery-700">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <CreditCard className="w-6 h-6" />
            Payment History
          </h2>

          {paymentHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-mystery-700">
                    <th className="text-left text-gray-400 py-3 px-4">Plan</th>
                    <th className="text-left text-gray-400 py-3 px-4">Amount</th>
                    <th className="text-left text-gray-400 py-3 px-4">Status</th>
                    <th className="text-left text-gray-400 py-3 px-4">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentHistory.map((payment, idx) => (
                    <tr key={idx} className="border-b border-mystery-700/50">
                      <td className="py-3 px-4 text-white capitalize">{payment.plan_code}</td>
                      <td className="py-3 px-4 text-white">€{payment.amount.toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs ${
                            payment.status === 'completed'
                              ? 'bg-green-500/20 text-green-500'
                              : payment.status === 'failed'
                              ? 'bg-red-500/20 text-red-500'
                              : 'bg-yellow-500/20 text-yellow-500'
                          }`}
                        >
                          {payment.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-sm">
                        {new Date(payment.created_at).toLocaleDateString('en-US')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">No payments yet</p>
          )}
        </div>

        {/* Upgrade Modal */}
        {showUpgradeModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-mystery-800 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-mystery-700">
              <div className="p-6 border-b border-mystery-700 flex justify-between items-center sticky top-0 bg-mystery-800">
                <h2 className="text-2xl font-bold text-white">Change Plan</h2>
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <div className="grid md:grid-cols-3 gap-6">
                  {availablePlans.map((p) => {
                    const isCurrentPlan = p.plan_code === subscription?.plan_type;
                    
                    return (
                      <div
                        key={p.id}
                        className={`bg-mystery-900 rounded-lg p-6 border-2 ${
                          isCurrentPlan
                            ? 'border-mystery-500'
                            : 'border-mystery-700 hover:border-mystery-600'
                        } transition-all`}
                      >
                        <h3 className="text-xl font-bold text-white mb-2">{p.plan_name}</h3>
                        <p className="text-gray-400 text-sm mb-4">{p.description}</p>

                        <div className="mb-4">
                          <div className="text-3xl font-bold text-white mb-1">
                            €{p.price_monthly}
                            <span className="text-sm text-gray-400">/month</span>
                          </div>
                          <div className="text-sm text-gray-400">
                            or €{p.price_yearly}/year
                          </div>
                        </div>

                        {isCurrentPlan ? (
                          <div className="bg-mystery-500/20 text-mystery-400 py-2 px-4 rounded-lg text-center font-semibold">
                            Current Plan
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <button
                              onClick={() => handleUpgrade(p.plan_code, 'monthly')}
                              disabled={upgrading}
                              className="w-full bg-mystery-600 hover:bg-mystery-500 text-white py-2 rounded-lg transition-all disabled:opacity-50"
                            >
                              Monthly €{p.price_monthly}
                            </button>
                            <button
                              onClick={() => handleUpgrade(p.plan_code, 'yearly')}
                              disabled={upgrading}
                              className="w-full bg-mystery-500 hover:bg-mystery-400 text-white py-2 rounded-lg transition-all disabled:opacity-50"
                            >
                              Yearly €{p.price_yearly}
                            </button>
                          </div>
                        )}

                        <div className="mt-4 pt-4 border-t border-mystery-700 space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-gray-400">
                            <Zap className="w-4 h-4 text-yellow-500" />
                            {p.ai_credits_monthly === 9999999 ? '∞' : p.ai_credits_monthly} AI credits/month
                          </div>
                          <div className="flex items-center gap-2 text-gray-400">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            {p.processing_speed} processing
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
