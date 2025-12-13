/**
 * REWARD SPLIT MODAL
 * Set reward distribution percentages for team members
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Award, AlertCircle, CheckCircle, DollarSign } from 'lucide-react';
import { 
  TeamMember, 
  getCaseTeam, 
  setRewardSplit,
  calculateEqualSplit 
} from '../services/teamService';

interface RewardSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  leaderId: string;
  totalReward: number;
}

export const RewardSplitModal: React.FC<RewardSplitModalProps> = ({
  isOpen,
  onClose,
  caseId,
  leaderId,
  totalReward
}) => {
  const navigate = useNavigate();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [splits, setSplits] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadTeam();
    }
  }, [isOpen, caseId]);

  const loadTeam = async () => {
    try {
      const members = await getCaseTeam(caseId);
      setTeam(members);

      // Initialize splits with current values or equal split
      const initialSplits: Record<string, number> = {};
      const hasExistingSplits = members.some(m => m.contribution_percentage);

      if (hasExistingSplits) {
        // Use existing splits
        members.forEach(m => {
          if (m.contribution_percentage) {
            initialSplits[m.investigator_id] = m.contribution_percentage;
          }
        });
      } else {
        // Calculate equal split
        const equalSplits = calculateEqualSplit(members);
        equalSplits.forEach(split => {
          initialSplits[split.investigator_id] = split.percentage;
        });
      }

      setSplits(initialSplits);
    } catch (err) {
      console.error('Failed to load team:', err);
    }
  };

  const handleSplitChange = (investigatorId: string, value: string) => {
    const numValue = parseInt(value) || 0;
    setSplits(prev => ({
      ...prev,
      [investigatorId]: Math.max(0, Math.min(100, numValue))
    }));
  };

  const handleEqualSplit = () => {
    const equalSplits = calculateEqualSplit(team);
    const newSplits: Record<string, number> = {};
    equalSplits.forEach(split => {
      newSplits[split.investigator_id] = split.percentage;
    });
    setSplits(newSplits);
  };

  const calculateTotal = (): number => {
    return Object.values(splits).reduce((sum, val) => sum + val, 0);
  };

  const calculateAmount = (percentage: number): number => {
    return (totalReward * percentage) / 100;
  };

  const handleSave = async () => {
    const total = calculateTotal();
    if (total !== 100) {
      setError('Total percentage must equal 100%');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const splitArray = Object.entries(splits).map(([investigator_id, percentage]) => ({
        investigator_id,
        percentage
      }));

      const result = await setRewardSplit(caseId, leaderId, splitArray);

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
          setSuccess(false);
        }, 2000);
      } else {
        setError(result.error || 'Failed to save splits');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const total = calculateTotal();
  const isValid = total === 100;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Award className="w-6 h-6 text-green-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Reward Distribution</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Total reward: <span className="font-medium text-green-600">${totalReward}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Info Banner */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> Set the percentage each team member will receive when the case is resolved. 
              Total must equal 100%. If not set, rewards will be split equally.
            </p>
          </div>

          {/* Equal Split Button */}
          <div className="mb-6 flex justify-end">
            <button
              onClick={handleEqualSplit}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
            >
              Split Equally
            </button>
          </div>

          {/* Team Members */}
          <div className="space-y-4 mb-6">
            {team.map((member) => {
              const percentage = splits[member.investigator_id] || 0;
              const amount = calculateAmount(percentage);

              return (
                <div
                  key={member.investigator_id}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
                >
                  {/* Member Info */}
                  <div className="flex items-center gap-3 flex-1">
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt={member.username}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                        <span className="text-white font-semibold">
                          {member.username[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p 
                          className="font-medium text-gray-900 hover:text-blue-600 cursor-pointer transition-colors"
                          onClick={() => { onClose(); navigate(`/profile/${member.username}`); }}
                        >{member.username}</p>
                        {member.role === 'leader' && (
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
                            Leader
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">Rep: {member.reputation}</p>
                    </div>
                  </div>

                  {/* Percentage Input */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={percentage}
                        onChange={(e) => handleSplitChange(member.investigator_id, e.target.value)}
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      <span className="text-gray-600 font-medium">%</span>
                    </div>

                    {/* Amount Display */}
                    <div className="w-32 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-right">
                      <div className="flex items-center justify-end gap-1">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        <span className="font-medium text-green-700">
                          {amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total Display */}
          <div className={`p-4 rounded-lg border-2 ${
            isValid 
              ? 'bg-green-50 border-green-300' 
              : 'bg-red-50 border-red-300'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isValid ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
                <span className={`font-medium ${
                  isValid ? 'text-green-800' : 'text-red-800'
                }`}>
                  Total: {total}%
                </span>
              </div>
              <span className={`text-sm ${
                isValid ? 'text-green-600' : 'text-red-600'
              }`}>
                {isValid ? '✓ Ready to save' : `Need ${100 - total}% more`}
              </span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800">Reward splits saved successfully!</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Save Splits
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
