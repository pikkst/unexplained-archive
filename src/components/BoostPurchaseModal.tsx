import React, { useState, useEffect } from 'react';
import { X, Zap, TrendingUp, Sparkles, CreditCard, Wallet } from 'lucide-react';
import { boostService } from '../services/boostService';
import { walletService } from '../services/walletService';

interface BoostPurchaseModalProps {
  caseId: string;
  userId: string;
  caseTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface BoostTier {
  id: string;
  boost_type: string;
  duration_hours: number;
  price: number;
  display_name: string;
  features: string[];
}

export const BoostPurchaseModal: React.FC<BoostPurchaseModalProps> = ({
  caseId,
  userId,
  caseTitle,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [pricingTiers, setPricingTiers] = useState<BoostTier[]>([]);
  const [selectedTier, setSelectedTier] = useState<BoostTier | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | 'wallet'>('stripe');
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      // Load pricing tiers
      const tiers = await boostService.getBoostPricing();
      setPricingTiers(tiers);
      
      // Load wallet balance
      const balance = await walletService.getBalance(userId);
      setWalletBalance(balance);
    } catch (error) {
      console.error('Failed to load boost data:', error);
    }
  };

  const handlePurchase = async () => {
    if (!selectedTier) return;

    setLoading(true);
    try {
      if (paymentMethod === 'wallet') {
        // Check balance
        if (walletBalance < selectedTier.price) {
          alert('Insufficient wallet balance. Please choose Stripe payment or deposit funds.');
          setLoading(false);
          return;
        }

        // Purchase with wallet
        const result = await boostService.purchaseBoostWithWallet(
          caseId,
          userId,
          selectedTier.boost_type
        );

        if (result.success) {
          alert(`✅ Boost activated! Your case will be featured for ${selectedTier.duration_hours} hours.`);
          onSuccess?.();
          onClose();
        } else {
          alert(`❌ ${result.error || 'Failed to purchase boost. Check console for details.'}`);
        }
      } else {
        // Purchase with Stripe using the new direct payment function
        const result = await boostService.purchaseBoostWithStripe(
          caseId,
          userId,
          selectedTier.boost_type,
          selectedTier.price,
          `Case Boost: ${selectedTier.display_name}`
        );

        if (result?.checkoutUrl) {
          // Redirect to Stripe Checkout
          window.location.href = result.checkoutUrl;
        } else {
          alert('❌ Failed to create checkout session');
        }
      }
    } catch (error) {
      console.error('Purchase failed:', error);
      alert('❌ Purchase failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
      <div className="bg-mystery-800 rounded-xl border border-mystery-700 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-mystery-800 border-b border-mystery-700 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Zap className="w-6 h-6 text-yellow-400" />
              Boost Your Case
            </h2>
            <p className="text-gray-400 text-sm mt-1">{caseTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Pricing Tiers */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">Select Boost Duration</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {pricingTiers.map((tier) => (
                <button
                  key={tier.boost_type}
                  onClick={() => setSelectedTier(tier)}
                  className={`
                    p-6 rounded-lg border-2 transition-all text-left
                    ${selectedTier?.boost_type === tier.boost_type
                      ? 'border-yellow-500 bg-yellow-500/10'
                      : 'border-mystery-700 bg-mystery-900/50 hover:border-mystery-600'
                    }
                  `}
                >
                  <div className="text-center mb-4">
                    <div className="text-2xl font-bold text-white mb-1">
                      €{tier.price.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-400">{tier.display_name}</div>
                  </div>

                  <div className="space-y-2">
                    {tier.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-gray-300">
                        <Sparkles className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  {selectedTier?.boost_type === tier.boost_type && (
                    <div className="mt-4 text-center">
                      <span className="inline-block bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-bold">
                        SELECTED
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method */}
          {selectedTier && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-4">Payment Method</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setPaymentMethod('stripe')}
                  className={`
                    p-4 rounded-lg border-2 transition-all
                    ${paymentMethod === 'stripe'
                      ? 'border-mystery-500 bg-mystery-500/10'
                      : 'border-mystery-700 bg-mystery-900/50 hover:border-mystery-600'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-6 h-6 text-mystery-400" />
                    <div className="text-left">
                      <div className="font-semibold text-white">Credit Card</div>
                      <div className="text-sm text-gray-400">Pay with Stripe</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setPaymentMethod('wallet')}
                  className={`
                    p-4 rounded-lg border-2 transition-all
                    ${paymentMethod === 'wallet'
                      ? 'border-mystery-500 bg-mystery-500/10'
                      : 'border-mystery-700 bg-mystery-900/50 hover:border-mystery-600'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <Wallet className="w-6 h-6 text-mystery-400" />
                    <div className="text-left flex-1">
                      <div className="font-semibold text-white">Wallet Balance</div>
                      <div className="text-sm text-gray-400">
                        €{walletBalance.toFixed(2)} available
                      </div>
                    </div>
                  </div>
                  {walletBalance < selectedTier.price && (
                    <div className="mt-2 text-xs text-red-400">
                      Insufficient balance
                    </div>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Benefits */}
          <div className="bg-mystery-900/50 border border-mystery-700 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Why Boost Your Case?
            </h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>• Increase visibility by up to 10x</li>
              <li>• Appear at the top of browse and search results</li>
              <li>• Get featured on homepage and newsletters</li>
              <li>• Track impressions and clicks with analytics</li>
              <li>• Attract more qualified investigators</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-mystery-700 hover:bg-mystery-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handlePurchase}
              disabled={!selectedTier || loading}
              className={`
                flex-1 px-6 py-3 rounded-lg font-bold transition-all
                ${!selectedTier || loading
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-lg shadow-yellow-500/20'
                }
              `}
            >
              {loading ? 'Processing...' : `Purchase ${selectedTier?.display_name || 'Boost'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
