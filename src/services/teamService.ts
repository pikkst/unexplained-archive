/**
 * TEAM COLLABORATION SERVICE
 * Manages multi-investigator case teams
 */

import { supabase } from '../lib/supabase';

// ========================================
// TYPES
// ========================================

export interface TeamMember {
  investigator_id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  role: 'leader' | 'member';
  contribution_percentage?: number;
  status: 'invited' | 'active' | 'left' | 'removed';
  joined_at: string;
  reputation: number;
}

export interface TeamInvitation {
  id: string;
  case_id: string;
  from_investigator_id: string;
  to_investigator_id: string;
  message?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  created_at: string;
  responded_at?: string;
  // Populated data
  case?: {
    id: string;
    title: string;
    reward: number;
  };
  from_investigator?: {
    username: string;
    avatar_url?: string;
  };
}

export interface RewardSplit {
  investigator_id: string;
  percentage: number;
}

// ========================================
// CASE CLAIMING
// ========================================

/**
 * Claim case as team leader (single investigator initially)
 */
export const claimCaseAsLeader = async (
  caseId: string,
  investigatorId: string
): Promise<{ success: boolean; error?: string }> => {
  const { data, error } = await supabase.rpc('claim_case_as_leader', {
    p_case_id: caseId,
    p_investigator_id: investigatorId
  });

  if (error) return { success: false, error: error.message };
  return data;
};

// ========================================
// TEAM INVITATIONS
// ========================================

/**
 * Invite investigator to join team (leader only)
 */
export const inviteTeamMember = async (
  caseId: string,
  fromInvestigatorId: string,
  toInvestigatorId: string,
  message?: string
): Promise<{ success: boolean; invitation_id?: string; error?: string }> => {
  const { data, error } = await supabase.rpc('invite_team_member', {
    p_case_id: caseId,
    p_from_investigator_id: fromInvestigatorId,
    p_to_investigator_id: toInvestigatorId,
    p_message: message || null
  });

  if (error) return { success: false, error: error.message };
  return data;
};

/**
 * Accept team invitation
 */
export const acceptTeamInvitation = async (
  invitationId: string,
  investigatorId: string
): Promise<{ success: boolean; case_id?: string; error?: string }> => {
  const { data, error } = await supabase.rpc('accept_team_invitation', {
    p_invitation_id: invitationId,
    p_investigator_id: investigatorId
  });

  if (error) return { success: false, error: error.message };
  return data;
};

/**
 * Reject team invitation
 */
export const rejectTeamInvitation = async (
  invitationId: string,
  investigatorId: string
): Promise<{ success: boolean; error?: string }> => {
  const { data, error } = await supabase.rpc('reject_team_invitation', {
    p_invitation_id: invitationId,
    p_investigator_id: investigatorId
  });

  if (error) return { success: false, error: error.message };
  return data;
};

/**
 * Get pending invitations for investigator
 */
