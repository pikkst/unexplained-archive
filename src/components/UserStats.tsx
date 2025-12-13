import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Star, Trophy, Flame } from 'lucide-react';

interface UserStatsProps {
  userId: string;
}

export const UserStats: React.FC<UserStatsProps> = ({ userId }) => {
  const [badges, setBadges] = useState<any[]>([]);
  const [streaks, setStreaks] = useState<any>(null);
  const [reputation, setReputation] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const BADGE_ICONS: Record<string, string> = {
    'first-case': '📝',
    'case-solver': '🔍',
    'evidence-master': '🔬',
    'forum-expert': '💬',
    'investigator': '👮',
    'team-builder': '👥',
    'poll-creator': '📊',
    'influencer': '⭐',
    'voice-of-community': '🎤',
    'legend': '👑',
    'trusted': '✓',
    'contributor': '🤝'
  };

  const BADGE_NAMES: Record<string, string> = {
    'first-case': 'First Case',
    'case-solver': 'Case Solver',
    'evidence-master': 'Evidence Master',
    'forum-expert': 'Forum Expert',
    'investigator': 'Investigator',
    'team-builder': 'Team Builder',
    'poll-creator': 'Poll Creator',
    'influencer': 'Influencer',
    'voice-of-community': 'Voice of Community',
    'legend': 'Legend',
    'trusted': 'Trusted Member',
    'contributor': 'Contributor'
  };

  useEffect(() => {
    const loadUserStats = async () => {
      try {
        // Get user profile (reputation)
        const { data: profileData } = await supabase
          .from('profiles')
          .select('reputation')
          .eq('id', userId)
          .single();

        if (profileData) {
          setReputation(profileData.reputation || 0);
        }

        // Get badges
        const { data: badgesData } = await supabase
          .from('user_badges')
          .select('id, badge_id, earned_at, badges(id, slug, name)')
          .eq('user_id', userId)
          .order('earned_at', { ascending: false });

        if (badgesData) {
          setBadges(badgesData);
        }

        // Get login streaks
        const { data: challengesData } = await supabase
          .from('user_challenges')
          .select('*')
          .eq('user_id', userId)
          .eq('challenge_id', 'login-streak')
          .single();

        if (challengesData) {
          setStreaks(challengesData);
        }

        // Get follower count
        const { count: followerCount } = await supabase
          .from('user_follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', userId);

        setFollowerCount(followerCount || 0);

        // Get following count
        const { count: followingCount } = await supabase
          .from('user_follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', userId);

        setFollowingCount(followingCount || 0);
      } catch (error) {
        console.error('Error loading user stats:', error);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      loadUserStats();
    }
  }, [userId]);

  if (loading) {
    return <div className="text-center py-8 text-gray-400">Loading stats...</div>;
  }

  const getRepLevel = (rep: number): string => {
    if (rep >= 5000) return "Legend";
    if (rep >= 2000) return "Expert";
    if (rep >= 1000) return "Trusted";
    if (rep >= 500) return "Active";
    if (rep >= 100) return "Contributor";
    return "Newcomer";
  };

  const getRepColor = (rep: number): string => {
    if (rep >= 5000) return "text-purple-400";
    if (rep >= 2000) return "text-blue-400";
    if (rep >= 1000) return "text-cyan-400";
    if (rep >= 500) return "text-green-400";
    if (rep >= 100) return "text-yellow-400";
    return "text-gray-400";
  };

  return (
    <div className="space-y-6">
      {/* Reputation Section */}
      <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400" />
            Reputation
          </h3>
          <span className={`text-3xl font-bold ${getRepColor(reputation)}`}>
            {reputation}
          </span>
        </div>
        <div className="text-sm text-gray-300">
          <p className="font-medium mb-2">Level: <span className="text-yellow-400">{getRepLevel(reputation)}</span></p>
          <p className="text-gray-400">
            {reputation < 100 && `${100 - reputation} points to Contributor`}
            {reputation >= 100 && reputation < 500 && `${500 - reputation} points to Active`}
            {reputation >= 500 && reputation < 1000 && `${1000 - reputation} points to Trusted`}
            {reputation >= 1000 && reputation < 2000 && `${2000 - reputation} points to Expert`}
            {reputation >= 2000 && reputation < 5000 && `${5000 - reputation} points to Legend`}
            {reputation >= 5000 && "🎉 You've reached Legend status!"}
          </p>
        </div>
      </div>

      {/* Login Streaks Section */}
      {streaks && (
        <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-400" />
              Login Streak
            </h3>
            <span className="text-4xl font-bold text-orange-400">{streaks.progress}</span>
          </div>
          <div className="text-sm text-gray-300">
            <p className="mb-2">🔥 Keep the streak alive!</p>
            {streaks.completed_at && (
              <p className="text-green-400">
                ✓ Reward earned: +{streaks.reward_points} reputation points
              </p>
            )}
          </div>
        </div>
      )}

      {/* Social Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-mystery-700/50 border border-mystery-600 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{followerCount}</div>
          <div className="text-sm text-gray-400 mt-1">Followers</div>
        </div>
        <div className="bg-mystery-700/50 border border-mystery-600 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-400">{followingCount}</div>
          <div className="text-sm text-gray-400 mt-1">Following</div>
        </div>
      </div>

      {/* Badges Section */}
      {badges.length > 0 && (
        <div className="bg-mystery-700/30 border border-mystery-600 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-yellow-400" />
            Badges ({badges.length})
          </h3>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {badges.map((badge) => {
              const badgeSlug = badge.badges?.slug || badge.badge_id;
              return (
                <div
                  key={badge.id}
                  className="group flex flex-col items-center text-center p-3 bg-mystery-700/50 rounded-lg hover:bg-mystery-700 transition-colors cursor-pointer"
                  title={BADGE_NAMES[badgeSlug] || 'Unknown Badge'}
                >
                  <div className="text-4xl mb-2">
                    {BADGE_ICONS[badgeSlug] || '🏆'}
                  </div>
                  <div className="text-xs font-semibold text-gray-300 group-hover:text-white transition-colors">
                    {BADGE_NAMES[badgeSlug] || 'Badge'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(badge.earned_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* No Badges Message */}
      {badges.length === 0 && (
        <div className="bg-mystery-700/30 border border-dashed border-mystery-600 rounded-lg p-6 text-center">
          <Trophy className="w-8 h-8 text-gray-500 mx-auto mb-3" />
          <p className="text-gray-400">No badges earned yet</p>
          <p className="text-sm text-gray-500 mt-2">
            Start submitting cases, solving investigations, and participating to earn badges!
          </p>
        </div>
      )}
    </div>
  );
};

export default UserStats;
