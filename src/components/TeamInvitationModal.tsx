/**
 * TEAM INVITATION MODAL
 * Search and invite investigators to join team
 */

import React, { useState, useEffect } from 'react';
import { X, Search, UserPlus, CheckCircle, AlertCircle, Mail } from 'lucide-react';
import { 
  searchInvestigators, 
  inviteTeamMember,
  getCaseInvitations,
  cancelInvitation,
  TeamInvitation
} from '../services/teamService';

interface TeamInvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  leaderId: string;
  excludeIds: string[]; // Already on team or invited
}

export const TeamInvitationModal: React.FC<TeamInvitationModalProps> = ({
  isOpen,
  onClose,
  caseId,
  leaderId,
  excludeIds
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [message, setMessage] = useState('');
  const [selectedInvestigator, setSelectedInvestigator] = useState<string | null>(null);

  // Load pending invitations
  useEffect(() => {
    if (isOpen) {
      loadInvitations();
    }
  }, [isOpen]);

  // Search investigators (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        handleSearch();
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadInvitations = async () => {
    try {
      const data = await getCaseInvitations(caseId);
      setInvitations(data);
    } catch (err) {
      console.error('Failed to load invitations:', err);
    }
  };

  const handleSearch = async () => {
    setSearching(true);
    try {
      const results = await searchInvestigators(searchQuery, excludeIds);
      setSearchResults(results);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleInvite = async (investigatorId: string) => {
    setInvitingId(investigatorId);
    try {
      const result = await inviteTeamMember(caseId, leaderId, investigatorId, message || undefined);
      
      if (result.success) {
        alert('Invitation sent successfully!');
        setMessage('');
        setSelectedInvestigator(null);
        await loadInvitations();
        
        // Remove from search results
        setSearchResults(prev => prev.filter(r => r.id !== investigatorId));
      } else {
        alert(result.error || 'Failed to send invitation');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setInvitingId(null);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    try {
      await cancelInvitation(invitationId);
      await loadInvitations();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserPlus className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-semibold text-gray-900">Invite Team Member</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Search Box */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Investigators
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by username or name..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {searching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                </div>
              )}
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Search Results</h3>
              <div className="space-y-2">
                {searchResults.map((investigator) => (
                  <div
                    key={investigator.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {investigator.avatar_url ? (
                        <img
                          src={investigator.avatar_url}
                          alt={investigator.username}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                          <span className="text-white font-semibold">
                            {investigator.username[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{investigator.full_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-sm text-gray-500">@{investigator.username}</p>
                          <p className="text-sm text-gray-400">•</p>
                          <p className="text-sm text-gray-600">
                            Rep: {investigator.reputation}
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setSelectedInvestigator(investigator.id);
                        setMessage('');
                      }}
                      disabled={invitingId === investigator.id}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {invitingId === investigator.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          Invite
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Message Input (when investigator selected) */}
          {selectedInvestigator && (
            <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <Mail className="w-5 h-5 text-indigo-600" />
                <label className="block text-sm font-medium text-gray-700">
                  Add a message (optional)
                </label>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Why would you like them to join your team?"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleInvite(selectedInvestigator)}
                  disabled={invitingId !== null}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  Send Invitation
                </button>
                <button
                  onClick={() => {
                    setSelectedInvestigator(null);
                    setMessage('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Pending Invitations */}
          {invitations.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Pending Invitations</h3>
              <div className="space-y-2">
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-yellow-200 flex items-center justify-center">
                        <Mail className="w-5 h-5 text-yellow-700" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          @{(invitation as any).to_investigator?.username || 'Unknown'}
                        </p>
                        <p className="text-sm text-gray-500">
                          Sent {new Date(invitation.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleCancelInvitation(invitation.id)}
                      className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {searchQuery && !searching && searchResults.length === 0 && (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No investigators found</p>
              <p className="text-sm text-gray-500 mt-1">Try a different search term</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
