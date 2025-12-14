import React, { useState, useEffect } from 'react';
import { DollarSign, Heart, Shield, Award, CreditCard, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { walletService } from '../services/walletService';
import { useAuth } from '../contexts/AuthContext';

interface DonationPageProps {
  onDonateToCase: (caseId: string, amount: number) => void;
}

export const DonationPage: React.FC<DonationPageProps> = ({ onDonateToCase }) => {
  const { user } = useAuth();
  const [selectedAmount, setSelectedAmount] = useState<number>(10);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [targetCaseId, setTargetCaseId] = useState<string>('platform');
  const [activeCases, setActiveCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [donating, setDonating] = useState(false);
  const [balance, setBalance] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  useEffect(() => {
    loadActiveCases();
    if (user) loadWalletBalance();
  }, [user]);

  const loadActiveCases = async () => {
    const { data } = await supabase
      .from('cases')
      .select('*')
      .in('status', ['PENDING', 'ACTIVE', 'INVESTIGATING'])
      .order('created_at', { ascending: false });
    
    if (data) setActiveCases(data);
    setLoading(false);
  };

  const loadWalletBalance = async () => {
    if (!user) return;
    const bal = await walletService.getBalance(user.id);
    setBalance(bal);
  };

  const handleDonate = async () => {
    if (!user) {
      setError('Please log in to donate');
      return;
    }

    const amount = customAmount ? parseFloat(customAmount) : selectedAmount;
    if (amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (amount > balance) {
      setError(`Insufficient balance. You have €${balance.toFixed(2)}`);
      return;
    }

    // Check transaction limits
    const limitCheck = await walletService.checkTransactionLimits(user.id, amount);
    if (!limitCheck.allowed) {
      setError(limitCheck.reason || 'Transaction limit exceeded');
      return;
    }

    setDonating(true);
    setError('');
    setSuccess('');

    try {
      if (targetCaseId === 'platform') {
        // Platform donation - uses RPC to deduct from wallet and record transaction
        const { data, error: donationError } = await supabase.rpc('process_platform_donation', {
          p_user_id: user.id,
          p_amount: amount
        });

        if (donationError) throw donationError;
        if (data?.success === false) {
          throw new Error(data.error || 'Donation failed');
        }
        setSuccess(`Thank you for donating €${amount.toFixed(2)} to support the Unexplained Archive platform!`);
      } else {
        // Case donation - goes to reward pool
        const success = await walletService.donateToCase(user.id, targetCaseId, amount);
        if (!success) throw new Error('Donation failed');
        
        setSuccess(`Thank you! €${amount.toFixed(2)} has been added to the reward pool for the selected case.`);
        onDonateToCase(targetCaseId, amount);
      }

      // Reload balance
      await loadWalletBalance();
      setCustomAmount('');
    } catch (err: any) {
      setError(err.message || 'Donation failed. Please try again.');
    } finally {
      setDonating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-white mb-4 flex justify-center items-center gap-3">
          <Heart className="text-red-500 fill-red-500" /> Support the Truth
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Your contributions help maintain our servers and reward the dedicated investigators uncovering the unexplained.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {/* Platform Support */}
        <div className="bg-mystery-800 p-8 rounded-xl border border-mystery-700 hover:border-mystery-500 transition-colors cursor-pointer relative overflow-hidden"
             onClick={() => setTargetCaseId('platform')}>
          {targetCaseId === 'platform' && (
            <div className="absolute top-0 right-0 p-2 bg-mystery-500 rounded-bl-xl">
              <Shield className="w-5 h-5 text-white" />
            </div>
          )}
          <Shield className="w-12 h-12 text-mystery-400 mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Platform Support</h2>
          <p className="text-gray-400">
            Help us keep the lights on. Funds go towards hosting, development, and community moderation tools.
          </p>
        </div>

        {/* Investigator Support */}
        <div className="bg-mystery-800 p-8 rounded-xl border border-mystery-700 hover:border-mystery-500 transition-colors cursor-pointer relative overflow-hidden"
             onClick={() => setTargetCaseId(activeCases[0]?.id || 'platform')}>
           {targetCaseId !== 'platform' && (
            <div className="absolute top-0 right-0 p-2 bg-mystery-500 rounded-bl-xl">
              <Award className="w-5 h-5 text-white" />
            </div>
          )}
          <Award className="w-12 h-12 text-yellow-400 mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Reward Investigators</h2>
          <p className="text-gray-400">
            Directly fund the reward pools for active cases. Motivate our best researchers to solve complex mysteries.
          </p>
        </div>
      </div>

      <div className="bg-mystery-900 rounded-2xl p-8 border border-mystery-700 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">Make a Donation</h3>
          {user && (
            <div className="text-sm">
              <span className="text-gray-400">Balance: </span>
              <span className="text-white font-bold">€{balance.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/50 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-400">{success}</p>
          </div>
        )}
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">I want to support:</label>
          <select 
            value={targetCaseId} 
            onChange={(e) => setTargetCaseId(e.target.value)}
            className="w-full bg-mystery-800 border border-mystery-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-mystery-500 outline-none"
          >
            <option value="platform">Unexplained Archive Platform (General)</option>
            <optgroup label="Active Cases (Add to Reward Pool)">
              {activeCases.map(c => (
                <option key={c.id} value={c.id}>Case: {c.title}</option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-400 mb-3">Select Amount</label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {[5, 10, 25, 50, 100].map(amount => (
              <button
                key={amount}
                onClick={() => { setSelectedAmount(amount); setCustomAmount(''); }}
                disabled={donating}
                className={`py-3 rounded-lg font-bold transition-all ${
                  selectedAmount === amount && !customAmount
                    ? 'bg-mystery-500 text-white shadow-lg'
                    : 'bg-mystery-800 text-gray-300 hover:bg-mystery-700'
                }`}
              >
                €{amount}
              </button>
            ))}
            <input
              type="number"
              inputMode="decimal"
              placeholder="Custom"
              value={customAmount}
              onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(0); }}
              disabled={donating}
              className="bg-mystery-800 border border-mystery-600 rounded-lg px-3 text-base text-white focus:ring-2 focus:ring-mystery-500 outline-none text-center col-span-2 sm:col-span-1"
            />
          </div>
        </div>

        <button 
          onClick={handleDonate}
          disabled={donating || !user}
          className="w-full py-4 bg-gradient-to-r from-mystery-500 to-mystery-400 hover:from-mystery-400 hover:to-mystery-300 text-white font-bold text-lg rounded-xl shadow-lg shadow-mystery-500/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CreditCard className="w-6 h-6" />
          {donating ? 'Processing...' : `Donate €${customAmount || selectedAmount}`}
        </button>
        
        {!user && (
          <p className="text-center text-sm text-yellow-400 mt-4">
            Please log in to make a donation
          </p>
        )}
        
        <p className="text-center text-xs text-gray-500 mt-4 flex items-center justify-center gap-1">
          <Shield className="w-3 h-3" /> Secure payment processing via wallet balance
        </p>
      </div>
    </div>
  );
};