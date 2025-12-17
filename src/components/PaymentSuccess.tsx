import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Wallet, CreditCard, Trophy, Gift, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Universal Payment Success Page
 * 
 * This page handles all successful payment confirmations including:
 * - Wallet deposits
 * - Case reward donations
 * - Subscriptions
 * - Boost purchases
 * 
 * URL Parameters:
 * - type: 'deposit' | 'donation' | 'subscription' | 'boost'
 * - amount: Payment amount
 * - session_id: Stripe session ID (optional)
 * - case_id: Case ID for donations (optional)
 */
export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const type = searchParams.get('type') || 'deposit';
  const amount = searchParams.get('amount');
  const sessionId = searchParams.get('session_id');
  const caseId = searchParams.get('case_id');
  const caseName = searchParams.get('case_name');

  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    // Google Ads Conversion Tracking
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'conversion', {
        'send_to': 'AW-CONVERSION_ID/CONVERSION_LABEL', // Replace with actual Google Ads conversion ID
        'value': amount ? parseFloat(amount) : 0,
        'currency': 'EUR',
        'transaction_id': sessionId || `${type}_${Date.now()}`
      });
    }

    // Countdown timer for auto-redirect
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleRedirect();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [type, amount, sessionId]);

  const handleRedirect = () => {
    switch (type) {
      case 'deposit':
        navigate('/wallet');
        break;
      case 'donation':
        if (caseId) {
          navigate(`/cases/${caseId}`);
        } else {
          navigate('/explore');
        }
        break;
      case 'subscription':
        navigate('/subscription');
        break;
      case 'boost':
        navigate('/explore');
        break;
      default:
        navigate('/profile');
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'deposit':
        return <Wallet className="w-20 h-20 text-green-400" />;
      case 'donation':
        return <Gift className="w-20 h-20 text-blue-400" />;
      case 'subscription':
        return <Trophy className="w-20 h-20 text-yellow-400" />;
      case 'boost':
        return <CreditCard className="w-20 h-20 text-purple-400" />;
      default:
        return <CheckCircle className="w-20 h-20 text-green-400" />;
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'deposit':
        return 'Wallet Deposit Successful!';
      case 'donation':
        return 'Donation Successful!';
      case 'subscription':
        return 'Subscription Activated!';
      case 'boost':
        return 'Boost Purchase Successful!';
      default:
        return 'Payment Successful!';
    }
  };

  const getMessage = () => {
    switch (type) {
      case 'deposit':
        return amount 
          ? `€${parseFloat(amount).toFixed(2)} has been added to your wallet.`
          : 'Your funds have been successfully added to your wallet.';
      case 'donation':
        if (caseName && amount) {
          return `Thank you for donating €${parseFloat(amount).toFixed(2)} to "${caseName}"!`;
        } else if (amount) {
          return `Thank you for your €${parseFloat(amount).toFixed(2)} donation!`;
        }
        return 'Thank you for your generous donation!';
      case 'subscription':
        return 'Your investigator subscription is now active. You can now access premium features.';
      case 'boost':
        return 'Your case boost has been activated and will increase visibility.';
      default:
        return 'Your payment has been processed successfully.';
    }
  };

  const getNextSteps = () => {
    switch (type) {
      case 'deposit':
        return [
          { text: 'View Wallet Balance', link: '/wallet', icon: <Wallet className="w-4 h-4" /> },
          { text: 'Explore Cases', link: '/explore', icon: <ArrowRight className="w-4 h-4" /> },
        ];
      case 'donation':
        return [
          { text: caseId ? 'View Case' : 'Explore Cases', link: caseId ? `/cases/${caseId}` : '/explore', icon: <ArrowRight className="w-4 h-4" /> },
          { text: 'My Profile', link: '/profile', icon: <Trophy className="w-4 h-4" /> },
        ];
      case 'subscription':
        return [
          { text: 'Manage Subscription', link: '/subscription', icon: <Trophy className="w-4 h-4" /> },
          { text: 'Investigator Dashboard', link: '/investigator', icon: <ArrowRight className="w-4 h-4" /> },
        ];
      case 'boost':
        return [
          { text: 'View Cases', link: '/explore', icon: <ArrowRight className="w-4 h-4" /> },
          { text: 'My Profile', link: '/profile', icon: <Trophy className="w-4 h-4" /> },
        ];
      default:
        return [
          { text: 'Go Home', link: '/', icon: <ArrowRight className="w-4 h-4" /> },
        ];
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-mystery-900 via-mystery-800 to-mystery-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Success Card */}
        <div className="bg-mystery-800/80 backdrop-blur-sm rounded-2xl shadow-2xl p-8 md:p-12 text-center border border-mystery-700">
          {/* Animated Success Icon */}
          <div className="mb-6 animate-bounce-slow inline-block">
            {getIcon()}
          </div>

          {/* Checkmark Badge */}
          <div className="mb-4">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto" />
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {getTitle()}
          </h1>

          {/* Message */}
          <p className="text-lg text-gray-300 mb-6">
            {getMessage()}
          </p>

          {/* Transaction Details */}
          {(amount || sessionId) && (
            <div className="bg-mystery-900/50 rounded-lg p-6 mb-8 border border-mystery-700">
              <h3 className="text-sm font-semibold text-mystery-400 mb-4 uppercase tracking-wide">
                Transaction Details
              </h3>
              <div className="space-y-2 text-left">
                {amount && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Amount:</span>
                    <span className="text-white font-semibold text-xl">€{parseFloat(amount).toFixed(2)}</span>
                  </div>
                )}
                {sessionId && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 text-sm">Transaction ID:</span>
                    <span className="text-gray-500 text-sm font-mono">{sessionId.substring(0, 20)}...</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 text-sm">Date:</span>
                  <span className="text-gray-300 text-sm">{new Date().toLocaleString()}</span>
                </div>
                {type === 'deposit' && (
                  <div className="pt-3 mt-3 border-t border-mystery-700">
                    <p className="text-xs text-gray-500 text-center">
                      Funds are now available in your wallet and can be used for donations, subscriptions, and more.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Next Steps */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-mystery-400 mb-4 uppercase tracking-wide">
              What's Next?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {getNextSteps().map((step, index) => (
                <Link
                  key={index}
                  to={step.link}
                  className="flex items-center justify-center gap-2 bg-mystery-700 hover:bg-mystery-600 text-white py-3 px-4 rounded-lg transition-all transform hover:scale-105 border border-mystery-600"
                >
                  {step.icon}
                  <span className="font-medium">{step.text}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Auto-redirect Notice */}
          <div className="text-sm text-gray-500">
            <p>Redirecting in {countdown} seconds...</p>
            <button
              onClick={handleRedirect}
              className="text-mystery-400 hover:text-mystery-300 underline mt-2 transition-colors"
            >
              Go now
            </button>
          </div>
        </div>

        {/* Receipt Email Notice */}
        {user && (
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              A receipt has been sent to <span className="text-white font-medium">{user.email}</span>
            </p>
          </div>
        )}
      </div>

      {/* Custom animations */}
      <style>{`
        @keyframes bounce-slow {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
