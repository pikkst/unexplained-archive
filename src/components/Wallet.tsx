import React, { useEffect, useState } from 'react';
import { Wallet as WalletIcon, TrendingUp, TrendingDown, Clock, AlertCircle } from 'lucide-react';
import { walletService } from '../services/walletService';
import { useAuth } from '../contexts/AuthContext';
import { DepositModal } from './DepositModal';
import { supabase } from '../lib/supabase'; // Import Supabase client

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  status: string;
  created_at: string;
  metadata?: any;
}

export const Wallet: React.FC = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    if (user) loadWalletData();
  }, [user]);

  const loadWalletData = async () => {
    if (!user) return;
    
    const [walletBalance, txHistory] = await Promise.all([
      walletService.getBalance(user.id),
      walletService.getTransactions(user.id)
    ]);

    setBalance(walletBalance);
    setTransactions(txHistory);
    setLoading(false);
  };

  const handleWithdraw = async () => {
    if (!user) return;

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setWithdrawError('Please enter a valid amount');
      return;
    }

    if (amount > balance) {
      setWithdrawError('Insufficient balance');
      return;
    }
    
    if (amount < 10) {
        setWithdrawError('Minimum withdrawal amount is €10');
        return;
    }

    setWithdrawing(true);
    setWithdrawError('');

    try {
      // Explicitly get the session and access token from the auth context.
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error('Could not retrieve user session.');
      }

      const success = await walletService.requestWithdrawal(amount, session.access_token);
      
      if (success) {
        await loadWalletData();
        setShowWithdrawModal(false);
        setWithdrawAmount('');
      } else {
        setWithdrawError('Withdrawal request failed. Please try again.');
      }
    } catch (error: any) {
      console.error('Withdrawal handling error:', error);
      setWithdrawError(error.message || 'An unexpected error occurred.');
    } finally {
      setWithdrawing(false);
    }
  };

  const getTransactionIcon = (transaction_type: string) => {
    switch (transaction_type) {
      case 'deposit': return <TrendingUp className="w-5 h-5 text-green-400" />;
      case 'withdrawal': return <TrendingDown className="w-5 h-5 text-red-400" />;
      case 'donation': return <TrendingDown className="w-5 h-5 text-blue-400" />;
      case 'reward': return <TrendingUp className="w-5 h-5 text-yellow-400" />;
      case 'subscription': return <TrendingDown className="w-5 h-5 text-purple-400" />;
      case 'platform_fee': return <TrendingDown className="w-5 h-5 text-gray-400" />;
      default: return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      completed: 'bg-green-500/20 text-green-400',
      pending: 'bg-yellow-500/20 text-yellow-400',
      failed: 'bg-red-500/20 text-red-400',
      refunded: 'bg-gray-500/20 text-gray-400'
    };
    return colors[status as keyof typeof colors] || colors.pending;
  };

  if (loading) {
    return <div className="animate-pulse text-center py-12 text-gray-500">Loading wallet...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Balance Card */}
      <div className="bg-gradient-to-br from-mystery-700 to-mystery-800 rounded-2xl p-8 shadow-xl border border-mystery-600 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <WalletIcon className="w-8 h-8 text-mystery-400" />
          <h2 className="text-2xl font-bold text-white">Your Wallet</h2>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-400 text-sm mb-2">Available Balance</p>
          <p className="text-5xl font-bold text-white">€{balance.toFixed(2)}</p>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => setShowDepositModal(true)}
            className="flex-1 bg-mystery-500 hover:bg-mystery-400 text-white py-3 px-6 rounded-lg font-medium transition-colors"
          >
            Deposit Funds
          </button>
          <button
            onClick={() => setShowWithdrawModal(true)}
            disabled={balance < 10}
            className="flex-1 bg-mystery-800 hover:bg-mystery-700 text-white py-3 px-6 rounded-lg font-medium transition-colors border border-mystery-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Withdraw
          </button>
        </div>

        {/* Transaction Limits Info */}
        <div className="mt-6 p-4 bg-mystery-900/50 rounded-lg border border-mystery-600">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-mystery-400 mt-0.5" />
            <div className="text-sm">
              <p className="text-gray-300 font-medium mb-1">Transaction Limits</p>
              <p className="text-gray-500">
                Unverified: €100/day • Complete KYC verification to increase limits to €5,000/day
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-mystery-800 rounded-xl border border-mystery-700 overflow-hidden">
        <div className="p-6 border-b border-mystery-700">
          <h3 className="text-xl font-bold text-white">Transaction History</h3>
        </div>

        <div className="divide-y divide-mystery-700">
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No transactions yet
            </div>
          ) : (
            transactions.map(tx => (
              <div key={tx.id} className="p-4 hover:bg-mystery-700/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    {getTransactionIcon(tx.transaction_type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium capitalize">
                      {tx.transaction_type.replace('_', ' ')}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(tx.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className={`text-lg font-bold ${
                      ['deposit', 'reward'].includes(tx.transaction_type) 
                        ? 'text-green-400' 
                        : 'text-red-400'
                    }`}>
                      {['deposit', 'reward'].includes(tx.transaction_type) ? '+' : '-'}
                      €{tx.amount.toFixed(2)}
                    </p>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusBadge(tx.status)}`}>
                      {tx.status}
                    </span>
                  </div>
                </div>

                {tx.metadata?.description && (
                  <p className="mt-2 ml-9 text-sm text-gray-400">
                    {tx.metadata.description}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Deposit Modal */}
      <DepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        onSuccess={() => {
          loadWalletData();
          setShowDepositModal(false);
        }}
      />

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-mystery-800 rounded-xl max-w-md w-full p-6 border border-mystery-700">
            <h3 className="text-2xl font-bold text-white mb-4">Withdraw Funds</h3>
            
            <div className="mb-4">
              <p className="text-gray-400 mb-2">Available Balance</p>
              <p className="text-3xl font-bold text-white">€{balance.toFixed(2)}</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Withdrawal Amount (minimum €10)
              </label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="0.00"
                min="10"
                step="0.01"
                className="w-full px-4 py-2 bg-mystery-900 border border-mystery-600 rounded-lg text-white focus:outline-none focus:border-mystery-500"
              />
            </div>

            {withdrawError && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-400 text-sm">
                {withdrawError}
              </div>
            )}

            <div className="mb-4 p-3 bg-mystery-900/50 border border-mystery-600 rounded-lg text-sm text-gray-400">
              <p className="mb-1">• Funds will be transferred to your registered bank account</p>
              <p className="mb-1">• Processing time: 1-3 business days</p>
              <p>• Withdrawal fee: 2% (minimum €1)</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowWithdrawModal(false);
                  setWithdrawAmount('');
                  setWithdrawError('');
                }}
                disabled={withdrawing}
                className="flex-1 px-4 py-2 bg-mystery-700 hover:bg-mystery-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleWithdraw}
                disabled={withdrawing}
                className="flex-1 px-4 py-2 bg-mystery-500 hover:bg-mystery-400 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {withdrawing ? 'Processing...' : 'Confirm Withdrawal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
