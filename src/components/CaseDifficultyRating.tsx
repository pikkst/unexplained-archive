import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface CaseDifficultyRatingProps {
  caseId: string;
  currentDifficulty?: number;
  onRatingChange?: (rating: number) => void;
}

export const CaseDifficultyRating: React.FC<CaseDifficultyRatingProps> = ({
  caseId,
  currentDifficulty = 3,
  onRatingChange
}) => {
  const { profile } = useAuth();
  const [userRating, setUserRating] = useState<number | null>(null);
  const [averageDifficulty, setAverageDifficulty] = useState<number | null>(null);
  const [totalVotes, setTotalVotes] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);

  // Load user's difficulty vote and average
  useEffect(() => {
    const loadDifficultyData = async () => {
      try {
        // Get user's vote if they're logged in
        if (profile?.id) {
          const { data: userVote } = await supabase
            .from('case_difficulty_votes')
            .select('difficulty_rating')
            .eq('case_id', caseId)
            .eq('user_id', profile.id)
            .maybeSingle();
          
          if (userVote) {
            setUserRating(userVote.difficulty_rating);
          }
        }

        // Get average difficulty
        const { data: avgData } = await supabase
          .from('case_difficulty_avg')
          .select('avg_difficulty, vote_count')
          .eq('case_id', caseId)
          .maybeSingle();
        
        if (avgData) {
          setAverageDifficulty(avgData.avg_difficulty);
          setTotalVotes(avgData.vote_count || 0);
        }
      } catch (error) {
        console.error('Failed to load difficulty data:', error);
      }
    };

    loadDifficultyData();
  }, [caseId, profile?.id]);

  const handleRating = async (rating: number) => {
    if (!profile?.id) {
      alert('Please log in to rate case difficulty');
      return;
    }

    setLoading(true);
    try {
      if (userRating === rating) {
        // Remove vote if clicking same rating
        await supabase
          .from('case_difficulty_votes')
          .delete()
          .eq('case_id', caseId)
          .eq('user_id', profile.id);
        
        setUserRating(null);
      } else if (userRating) {
        // Update existing vote
        await supabase
          .from('case_difficulty_votes')
          .update({ difficulty_rating: rating })
          .eq('case_id', caseId)
          .eq('user_id', profile.id);
        
        setUserRating(rating);
      } else {
        // Insert new vote
        await supabase
          .from('case_difficulty_votes')
          .insert({
            case_id: caseId,
            user_id: profile.id,
            difficulty_rating: rating
          });
        
        setUserRating(rating);
      }

      // Refresh average difficulty
      const { data: avgData } = await supabase
        .from('case_difficulty_avg')
        .select('avg_difficulty, vote_count')
        .eq('case_id', caseId)
        .maybeSingle();
      
      if (avgData) {
        setAverageDifficulty(avgData.avg_difficulty);
        setTotalVotes(avgData.vote_count || 0);
      }

      if (onRatingChange) {
        onRatingChange(rating);
      }
    } catch (error) {
      console.error('Failed to update difficulty rating:', error);
      alert('Failed to update rating. Please try again.');
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

  return (
    <div className="bg-mystery-800 rounded-lg border border-mystery-700 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">How difficult is this case?</h3>
      
      <div className="space-y-4">
        {/* Rating Stars */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                onClick={() => handleRating(rating)}
                onMouseEnter={() => setHoveredRating(rating)}
                onMouseLeave={() => setHoveredRating(null)}
                disabled={loading}
                className={`transition-all ${
                  (hoveredRating ? rating <= hoveredRating : rating <= (userRating || 0))
                    ? 'text-yellow-400 scale-110'
                    : 'text-gray-600 hover:scale-105'
                }`}
              >
                <Star
                  className="w-6 h-6"
                  fill={(hoveredRating ? rating <= hoveredRating : rating <= (userRating || 0)) ? 'currentColor' : 'none'}
                />
              </button>
            ))}
          </div>
          {userRating && (
            <span className="text-sm text-gray-400">
              You rated: <span className="text-white font-semibold">{getDifficultyLabel(userRating)}</span>
            </span>
          )}
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-mystery-700">
          <div>
            <div className="text-2xl font-bold text-yellow-400">
              {averageDifficulty ? averageDifficulty.toFixed(1) : currentDifficulty}
            </div>
            <div className="text-sm text-gray-400">Average Difficulty</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-400">{totalVotes}</div>
            <div className="text-sm text-gray-400">Total Ratings</div>
          </div>
        </div>

        {/* Difficulty Info */}
        <div className="bg-mystery-700/50 rounded-lg p-4 mt-4">
          <p className="text-sm text-gray-300">
            <strong>Current Level:</strong> {getDifficultyLabel(averageDifficulty || currentDifficulty)}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Your rating helps other investigators understand the case complexity.
          </p>
        </div>
      </div>
    </div>
  );
};