export const getMyInvitations = async (investigatorId: string): Promise<TeamInvitation[]> => {
  const { data, error } = await supabase
    .from('team_invitations')
    .select(`
      *,
      cases:case_id (
        id,
        title
      ),
      from_investigator:profiles!from_investigator_id (
        username,
        avatar_url
      )
    `)
    .eq('to_investigator_id', investigatorId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * Get sent invitations for a case (leader view)
 */
export const getCaseInvitations = async (caseId: string): Promise<TeamInvitation[]> => {
  const { data, error } = await supabase
    .from('team_invitations')
    .select(`
      *,
      to_investigator:profiles!to_investigator_id (
        username,
        avatar_url,
        reputation
      )
    `)
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

/**
 * Cancel pending invitation (leader only)
 */
export const cancelInvitation = async (invitationId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('team_invitations')
    .update({ status: 'cancelled' })
    .eq('id', invitationId)
    .eq('status', 'pending');

  if (error) throw error;
  return true;
};

// ========================================
// TEAM MANAGEMENT
// ========================================

/**
 * Get team members for a case
 */
export const getCaseTeam = async (caseId: string): Promise<TeamMember[]> => {
  const { data, error } = await supabase.rpc('get_case_team', {
    p_case_id: caseId
  });

  if (error) throw error;
  return data || [];
};

/**
 * Remove team member (leader only)
 */
export const removeTeamMember = async (
  caseId: string,
  leaderId: string,
  memberId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> => {
  const { data, error } = await supabase.rpc('remove_team_member', {
    p_case_id: caseId,
    p_leader_id: leaderId,
    p_member_id: memberId,
    p_reason: reason || null
  });

  if (error) return { success: false, error: error.message };
  return data;
};

/**
 * Leave team (member voluntarily leaves)
 */
export const leaveTeam = async (
  caseId: string,
  investigatorId: string
): Promise<{ success: boolean; error?: string }> => {
  const { data, error } = await supabase.rpc('leave_team', {
    p_case_id: caseId,
    p_investigator_id: investigatorId
  });

  if (error) return { success: false, error: error.message };
  return data;
};

/**
 * Check if user is team leader for a case
 */
export const isTeamLeader = async (caseId: string, investigatorId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('case_team_members')
    .select('role')
    .eq('case_id', caseId)
    .eq('investigator_id', investigatorId)
    .eq('role', 'leader')
    .eq('status', 'active')
    .single();

  if (error) return false;
  return !!data;
};

/**
 * Check if user is on team (any role)
 */
export const isTeamMember = async (caseId: string, investigatorId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('case_team_members')
    .select('id')
    .eq('case_id', caseId)
    .eq('investigator_id', investigatorId)
    .eq('status', 'active')
    .single();

  if (error) return false;
  return !!data;
};

// ========================================
// REWARD SPLITTING
// ========================================

/**
 * Set reward split percentages (leader only)
 */
export const setRewardSplit = async (
  caseId: string,
  leaderId: string,
  splits: RewardSplit[]
): Promise<{ success: boolean; error?: string }> => {
  // Validate total = 100%
  const total = splits.reduce((sum, split) => sum + split.percentage, 0);
  if (total !== 100) {
    return { success: false, error: 'Total percentage must equal 100%' };
  }

  const { data, error } = await supabase.rpc('set_reward_split', {
    p_case_id: caseId,
    p_leader_id: leaderId,
    p_splits: splits
  });

  if (error) return { success: false, error: error.message };
  return data;
};

/**
 * Get current reward split for a case
 */
export const getRewardSplit = async (caseId: string): Promise<RewardSplit[]> => {
  const { data, error } = await supabase
    .from('case_team_members')
    .select('investigator_id, contribution_percentage')
    .eq('case_id', caseId)
    .eq('status', 'active')
    .not('contribution_percentage', 'is', null);

  if (error) throw error;
  
  return (data || []).map(d => ({
    investigator_id: d.investigator_id,
    percentage: d.contribution_percentage!
  }));
};

/**
 * Calculate default equal split
 */
export const calculateEqualSplit = (teamMembers: TeamMember[]): RewardSplit[] => {
  const activeMembers = teamMembers.filter(m => m.status === 'active');
  
  if (activeMembers.length === 0) return [];
  
  const percentage = Math.floor(100 / activeMembers.length);
  const remainder = 100 - (percentage * activeMembers.length);
  
  // Find leader to give remainder to, otherwise give to first member
  const leaderIndex = activeMembers.findIndex(m => m.role === 'leader');
  const recipientIndex = leaderIndex >= 0 ? leaderIndex : 0;

  return activeMembers.map((member, index) => ({
    investigator_id: member.investigator_id,
    percentage: index === recipientIndex ? percentage + remainder : percentage
  }));
};

// ========================================
// SEARCH INVESTIGATORS
// ========================================

/**
 * Search verified investigators (for inviting to team)
 */
export const searchInvestigators = async (
  query: string,
  excludeIds: string[] = []
): Promise<Array<{
  id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  reputation: number;
  specialization?: string[];
}>> => {
  let dbQuery = supabase
    .from('profiles')
    .select(`
      id,
      username,
      full_name,
      avatar_url,
      reputation,
      investigators!inner (
        verified,
        specialization,
        rating
      )
    `)
    .eq('role', 'investigator')
    .eq('investigators.verified', true);

  // Exclude already invited/team members
  if (excludeIds.length > 0) {
    dbQuery = dbQuery.not('id', 'in', `(${excludeIds.join(',')})`);
  }

  // Search by username or full name
  if (query.trim()) {
    dbQuery = dbQuery.or(`username.ilike.%${query}%,full_name.ilike.%${query}%`);
  }

  dbQuery = dbQuery.order('reputation', { ascending: false }).limit(10);

  const { data, error } = await dbQuery;

  if (error) throw error;
  
  return (data || []).map(d => ({
    id: d.id,
    username: d.username,
    full_name: d.full_name || '',
    avatar_url: d.avatar_url || undefined,
    reputation: d.reputation,
    specialization: (d as any).investigators?.specialization
  }));
};

// ========================================
// REAL-TIME SUBSCRIPTIONS
// ========================================

/**
 * Subscribe to team member changes for a case
 */
export const subscribeToTeamChanges = (
  caseId: string,
  callback: (member: TeamMember) => void
) => {
  const channel = supabase
    .channel(`team:${caseId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'case_team_members',
        filter: `case_id=eq.${caseId}`
      },
      async (payload) => {
        // Fetch full member details
        const { data } = await supabase
          .from('case_team_members')
          .select(`
            investigator_id,
            role,
            contribution_percentage,
            status,
            joined_at,
            profiles!investigator_id (
              username,
              full_name,
              avatar_url,
              reputation
            )
          `)
          .eq('id', payload.new.id)
          .single();

        if (data) {
          const profile = (data as any).profiles;
          callback({
            investigator_id: data.investigator_id,
            username: profile.username,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            role: data.role as 'leader' | 'member',
            contribution_percentage: data.contribution_percentage,
            status: data.status as any,
            joined_at: data.joined_at,
            reputation: profile.reputation
          });
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

/**
 * Subscribe to invitation updates for investigator
 */
export const subscribeToInvitations = (
  investigatorId: string,
  callback: (invitation: TeamInvitation) => void
) => {
  const channel = supabase
    .channel(`invitations:${investigatorId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'team_invitations',
        filter: `to_investigator_id=eq.${investigatorId}`
      },
      async (payload) => {
        // Fetch full invitation details
        const { data } = await supabase
          .from('team_invitations')
          .select(`
            *,
            cases:case_id (title, reward),
            from_investigator:profiles!from_investigator_id (username, avatar_url)
          `)
          .eq('id', payload.new.id)
          .single();

        if (data) {
          callback(data as any);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
