/**
 * TEAM INVITATIONS PANEL
 * Display and manage team invitations for investigators
 */

import React, { useEffect, useState } from 'react';
import { Mail, Check, X, AlertCircle, Clock, ExternalLink } from 'lucide-react';
import { 
  TeamInvitation, 
  getMyInvitations, 
  acceptTeamInvitation, 
  rejectTeamInvitation,
  subscribeToInvitations 
} from '../services/teamService';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

export const TeamInvitationsPanel: React.FC = () => {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadInvitations();
    }
  }, [user]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const unsubscribe = subscribeToInvitations(user.id, (newInvitation) => {
      setInvitations(prev => [newInvitation, ...prev]);
      
      // Show browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New Team Invitation', {
          body: `${newInvitation.from_investigator?.username} invited you to join their team`,
          icon: '/logo.png'
        });
      }
    });

    return () => unsubscribe();
  }, [user]);

  const loadInvitations = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const data = await getMyInvitations(user.id);
      setInvitations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to load invitations (service unavailable):', err);
      setInvitations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (invitationId: string) => {
    if (!user) return;

    setProcessingId(invitationId);
    try {
      const result = await acceptTeamInvitation(invitationId, user.id);
      
      if (result.success) {
        alert('You have joined the team! Redirecting to case...');
        // Redirect to case detail page
        window.location.href = `/cases/${result.case_id}`;
      } else {
        alert(result.error || 'Failed to accept invitation');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (invitationId: string) => {
    if (!user) return;

    if (!confirm('Are you sure you want to reject this invitation?')) return;

    setProcessingId(invitationId);
    try {
      const result = await rejectTeamInvitation(invitationId, user.id);
      
      if (result.success) {
        await loadInvitations();
      } else {
        alert(result.error || 'Failed to reject invitation');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  if (invitations.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-8">
          <Mail className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No pending invitations</p>
          <p className="text-sm text-gray-500 mt-1">
            You'll be notified when team leaders invite you to their cases
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Mail className="w-6 h-6 text-indigo-600" />
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Team Invitations</h2>
            <p className="text-sm text-gray-500">
              {invitations.length} pending {invitations.length === 1 ? 'invitation' : 'invitations'}
            </p>
          </div>
        </div>
      </div>

      {/* Invitations List */}
      <div className="divide-y divide-gray-200">
        {invitations.map((invitation) => {
          const caseData = (invitation as any).cases;
          const fromInvestigator = invitation.from_investigator;

          return (
            <div key={invitation.id} className="p-6 hover:bg-gray-50 transition-colors">
              {/* Invitation Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {fromInvestigator?.avatar_url ? (
                    <img
                      src={fromInvestigator.avatar_url}
                      alt={fromInvestigator.username}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                      <span className="text-white font-semibold text-lg">
                        {fromInvestigator?.username?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-900">
                      <span className="text-indigo-600">@{fromInvestigator?.username}</span> invited you to join their team
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                      <Clock className="w-4 h-4" />
                      {new Date(invitation.created_at).toLocaleDateString()} at{' '}
                      {new Date(invitation.created_at).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Case Info */}
              {caseData && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{caseData.title}</p>
                      <div className="flex items-center gap-3 mt-2">
                        {caseData.reward !== undefined && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                            Reward: ${caseData.reward}
                          </span>
                        )}
                        <Link
                          to={`/cases/${caseData.id}`}
                          className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                        >
                          View Case
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Message */}
              {invitation.message && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-gray-700 italic">"{invitation.message}"</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => handleAccept(invitation.id)}
                  disabled={processingId === invitation.id}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processingId === invitation.id ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Accept & Join Team
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleReject(invitation.id)}
                  disabled={processingId === invitation.id}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processingId === invitation.id ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <X className="w-4 h-4" />
                      Decline
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
