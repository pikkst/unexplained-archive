import { supabase } from '../lib/supabase';
import type { Database } from '../lib/supabase';

type Comment = Database['public']['Tables']['comments']['Row'];
type CommentInsert = Database['public']['Tables']['comments']['Insert'];

export const commentService = {
  // Get comments for a case
  async getCommentsByCase(caseId: string) {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        profiles:user_id (
          username,
          avatar_url,
          role
        )
      `)
      .eq('case_id', caseId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  },

  // Create comment
  async createComment(commentData: CommentInsert) {
    const { data, error } = await supabase
      .from('comments')
      .insert(commentData)
      .select(`
        *,
        profiles:user_id (
          username,
          avatar_url,
          role
        )
      `)
      .single();

    if (error) throw error;
    return data;
  },

  // Update comment
  async updateComment(id: string, content: string) {
    const { data, error } = await supabase
      .from('comments')
      .update({ content })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete comment
  async deleteComment(id: string) {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Like comment
  async likeComment(id: string) {
    const { error } = await supabase.rpc('increment_comment_likes', {
      comment_id: id,
    });

    if (error) throw error;
  },
};

export const investigatorService = {
  // Get all investigators
  async getInvestigators(filters?: {
    verified?: boolean;
    specialization?: string;
    limit?: number;
  }) {
    let query = supabase
      .from('investigators')
      .select(`
        *,
        profiles:user_id (
          username,
          avatar_url,
          bio
        )
      `)
      .order('rating', { ascending: false });

    if (filters?.verified !== undefined) {
      query = query.eq('verified', filters.verified);
    }

    if (filters?.specialization) {
      query = query.contains('specialization', [filters.specialization]);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  },

  // Get investigator by user ID
  async getInvestigatorByUserId(userId: string) {
    const { data, error } = await supabase
      .from('investigators')
      .select(`
        *,
        profiles:user_id (
          username,
          avatar_url,
          bio,
          reputation
        )
      `)
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data;
  },

  // Apply to become investigator
  async applyAsInvestigator(data: {
    userId: string;
    credentials: string;
    specialization: string[];
  }) {
    const { data: result, error } = await supabase
      .from('investigators')
      .insert({
        user_id: data.userId,
        credentials: data.credentials,
        specialization: data.specialization,
        verified: false,
      })
      .select()
      .single();

    if (error) throw error;
    return result;
  },

  // Verify investigator (admin only)
  async verifyInvestigator(id: string, verified: boolean) {
    const { data, error } = await supabase
      .from('investigators')
      .update({ verified })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Claim case
  async claimCase(caseId: string, investigatorId: string) {
    const { data, error } = await supabase
      .from('cases')
      .update({
        investigator_id: investigatorId,
        status: 'investigating',
      })
      .eq('id', caseId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

export const donationService = {
  // Create donation record
  async createDonation(data: {
    fromUserId: string;
    toInvestigatorId: string;
    amount: number;
    currency: string;
    message?: string;
  }) {
    const { data: result, error } = await supabase
      .from('donations')
      .insert({
        from_user_id: data.fromUserId,
        to_investigator_id: data.toInvestigatorId,
        amount: data.amount,
        currency: data.currency,
        message: data.message || null,
      })
      .select()
      .single();

    if (error) throw error;
    return result;
  },

  // Get donations for investigator
  async getDonationsByInvestigator(investigatorId: string) {
    const { data, error } = await supabase
      .from('donations')
      .select(`
        *,
        from_profile:from_user_id (
          username,
          avatar_url
        )
      `)
      .eq('to_investigator_id', investigatorId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Get total donations received
  async getTotalDonations(investigatorId: string) {
    const { data, error } = await supabase
      .from('donations')
      .select('amount')
      .eq('to_investigator_id', investigatorId);

    if (error) throw error;

    const total = data.reduce((sum, donation) => sum + donation.amount, 0);
    return total;
  },
};
