import { supabase } from '../lib/supabase';
import { rateLimitService } from './rateLimitService';
import type { Database } from '../lib/supabase';

type Case = Database['public']['Tables']['cases']['Row'];
type CaseInsert = Database['public']['Tables']['cases']['Insert'];

// Helper function to transform DB case to frontend Case type
const transformCase = (dbCase: any): any => {
  if (!dbCase) return null;
  
  const transformed = {
    ...dbCase,
    // Transform snake_case to camelCase - keep both for compatibility
    investigationLog: dbCase.investigation_log || dbCase.investigationLog || [],
    resolutionProposal: dbCase.resolution_proposal || dbCase.resolutionProposal || '',
    investigatorNotes: dbCase.investigator_notes || dbCase.investigatorNotes || '',
    documents: dbCase.documents || [],
  };

  // Debug log to see what we're getting
  if (dbCase.resolution_proposal || dbCase.investigator_notes) {
    console.log('Transforming case:', {
      id: dbCase.id,
      resolution_proposal: dbCase.resolution_proposal,
      investigator_notes: dbCase.investigator_notes,
      investigation_log: dbCase.investigation_log,
      documents: dbCase.documents
    });
  }

  return transformed;
};

export const caseService = {
  // Get all cases with optional filters
  async getCases(filters?: {
    category?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = supabase
      .from('cases')
      .select(`
        *,
        profiles:user_id (
          username,
          avatar_url
        ),
        assigned_investigator:profiles!cases_assigned_investigator_id_fkey (
          id,
          username,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false });

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data?.map(transformCase);
  },

  // Get single case by ID
  async getCaseById(id: string) {
    const { data, error } = await supabase
      .from('cases')
      .select(`
        *,
        profiles:user_id (
          username,
          avatar_url,
          reputation
        ),
        comments (
          *,
          profiles:user_id (
            username,
            avatar_url
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    // Increment view count
    await supabase.rpc('increment_case_views', { case_id: id });

    return transformCase(data);
  },

  // Create new case
  async createCase(caseData: CaseInsert) {
    const { data, error } = await supabase
      .from('cases')
      .insert(caseData)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update case
  async updateCase(id: string, updates: Partial<CaseInsert>) {
    const { data, error } = await supabase
      .from('cases')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return transformCase(data);
  },

  // Delete case
  async deleteCase(id: string) {
    const { error } = await supabase
      .from('cases')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Upload media files
  async uploadMedia(file: File, caseId: string): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${caseId}/${Math.random()}.${fileExt}`;
    const filePath = `case-media/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('media').getPublicUrl(filePath);
    return data.publicUrl;
  },

  // Generate AI image (FREE - 2x per case submission)
  async generateAIImage(
    userId: string,
    caseId: string | null,
    description: string,
    category?: string,
    location?: string
  ): Promise<{ imageUrl: string; remaining: number }> {
    // Check rate limit (2x per case submission - FREE)
    if (caseId) {
      const limitCheck = rateLimitService.checkAIGenerationForCase(userId, caseId);
      if (!limitCheck.allowed) {
        throw new Error('You have used all your free AI generations for this case (2 maximum)');
      }
    } else {
      // Fallback to time-based limit if no case ID
      const limitCheck = rateLimitService.checkLimit(userId, 'ai_image_generation');
      if (!limitCheck.allowed) {
        throw new Error(`Rate limit exceeded. Try again in ${limitCheck.resetIn} seconds`);
      }
    }

    try {
      // Call Supabase Edge Function to generate image securely
      const { data, error } = await supabase.functions.invoke('ai-analysis', {
        body: {
          action: 'generate-image',
          userId,
          caseId,
          description,
          category,
          location
        }
      });

      if (error) throw error;
      
      // Track AI usage is now handled by the Edge Function or confirmed here
      // But we still update local rate limit for immediate feedback
      
      const remaining = caseId
        ? rateLimitService.checkAIGenerationForCase(userId, caseId).remaining
        : rateLimitService.getRemaining(userId, 'ai_image_generation');

      return { imageUrl: data.imageUrl, remaining };
    } catch (error) {
      console.error('AI image generation error:', error);
      throw error;
    }
  },

  // Get cases by location (for map)
  async getCasesByLocation(bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  }) {
    let query = supabase
      .from('cases')
      .select('id, title, category, latitude, longitude, status, created_at')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (bounds) {
      query = query
        .gte('latitude', bounds.south)
        .lte('latitude', bounds.north)
        .gte('longitude', bounds.west)
        .lte('longitude', bounds.east);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data;
  },

  // Process case resolution with reputation updates
  async processCaseResolution(params: {
    caseId: string;
    investigatorId: string;
    submitterId: string;
    rating: number;
    accepted: boolean;
    feedback?: string;
  }) {
    const { data, error } = await supabase.rpc('process_case_resolution', {
      p_case_id: params.caseId,
      p_investigator_id: params.investigatorId,
      p_submitter_id: params.submitterId,
      p_user_rating: params.rating,
      p_resolution_accepted: params.accepted,
      p_user_feedback: params.feedback || null
    });

    if (error) throw error;
    return data;
  },

  // Process community voting outcome
  async processVotingOutcome(caseId: string, communityApproves: boolean) {
    const { data, error } = await supabase.rpc('process_voting_outcome', {
      p_case_id: caseId,
      p_community_approves: communityApproves
    });

    if (error) throw error;
    return data;
  },

  // Admin resolves dispute
  async adminResolveDispute(params: {
    caseId: string;
    decision: 'RELEASE' | 'REFUND' | 'VOTE';
    adminId: string;
  }) {
    const { data, error } = await supabase.rpc('admin_resolve_dispute', {
      p_case_id: params.caseId,
      p_admin_decision: params.decision,
      p_admin_id: params.adminId
    });

    if (error) throw error;
    return data;
  },
};
