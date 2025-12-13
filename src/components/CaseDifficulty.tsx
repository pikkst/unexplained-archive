import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface CaseDifficultyProps {
  caseId: string;
  initialDifficulty?: number;
  isInvestigator?: boolean;
}

export const CaseDifficulty: React.FC<CaseDifficultyProps> = ({
  caseId,
  initialDifficulty = 3,
  isInvestigator = false
}) => {
  const { user } = useAuth();
  const [difficulty, setDifficulty] = useState(initialDifficulty);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [voteCount, setVoteCount] = useState(0);
  const [averageDifficulty, setAverageDifficulty] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    loadDifficultyData();
  }, [caseId, user?.id]);

  const loadDifficultyData = async () => {
    try {
      // Get case base difficulty
      const { data: caseData } = await supabase
        .from('cases')
        .select('difficulty_level')
        .eq('id', caseId)
        .single();

      if (caseData) {
        setDifficulty(caseData.difficulty_level || 3);
      }

      // Get average from votes
      const { data: avgData } = await supabase
        .from('case_difficulty_avg')
        .select('avg_difficulty, vote_count')
        .eq('case_id', caseId)
        .single();

      if (avgData) {
        setAverageDifficulty(avgData.avg_difficulty);
        setVoteCount(avgData.vote_count);
      }

      // Check user's rating if logged in
      if (user?.id) {
        const { data: userVote } = await supabase
          .from('case_difficulty_votes')
          .select('difficulty_rating')
          .eq('case_id', caseId)
          .eq('user_id', user.id)
          .single();

        if (userVote) {
          setUserRating(userVote.difficulty_rating);
        }
      }
    } catch (error) {
      console.error('Error loading difficulty data:', error);
    }
  };

  const handleVoteDifficulty = async (rating: number) => {
    if (!user?.id) {
      alert('Please log in to rate difficulty');
      return;
    }

    setLoading(true);
    try {
      // Upsert the vote
      const { error } = await supabase
        .from('case_difficulty_votes')
        .upsert({
          case_id: caseId,
          user_id: user.id,
          difficulty_rating: rating,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setUserRating(rating);
      setSubmitted(true);

      // Reload difficulty data to get updated average
      await loadDifficultyData();

      // Hide submitted message after 2 seconds
      setTimeout(() => setSubmitted(false), 2000);
    } catch (error) {
      console.error('Error voting difficulty:', error);
      alert('Failed to save your rating');
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyLabel = (level: number): string => {
    const labels: Record<number, string> = {
      1: 'Easy',
      2: 'Medium',
      3: 'Hard',
      4: 'Very Hard',
      5: 'Extremely Hard'
    };
    return labels[level] || 'Unknown';
  };

  const getDifficultyColor = (level: number): string => {
    const colors: Record<number, string> = {
      1: 'text-green-400',
      2: 'text-blue-400',
      3: 'text-yellow-400',
      4: 'text-orange-400',
      5: 'text-red-400'
    };
    return colors[level] || 'text-gray-400';
  };

  const renderStars = (level: number): React.ReactNode => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`text-lg ${star <= level ? getDifficultyColor(level) : 'text-gray-500'}`}
          >
            ★
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Current Difficulty Display */}
      <div className="bg-mystery-700/50 border border-mystery-600 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">Case Difficulty</h3>
          <div className="flex items-center gap-3">
            {renderStars(difficulty)}
            <span className={`text-sm font-medium ${getDifficultyColor(difficulty)}`}>
              {getDifficultyLabel(difficulty)}
            </span>
          </div>
        </div>

        {/* Community Average */}
        {averageDifficulty && (
          <div className="bg-mystery-800/50 rounded p-3 mb-3">
            <p className="text-sm text-gray-400 mb-2">Community Average</p>
            <div className="flex items-center justify-between">
              {renderStars(Math.round(averageDifficulty))}
              <span className="text-sm text-gray-300">
                {averageDifficulty.toFixed(1)} ({voteCount} {voteCount === 1 ? 'vote' : 'votes'})
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Difficulty Voting Section - Only for investigators */}
      {isInvestigator && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-white mb-3">
            What difficulty do you rate this case?
          </h4>

          <div className="grid grid-cols-5 gap-2 mb-3">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                onClick={() => handleVoteDifficulty(rating)}
                disabled={loading}
                className={`p-2 rounded-lg transition-all font-medium ${
                  userRating === rating
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50'
                    : 'bg-mystery-700 text-gray-300 hover:bg-mystery-600'
                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={getDifficultyLabel(rating)}
              >
                {'★'.repeat(rating)}
              </button>
            ))}
          </div>

          {submitted && (
            <div className="text-sm text-green-400 font-medium">
              ✓ Your rating has been saved
            </div>
          )}

          {userRating && !submitted && (
            <p className="text-sm text-gray-400">
              You rated this case: <span className="text-blue-400 font-medium">{getDifficultyLabel(userRating)}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default CaseDifficulty;
