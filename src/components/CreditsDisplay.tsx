import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Coins, TrendingUp, TrendingDown, Clock } from 'lucide-react';

interface CreditsDisplayProps {
  userId: string;
  showHistory?: boolean;
  compact?: boolean;
}

interface CreditTransaction {
  id: string;
  amount: number;
  balance_after: number;
  transaction_type: string;
  source: string;
  description: string;
  created_at: string;
}

export const CreditsDisplay: React.FC<CreditsDisplayProps> = ({ 
  userId, 
  showHistory = false,
  compact = false 
}) => {
  const [credits, setCredits] = useState(0);
  const [lifetimeEarned, setLifetimeEarned] = useState(0);
  const [lifetimeSpent, setLifetimeSpent] = useState(0);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCredits();
    
    // Real-time subscription for credit updates
    const subscription = supabase
      .channel('credits_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`
        },
        (payload) => {
          setCredits(payload.new.credits || 0);
          setLifetimeEarned(payload.new.lifetime_credits_earned || 0);
          setLifetimeSpent(payload.new.lifetime_credits_spent || 0);
        }
      )
      .subscribe();
    
    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  const loadCredits = async () => {
    setLoading(true);
    
    // Load user credits
    const { data: profile } = await supabase
      .from('profiles')
      .select('credits, lifetime_credits_earned, lifetime_credits_spent')
      .eq('id', userId)
      .single();
    
    if (profile) {
      setCredits(profile.credits || 0);
      setLifetimeEarned(profile.lifetime_credits_earned || 0);
      setLifetimeSpent(profile.lifetime_credits_spent || 0);
    }
    
    // Load transaction history if requested
    if (showHistory) {
      const { data: txData } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (txData) {
        setTransactions(txData);
      }
    }
    
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 bg-purple-600/20 px-3 py-1.5 rounded-full animate-pulse">
        <Coins className="w-4 h-4 text-purple-400" />
        <span className="text-sm text-purple-300">Loading...</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 bg-purple-600/20 px-3 py-1.5 rounded-full border border-purple-500/30 hover:bg-purple-600/30 transition-colors">
        <Coins className="w-4 h-4 text-purple-400" />
        <span className="font-bold text-purple-200">{credits}</span>
        <span className="text-xs text-purple-400">Credits</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Balance Card */}
      <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 border border-purple-500/30 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm text-gray-400 mb-1">Available Credits</p>
            <p className="text-4xl font-bold text-purple-200">{credits}</p>
          </div>
          <div className="p-3 bg-purple-500/20 rounded-lg">
            <Coins className="w-8 h-8 text-purple-400" />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-purple-500/20">
          <div>
            <div className="flex items-center gap-2 text-green-400 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs">Earned</span>
            </div>
            <p className="text-lg font-bold text-gray-300">{lifetimeEarned}</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-red-400 mb-1">
              <TrendingDown className="w-4 h-4" />
              <span className="text-xs">Spent</span>
            </div>
            <p className="text-lg font-bold text-gray-300">{lifetimeSpent}</p>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      {showHistory && transactions.length > 0 && (
        <div className="bg-mystery-900 border border-mystery-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-400" />
            Recent Transactions
          </h3>
          
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className={`p-3 rounded-lg border ${
                  tx.amount > 0
                    ? 'bg-green-900/10 border-green-500/30'
                    : 'bg-red-900/10 border-red-500/30'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    {tx.amount > 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-400" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-400" />
                    )}
                    <span
                      className={`font-bold ${
                        tx.amount > 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    Balance: {tx.balance_after}
                  </span>
                </div>
                
                <p className="text-sm text-gray-400 mb-1">{tx.description}</p>
                
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="px-2 py-0.5 bg-mystery-800 rounded">
                    {tx.transaction_type}
                  </span>
                  <span>•</span>
                  <span>{new Date(tx.created_at).toLocaleDateString()}</span>
                  <span>{new Date(tx.created_at).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-600/10 border border-blue-500/30 rounded-lg p-4">
        <p className="text-sm text-blue-300">
          💡 <strong>What are credits?</strong> Credits are virtual currency you can earn from 
          promotions and use for AI generations, featured cases, and more. They're separate 
          from your wallet balance.
        </p>
      </div>
    </div>
  );
};
