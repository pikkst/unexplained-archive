import { supabase } from '../lib/supabase';
import type { Database } from '../lib/supabase';

// Types for extended schema tables (wallets, transactions)
interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

interface Transaction {
  id: string;
  from_wallet_id: string | null;
  to_wallet_id: string | null;
  amount: number;
  currency: string;
  type: 'deposit' | 'withdrawal' | 'transfer' | 'payment';
  status: 'pending' | 'completed' | 'failed';
  reference_id: string | null;
  created_at: string;
}

export const walletService = {
  // Get user's wallet
  async getWallet(userId: string): Promise<Wallet | null> {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching wallet:', error);
      return null;
    }
    
    // If no wallet exists, create one
    if (!data) {
      const { data: newWallet, error: createError } = await supabase
        .from('wallets')
        .insert({ user_id: userId, balance: 0 })
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating wallet:', createError);
        return null;
      }
      return newWallet;
    }
    
    return data;
  },

  // Get wallet balance
  async getBalance(userId: string): Promise<number> {
    const wallet = await this.getWallet(userId);
    return wallet?.balance || 0;
  },

  // Get transaction history
  async getTransactions(userId: string, limit = 50): Promise<Transaction[]> {
    const wallet = await this.getWallet(userId);
    if (!wallet) return [];

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .or(`from_wallet_id.eq.${wallet.id},to_wallet_id.eq.${wallet.id}`)
      .in('status', ['completed', 'pending', 'failed']) // Explicitly include all statuses
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching transactions:', error);
      return [];
    }
    return data as Transaction[];
  },

  // Deposit money (creates pending transaction for Stripe)
  async createDepositIntent(userId: string, amount: number): Promise<{ sessionId: string; checkoutUrl: string } | null> {
    try {
      // Call Supabase Edge Function to create Stripe Checkout Session for wallet deposits
      const { data, error } = await supabase.functions.invoke('create-deposit-checkout', {
        body: {
          userId,
          amount,
          successUrl: `${window.location.origin}/payment/success?type=deposit&amount=${amount}`,
          cancelUrl: `${window.location.origin}/wallet?deposit=canceled`
        }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating deposit intent:', error);
      return null;
    }
  },

  // Donate to case reward pool from user's wallet
  async donateToCase(userId: string, caseId: string, amount: number): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('donate_from_wallet', {
        p_user_id: userId,
        p_case_id: caseId,
        p_amount: amount
      });

      if (error) {
        console.error('RPC error donating to case:', error);
        throw new Error(error.message);
      }
      
      if (data && data.success) {
        return { success: true };
      } else {
        const errorMessage = data?.error || 'An unknown error occurred during donation.';
        console.error('Failed to donate from wallet:', errorMessage);
        return { success: false, error: errorMessage };
      }
    } catch (error: any) {
      console.error('Error processing donation:', error);
      return { success: false, error: error.message };
    }
  },

  // Add reward to case pool (used when paying with credits)
  async addRewardToCase(caseId: string, amount: number): Promise<{ success: boolean; error?: string }> {
    try {
      // Update the case reward_amount directly
      const { error } = await supabase
        .from('cases')
        .update({ 
          reward_amount: amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', caseId);

      if (error) {
        console.error('Error adding reward to case:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Error adding reward to case:', error);
      return { success: false, error: error.message };
    }
  },

  // Withdraw funds (only for verified investigators)
  async requestWithdrawal(amount: number, accessToken: string): Promise<boolean> {
    try {
      if (!accessToken) {
        throw new Error('User not authenticated: No access token provided.');
      }

      // Manually construct the fetch call to have full control over headers.
      // This bypasses the supabase-js client's header injection which causes a conflict.
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      const response = await fetch(`${supabaseUrl}/functions/v1/request-withdrawal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          // We explicitly DO NOT include the 'apikey' header here to avoid the conflict.
        },
        body: JSON.stringify({ amount }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Function invoke error:', errorData);
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('Error requesting withdrawal:', error);
      return false;
    }
  },

  // Check transaction limits
  async checkTransactionLimits(userId: string, amount: number): Promise<{ allowed: boolean; reason?: string }> {
    const { data, error } = await supabase
      .from('transaction_limits')
      .select('*')
      .eq('user_id', userId)
      .single();

    // If no limits are set for user, allow transaction
    if (error || !data) {
      return { allowed: true };
    }

    // Check daily limit
    if (data.daily_spent + amount > data.daily_limit) {
      return { 
        allowed: false, 
        reason: `Daily limit exceeded. You can spend €${(data.daily_limit - data.daily_spent).toFixed(2)} more today.`
      };
    }

    // Check monthly limit
    if (data.monthly_spent + amount > data.monthly_limit) {
      return { 
        allowed: false, 
        reason: `Monthly limit exceeded. Complete KYC verification to increase limits.`
      };
    }

    return { allowed: true };
  }
};
