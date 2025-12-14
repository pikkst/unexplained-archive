import React, { useState, useEffect } from 'react';
import { X, CreditCard, DollarSign, AlertCircle, Pocket } from 'lucide-react';
import { stripeService } from '../services/stripeService';
import { walletService } from '../services/walletService';
import { useAuth } from '../contexts/AuthContext';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId?: string; // If provided, it's a donation to specific case
  caseName?: string;
  onSuccess?: () => void;
}

export const DepositModal: React.FC<DepositModalProps> = ({ 
  isOpen, 
  onClose,
  caseId,
  caseName,
  onSuccess 
}) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState<number>(20);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'wallet'>('card');
  const [walletBalance, setWalletBalance] = useState<number>(0);

  const isDonation = !!caseId;

  // Fetch wallet balance when modal opens
  useEffect(() => {
    if (isOpen && user && isDonation) {
      walletService.getBalance(user.id).then(setWalletBalance);
    }
    // Reset state on close
    if (!isOpen) {
      setPaymentMethod('card');
      setError(null);
      setProcessing(false);
    }
  }, [isOpen, user, isDonation]);

  // Fee logic:
  // - Platform donations: 0% fee (all goes to platform)
  // - Case donations via Stripe: 10% fee
  // - Case donations via wallet: 0% fee (internal transfer)
  const isPlatformDonation = caseId === 'platform';
  const platformFee = paymentMethod === 'card' && !isPlatformDonation 
    ? stripeService.calculatePlatformFee(amount, 'donation', false) 
    : 0;
  const netAmount = amount - platformFee;
  const canPayWithWallet = walletBalance >= amount;

  // Set default payment method based on balance
  useEffect(() => {
    if (isDonation && canPayWithWallet) {
      setPaymentMethod('wallet');
    } else {
      setPaymentMethod('card');
    }
  }, [walletBalance, isDonation, canPayWithWallet]);

  const handleStripePayment = async () => {
    if (!user) {
      throw new Error('Please log in to continue');
    }

    if (amount < 5) {
      throw new Error('Minimum payment amount is €5');
    }

    console.log('Initiating Stripe payment:', { isDonation, caseId, amount, userId: user.id });

    let session;
    if (isDonation) {
      session = await stripeService.createDonationPayment(caseId!, amount, user.id);
    } else {
      session = await stripeService.createDepositCheckout(amount, user.id);
    }
    
    if (!session) {
      throw new Error('Payment service temporarily unavailable. Please try again.');
    }

    if (!session.checkoutUrl) {
      throw new Error('Invalid payment session. Please contact support.');
    }

    console.log('Redirecting to Stripe checkout:', session.checkoutUrl);
    window.location.href = session.checkoutUrl;
  };

  const handleWalletPayment = async () => {
    if (!user || !caseId || !canPayWithWallet) return;

    const result = await walletService.donateToCase(user.id, caseId, amount);

    if (!result.success) {
      throw new Error(result.error || 'Donation from wallet failed. Please try again.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('Please log in to continue');
      return;
    }

    if (amount < 5) {
      setError('Minimum payment amount is €5');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      if (paymentMethod === 'card') {
        await handleStripePayment();
        // Note: Page redirects, so success/error handling happens on return URL
      } else {
        await handleWalletPayment();
        // On-page success
        onSuccess?.();
        onClose();
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      const errorMessage = err?.message || 'Payment failed. Please try again.';
      setError(errorMessage);
      setProcessing(false);
      
      // Show alert on mobile for better visibility
      if (/Mobi|Android/i.test(navigator.userAgent)) {
        alert(`Payment Error: ${errorMessage}`);
      }
    }
  };

  const quickAmounts = [10, 20, 50, 100];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" style={{ zIndex: 9999 }}>
      <div className="bg-mystery-800 rounded-2xl border border-mystery-600 w-full max-w-md shadow-2xl" style={{ zIndex: 10000 }}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-mystery-700">
          <div>
            <h2 className="text-2xl font-bold text-white">
              {isDonation ? 'Donate to Case' : 'Add Funds'}
            </h2>
            {caseName && (
              <p className="text-sm text-gray-400 mt-1">{caseName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={processing}
            className="p-2 hover:bg-mystery-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Amount Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Select Amount
            </label>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {quickAmounts.map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(amt)}
                  className={`py-3 rounded-lg font-bold transition-all ${
                    amount === amt
                      ? 'bg-mystery-500 text-white ring-2 ring-mystery-400'
                      : 'bg-mystery-700 text-gray-400 hover:bg-mystery-600'
                  }`}
                >
                  €{amt}
                </button>
              ))}
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">€</span>
              <input
                type="number" 
                inputMode="decimal"
                min="5" 
                max="10000" 
                step="1"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full pl-8 pr-4 py-3 bg-mystery-900 border border-mystery-700 rounded-lg text-white text-base focus:outline-none focus:ring-2 focus:ring-mystery-500"
                placeholder="Custom amount"
              />
            </div>
          </div>

          {/* Payment Method Selection */}
          {isDonation && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Payment Method
              </label>
              <div className="bg-mystery-900 rounded-lg p-1.5 grid grid-cols-2 gap-1 border border-mystery-700">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('wallet')}
                  disabled={!canPayWithWallet}
                  className={`px-4 py-2 text-sm font-bold rounded-md transition-colors flex items-center justify-center gap-2 ${
                    paymentMethod === 'wallet' 
                      ? 'bg-mystery-600 text-white' 
                      : canPayWithWallet ? 'text-gray-400 hover:bg-mystery-700' : 'text-gray-600 cursor-not-allowed'
                  }`}
                >
                  <Pocket className="w-5 h-5" />
                  Wallet (€{walletBalance.toFixed(2)})
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`px-4 py-2 text-sm font-bold rounded-md transition-colors flex items-center justify-center gap-2 ${
                    paymentMethod === 'card' ? 'bg-mystery-600 text-white' : 'text-gray-400 hover:bg-mystery-700'
                  }`}
                >
                  <CreditCard className="w-5 h-5" />
                  New Card
                </button>
              </div>
              {!canPayWithWallet && paymentMethod === 'wallet' && (
                <p className="text-xs text-yellow-400 mt-2">Insufficient wallet balance for this amount.</p>
              )}
            </div>
          )}

          {/* Details & Submit */}
          <div>
            {paymentMethod === 'card' ? (
              <>
                {/* Fee Breakdown */}
                <div className="bg-mystery-900 rounded-lg p-4 mb-6 space-y-2 text-sm">
                  {isDonation && (
                    <>
                      <div className="flex justify-between text-gray-400"><span>Amount:</span><span>€{amount.toFixed(2)}</span></div>
                      <div className="flex justify-between text-gray-400"><span>Platform Fee (10%):</span><span>-€{platformFee.toFixed(2)}</span></div>
                      <div className="border-t border-mystery-700 pt-2 flex justify-between text-white font-bold"><span>Net Donation:</span><span className="text-green-400">€{netAmount.toFixed(2)}</span></div>
                    </>
                  )}
                  <div className="border-t border-mystery-700 pt-2 flex justify-between text-white font-bold"><span>You Pay:</span><span className="text-green-400">€{amount.toFixed(2)}</span></div>
                </div>
                {/* Info Notice */}
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 mb-6 flex gap-3"><AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" /><div className="text-sm text-blue-300"><p className="font-medium mb-1">Secure Payment via Stripe</p><p className="text-xs text-blue-400">You'll be redirected to Stripe's secure checkout. We never store your card details.</p></div></div>
              </>
            ) : (
               <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 mb-6 flex gap-3">
                <AlertCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-300">
                  <p className="font-medium mb-1">Confirm Wallet Donation</p>
                  <p className="text-xs text-green-400">€{amount.toFixed(2)} will be transferred to the case (No fees - 100% goes to reward pool!)</p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 mb-4 text-red-400 text-sm">{error}</div>}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={processing}
                className="flex-1 px-6 py-3 bg-mystery-700 hover:bg-mystery-600 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processing || amount < 5 || (paymentMethod === 'wallet' && !canPayWithWallet)}
                className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
              >
                {processing ? (
                  <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing...</>
                ) : (
                  paymentMethod === 'card' ? <><CreditCard className="w-5 h-5" />Pay €{amount}</> : <><Pocket className="w-5 h-5" />Confirm €{amount} Donation</>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};