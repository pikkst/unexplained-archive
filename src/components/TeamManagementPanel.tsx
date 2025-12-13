/**
 * TEAM MANAGEMENT PANEL
 * Display and manage team members for a case
 */

import React, { useEffect, useState } from 'react';
import { Users, UserPlus, UserMinus, AlertCircle, Award, Crown } from 'lucide-react';
import { 
  TeamMember, 
  getCaseTeam, 
  removeTeamMember, 
  leaveTeam,
  subscribeToTeamChanges 
} from '../services/teamService';

interface TeamManagementPanelProps {
  caseId: string;
  currentUserId: string;
  isLeader: boolean;
  onInviteClick: () => void;
  onRewardSplitClick: () => void;
}

export const TeamManagementPanel: React.FC<TeamManagementPanelProps> = ({
  caseId,
  currentUserId,
  isLeader,
  onInviteClick,
  onRewardSplitClick
}) => {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  // Load team members
  useEffect(() => {
    loadTeam();
  }, [caseId]);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribe = subscribeToTeamChanges(caseId, (updatedMember) => {
      loadTeam(); // Reload full team on any change
    });

    return () => unsubscribe();
  }, [caseId]);

  const loadTeam = async () => {
    try {
      setLoading(true);
      const members = await getCaseTeam(caseId);
      setTeam(members);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Remove ${memberName} from the team?`)) return;

    setRemovingMemberId(memberId);
    try {
      const result = await removeTeamMember(caseId, currentUserId, memberId);
      if (result.success) {
        await loadTeam();
      } else {
        alert(result.error || 'Failed to remove member');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRemovingMemberId(null);
    }
  };

  const handleLeaveTeam = async () => {
    if (!confirm('Are you sure you want to leave this team?')) return;

    setLeaving(true);
    try {
      const result = await leaveTeam(caseId, currentUserId);
      if (result.success) {
        alert('You have left the team');
        window.location.reload();
      } else {
        alert(result.error || 'Failed to leave team');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLeaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  const isSoloInvestigation = team.length === 1;

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-indigo-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {isSoloInvestigation ? 'Solo Investigation' : 'Investigation Team'}
              </h2>
              <p className="text-sm text-gray-500">
                {team.length} {team.length === 1 ? 'investigator' : 'investigators'}
              </p>
            </div>
          </div>

          {isLeader && (
            <div className="flex gap-2">
              <button
                onClick={onInviteClick}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Invite Member
              </button>

              {!isSoloInvestigation && (
                <button
                  onClick={onRewardSplitClick}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Award className="w-4 h-4" />
                  Reward Split
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Error loading team</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Team Members List */}
      <div className="p-6">
        <div className="space-y-3">
          {team.map((member) => {
            const isCurrentUser = member.investigator_id === currentUserId;
            const isLeaderMember = member.role === 'leader';

            return (
              <div
                key={member.investigator_id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {/* Member Info */}
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="relative">
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt={member.username}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                        <span className="text-white font-semibold text-lg">
                          {member.username[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    {isLeaderMember && (
                      <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white">
                        <Crown className="w-3 h-3 text-yellow-900" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">
                        {member.full_name || member.username}
                      </p>
                      {isLeaderMember && (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
                          Team Leader
                        </span>
                      )}
                      {isCurrentUser && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                          You
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-sm text-gray-500">@{member.username}</p>
                      <p className="text-sm text-gray-400">•</p>
                      <p className="text-sm text-gray-600">
                        Reputation: <span className="font-medium">{member.reputation}</span>
                      </p>
                      {member.contribution_percentage && (
                        <>
                          <p className="text-sm text-gray-400">•</p>
                          <p className="text-sm text-green-600 font-medium">
                            {member.contribution_percentage}% reward
                          </p>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Joined {new Date(member.joined_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {/* Remove button (leader only, cannot remove self) */}
                  {isLeader && !isCurrentUser && !isLeaderMember && (
                    <button
                      onClick={() => handleRemoveMember(member.investigator_id, member.username)}
                      disabled={removingMemberId === member.investigator_id}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Remove from team"
                    >
                      {removingMemberId === member.investigator_id ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-600"></div>
                      ) : (
                        <UserMinus className="w-5 h-5" />
                      )}
                    </button>
                  )}

                  {/* Leave button (for non-leader members) */}
                  {isCurrentUser && !isLeaderMember && (
                    <button
                      onClick={handleLeaveTeam}
                      disabled={leaving}
                      className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {leaving ? 'Leaving...' : 'Leave Team'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {team.length === 0 && (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No team members yet</p>
            {isLeader && (
              <button
                onClick={onInviteClick}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Invite First Member
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
