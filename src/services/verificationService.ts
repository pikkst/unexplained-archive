// Verification Service - Handle background checks and verification badges
import { supabase } from '../lib/supabase';

export interface BackgroundCheck {
  id: string;
  investigator_id: string;
  check_type: 'standard' | 'premium';
  price_paid: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  verified: boolean;
  verification_level?: 'basic' | 'enhanced' | 'premium';
  badge_color?: string;
  identity_verified: boolean;
  credentials_verified: boolean;
  background_clear: boolean;
  reviewed_by?: string;
  reviewed_at?: string;
  review_notes?: string;
  created_at: string;
  completed_at?: string;
  expires_at?: string;
}

export interface VerificationStatus {
  verified: boolean;
  badge_color: string | null;
  verification_level: string | null;
  verified_at?: string;
  expires_at?: string;
}

export const verificationService = {
  /**
   * Get verification status for a user
   */
  async getVerificationStatus(userId: string): Promise<VerificationStatus> {
    try {
      const { data, error } = await supabase.rpc('get_verification_status', {
        p_user_id: userId
      });

      if (error) throw error;
      
      return data as VerificationStatus;
    } catch (error) {
      console.error('Error fetching verification status:', error);
      return {
        verified: false,
        badge_color: null,
        verification_level: null
      };
    }
  },

  /**
   * Check if user has valid verification
   */
  async isVerified(userId: string): Promise<boolean> {
    const status = await this.getVerificationStatus(userId);
    return status.verified;
  },

  /**
   * Get user's background check history
   */
  async getBackgroundChecks(userId: string): Promise<BackgroundCheck[]> {
    const { data, error } = await supabase
      .from('background_checks')
      .select('*')
      .eq('investigator_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching background checks:', error);
      return [];
    }

    return data as BackgroundCheck[];
  },

  /**
   * Get latest background check
   */
  async getLatestCheck(userId: string): Promise<BackgroundCheck | null> {
    const { data, error } = await supabase
      .from('background_checks')
      .select('*')
      .eq('investigator_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return null;
    }

    return data as BackgroundCheck;
  },

  /**
   * Request background check via Stripe
   */
  async requestVerification(userId: string, checkType: 'standard' | 'premium' = 'standard'): Promise<{ url: string } | null> {
    try {
      const { data, error } = await supabase.functions.invoke('request-verification-checkout', {
        body: { userId, checkType }
      });

      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('Error creating verification checkout:', error);
      return null;
    }
  },

  /**
   * Request verification with wallet balance
   */
  async requestVerificationWithWallet(userId: string, checkType: 'standard' | 'premium' = 'standard'): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('request_background_check', {
        p_investigator_id: userId,
        p_check_type: checkType,
        p_stripe_payment_id: null
      });

      if (error) {
        console.error('RPC Error:', error);
        return { success: false, error: error.message };
      }
      
      if (data && data.success) {
        return { success: true };
      } else {
        return { success: false, error: data?.error || 'Unknown error occurred' };
      }
    } catch (error: any) {
      console.error('Error requesting verification with wallet:', error);
      return { success: false, error: error.message || 'Network error' };
    }
  },

  /**
   * Upload verification document
   */
  async uploadDocument(checkId: string, file: File, documentType: string): Promise<string | null> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${checkId}/${documentType}-${Date.now()}.${fileExt}`;
      const filePath = `verification-documents/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('verification-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('verification-documents')
        .getPublicUrl(filePath);

      // Update background check with document
      const { data: check } = await supabase
        .from('background_checks')
        .select('documents')
        .eq('id', checkId)
        .single();

      const documents = check?.documents || [];
      documents.push({
        type: documentType,
        url: publicUrl,
        verified: false,
        uploaded_at: new Date().toISOString()
      });

      const { error: updateError } = await supabase
        .from('background_checks')
        .update({ documents })
        .eq('id', checkId);

      if (updateError) throw updateError;

      return publicUrl;
    } catch (error) {
      console.error('Error uploading document:', error);
      return null;
    }
  },

  /**
   * Get verification badge component props
   */
  getBadgeProps(verificationStatus: VerificationStatus): {
    show: boolean;
    color: string;
    label: string;
    icon: string;
  } {
    if (!verificationStatus.verified) {
      return {
        show: false,
        color: '',
        label: '',
        icon: ''
      };
    }

    const badgeConfig = {
      blue: {
        color: 'text-blue-400 border-blue-400 bg-blue-400/10',
        label: 'Verified',
        icon: '✓'
      },
      gold: {
        color: 'text-yellow-400 border-yellow-400 bg-yellow-400/10',
        label: 'Premium Verified',
        icon: '★'
      },
      diamond: {
        color: 'text-purple-400 border-purple-400 bg-purple-400/10',
        label: 'Elite Verified',
        icon: '◆'
      }
    };

    const config = badgeConfig[verificationStatus.badge_color as keyof typeof badgeConfig] || badgeConfig.blue;

    return {
      show: true,
      ...config
    };
  },

  /**
   * Check if verification is expiring soon (within 30 days)
   */
  isExpiringSoon(verificationStatus: VerificationStatus): boolean {
    if (!verificationStatus.expires_at) return false;

    const expiresAt = new Date(verificationStatus.expires_at);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  },

  /**
   * Get days until verification expires
   */
  getDaysUntilExpiry(verificationStatus: VerificationStatus): number | null {
    if (!verificationStatus.expires_at) return null;

    const expiresAt = new Date(verificationStatus.expires_at);
    const now = new Date();
    return Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }
};
