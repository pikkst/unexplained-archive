import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Star, Trophy, Calendar, Shield, AlertCircle, Zap, MessageSquare, ChevronDown, Bell, Settings, Save } from 'lucide-react';
import { format } from 'date-fns';
import { EditProfileModal } from './EditProfileModal';
import { InvestigatorApplicationForm } from './InvestigatorApplicationForm';
import { ProBadge, useVerificationBadge, useProBadge } from './ProBadge';
import { supabase } from '../lib/supabase';
import { verificationService } from '../services/verificationService';
import { BoostAnalyticsDashboard } from './BoostAnalyticsDashboard';
import { DirectMessageModal } from './DirectMessageModal';

// Helper function to get rank based on reputation
const getReputationRank = (reputation: number): { rank: string; color: string; icon: string } => {
  if (reputation >= 10000) return { rank: 'Legend', color: '#fbbf24', icon: '🏆' };
  if (reputation >= 5000) return { rank: 'Master Investigator', color: '#a855f7', icon: '👑' };
  if (reputation >= 2000) return { rank: 'Expert', color: '#3b82f6', icon: '⭐' };
  if (reputation >= 500) return { rank: 'Experienced', color: '#10b981', icon: '✨' };
  return { rank: 'Novice', color: '#6b7280', icon: '🌱' };
};

export const UserProfile: React.FC = () => {
  const { username } = useParams<{ username?: string }>();
  const { profile: currentUserProfile, user } = useAuth();
  const [profile, setProfile] = useState(currentUserProfile);
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [hasApplication, setHasApplication] = useState<boolean | null>(null);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<any>(null);
  const [userCases, setUserCases] = useState<any[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [activeTab, setActiveTab] = useState<'cases' | 'saved' | 'activity' | 'boost-analytics' | 'settings'>('cases');
  const [investigatorStats, setInvestigatorStats] = useState({
    reputation: 0,
    casesSolved: 0,
    successRate: 0,
    resolvedCases: [] as any[]
  });
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [badges, setBadges] = useState<any[]>([]);
  const [streaks, setStreaks] = useState<any>(null);
  const [followCount, setFollowCount] = useState(0);
  const [followerCount, setFollowerCount] = useState(0);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [followingActivity, setFollowingActivity] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [savedCases, setSavedCases] = useState<any[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  
  const [notificationPrefs, setNotificationPrefs] = useState<any>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Load profile based on username parameter or current user
  useEffect(() => {
    const loadProfile = async () => {
      if (username) {
        // Loading someone else's profile
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('username', username)
          .single();

        if (data) {
          setProfile(data);
          setIsOwnProfile(currentUserProfile?.username === username);
          
          // Check if current user is following this profile
          if (currentUserProfile?.id && data.id !== currentUserProfile.id) {
            try {
              const { data: followData, error: followError } = await supabase
                .from('user_follows')
                .select('id')
                .eq('follower_id', currentUserProfile.id)
                .eq('following_id', data.id)
                .maybeSingle();
              
              if (!followError) {
                setIsFollowing(!!followData);
              }
            } catch (err) {
              console.log('Follow status check failed (table may not exist):', err);
            }
          }
        } else {
          console.error('Profile not found:', error);
        }
      } else {
        // Loading own profile
        setProfile(currentUserProfile);
        setIsOwnProfile(true);
      }
    };

    loadProfile();
  }, [username, currentUserProfile]);

  // Fetch verification status for investigators
  useEffect(() => {
    if (!profile?.id || profile.role !== 'investigator') return;
    
    const fetchVerification = async () => {
      try {
        const status = await verificationService.getVerificationStatus(profile.id);
        setVerificationStatus(status);
      } catch (error) {
        console.error('Failed to fetch verification:', error);
      }
    };
    
    fetchVerification();
  }, [profile?.id, profile?.role]);

  // Check if user has submitted investigator application
  useEffect(() => {
    if (!profile?.id) return;
    
    const checkApplication = async () => {
      try {
        // Use RPC function instead of direct table query
        const { data, error } = await supabase
          .rpc('check_investigator_application', { p_user_id: profile.id });

        if (error) {
          console.error('Error checking application:', error);
          return;
        }

        if (data) {
          setHasApplication(data.exists);
          setApplicationStatus(data.status);
        }
      } catch (error) {
        console.error('Failed to check application:', error);
      }
    };
    
    checkApplication();
  }, [profile?.id]);

  // Load investigator stats from reputation table and resolved cases
  useEffect(() => {
    if (!profile?.id || profile.role !== 'investigator') return;
    
    const loadInvestigatorStats = async () => {
      try {
        // Get reputation
        const { data: repData, error: repError } = await supabase
          .from('reputation')
          .select('total_points, cases_resolved')
          .eq('user_id', profile.id)
          .maybeSingle();
        
        if (repError) {
          console.error('Reputation fetch error:', repError);
        }

        // Get resolved cases with ratings and feedback
        const { data: resolvedCases } = await supabase
          .from('cases')
          .select('id, title, description, reward_amount, user_rating, user_feedback, updated_at')
          .or(`assigned_investigator_id.eq.${profile.id},investigator_id.eq.${profile.id}`)
          .eq('status', 'RESOLVED')
          .order('updated_at', { ascending: false });

        const totalCases = repData?.cases_resolved || 0;
        const successRate = totalCases > 0 ? 100 : 0; // All resolved cases are successful

        setInvestigatorStats({
          reputation: repData?.total_points || 0,
          casesSolved: totalCases,
          successRate: successRate,
          resolvedCases: resolvedCases || []
        });
      } catch (error) {
        console.error('Failed to load investigator stats:', error);
      }
    };
    
    loadInvestigatorStats();
  }, [profile?.id, profile?.role]);

  // Load user's submitted cases
  useEffect(() => {
    if (!profile?.id) return;
    
    const loadUserCases = async () => {
      try {
        setLoadingCases(true);
        const { data, error } = await supabase
          .from('cases')
          .select('*')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setUserCases(data || []);
      } catch (error) {
        console.error('Failed to load user cases:', error);
      } finally {
        setLoadingCases(false);
      }
    };
    
    loadUserCases();
  }, [profile?.id]);

  // Load badges
  useEffect(() => {
    if (!profile?.id) return;
    
    const loadBadges = async () => {
      try {
        const { data } = await supabase
          .from('user_badges')
          .select('id, badge_id, earned_at, badges(id, name, slug, description, icon)')
          .eq('user_id', profile.id)
          .order('earned_at', { ascending: false });
        
        setBadges(data || []);
      } catch (error) {
        console.error('Failed to load badges:', error);
      }
    };
    
    loadBadges();
  }, [profile?.id]);

  // Load login streaks
  useEffect(() => {
    if (!profile?.id) return;
    
    const loadStreaks = async () => {
      try {
        const { data } = await supabase
          .from('user_challenges')
          .select('*')
          .eq('user_id', profile.id)
          .eq('challenge_id', 'login-streak')
          .maybeSingle();
        
        setStreaks(data || null);
      } catch (error) {
        console.error('Failed to load streaks:', error);
      }
    };
    
    loadStreaks();
  }, [profile?.id]);

  // Load follow counts
  useEffect(() => {
    if (!profile?.id) return;
    
    const loadFollowCounts = async () => {
      try {
        const { count: following } = await supabase
          .from('user_follows')
          .select('*', { count: 'exact' })
          .eq('follower_id', profile.id);
        
        const { count: followers } = await supabase
          .from('user_follows')
          .select('*', { count: 'exact' })
          .eq('following_id', profile.id);
        
        setFollowCount(following || 0);
        setFollowerCount(followers || 0);
      } catch (error) {
        console.error('Failed to load follow counts:', error);
      }
    };
    
    loadFollowCounts();
  }, [profile?.id]);

  // Load following activity (only for own profile)
  useEffect(() => {
    if (!isOwnProfile || !currentUserProfile?.id || activeTab !== 'activity') return;
    
    const loadFollowingActivity = async () => {
      try {
        setLoadingActivity(true);
        
        // Get list of users we follow
        const { data: followedUsers } = await supabase
          .from('user_follows')
          .select('following_id')
          .eq('follower_id', currentUserProfile.id);
        
        if (!followedUsers || followedUsers.length === 0) {
          setFollowingActivity([]);
          return;
        }
        
        const followedIds = followedUsers.map(f => f.following_id);
        
        // Get recent cases from followed users
        const { data: recentCases } = await supabase
          .from('cases')
          .select('id, title, description, category, media_urls, created_at, user_id, profiles!cases_user_id_fkey(username, avatar_url)')
          .in('user_id', followedIds)
          .order('created_at', { ascending: false })
          .limit(10);
        
        // Get recent comments from followed users
        const { data: recentComments } = await supabase
          .from('comments')
          .select('id, content, created_at, user_id, case_id, profiles!comments_user_id_fkey(username, avatar_url), cases!comments_case_id_fkey(title)')
          .in('user_id', followedIds)
          .order('created_at', { ascending: false })
          .limit(10);
        
        // Combine and sort by date
        const activities = [
          ...(recentCases || []).map(c => ({ type: 'case', data: c, timestamp: c.created_at })),
          ...(recentComments || []).map(c => ({ type: 'comment', data: c, timestamp: c.created_at }))
        ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 15);
        
        setFollowingActivity(activities);
      } catch (error) {
        console.error('Failed to load following activity:', error);
      } finally {
        setLoadingActivity(false);
      }
    };
    
    loadFollowingActivity();
  }, [isOwnProfile, currentUserProfile?.id, activeTab]);

  // Load saved cases (only for own profile)
  useEffect(() => {
    if (!isOwnProfile || !currentUserProfile?.id || activeTab !== 'saved') return;
    
    const loadSavedCases = async () => {
      try {
        setLoadingSaved(true);
        
        const { data, error } = await supabase
          .from('user_saved_cases')
          .select(`
            id,
            saved_at,
            notes,
            cases (
              id,
              title,
              description,
              category,
              status,
              media_urls,
              created_at,
              latitude,
              longitude
            )
          `)
          .eq('user_id', currentUserProfile.id)
          .order('saved_at', { ascending: false });
        
        if (error) throw error;
        setSavedCases(data || []);
      } catch (err) {
        console.error('Failed to load saved cases:', err);
      } finally {
        setLoadingSaved(false);
      }
    };
    
    loadSavedCases();
  }, [isOwnProfile, currentUserProfile?.id, activeTab]);
  
  // Load notification preferences (only for own profile)
  useEffect(() => {
    if (!isOwnProfile || !currentUserProfile?.id || activeTab !== 'settings') return;
    
    const loadNotificationPrefs = async () => {
      try {
        const { data, error } = await supabase
          .from('user_notification_preferences')
          .select('*')
          .eq('user_id', currentUserProfile.id)
          .maybeSingle();
        
        if (error && error.code !== 'PGRST116') throw error;
        
        if (data) {
          setNotificationPrefs(data);
        } else {
          // Initialize with defaults
          const { data: newPrefs, error: insertError } = await supabase
            .from('user_notification_preferences')
            .insert({ user_id: currentUserProfile.id })
            .select()
            .single();
          
          if (!insertError && newPrefs) {
            setNotificationPrefs(newPrefs);
          }
        }
      } catch (err) {
        console.error('Failed to load notification preferences:', err);
      }
    };
    
    loadNotificationPrefs();
  }, [isOwnProfile, currentUserProfile?.id, activeTab]);
  
  const handleSaveNotificationPrefs = async () => {
    if (!currentUserProfile?.id || !notificationPrefs) return;
    
    try {
      setSavingPrefs(true);
      
      const { error } = await supabase
        .from('user_notification_preferences')
        .update(notificationPrefs)
        .eq('user_id', currentUserProfile.id);
      
      if (error) throw error;
      
      alert('✅ Notification preferences saved!');
    } catch (err) {
      console.error('Failed to save notification preferences:', err);
      alert('Failed to save preferences');
    } finally {
      setSavingPrefs(false);
    }
  };

  if (!profile || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-mystery-900">
        <div className="text-center">
          <p className="text-gray-400">Loading profile...</p>
        </div>
      </div>
    );
  }


  const handleFollowToggle = async () => {
    if (!currentUserProfile?.id || !profile?.id) return;
    
    setFollowLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('user_follows')
          .delete()
          .eq('follower_id', currentUserProfile.id)
          .eq('following_id', profile.id);
        
        if (error) {
          console.error('Unfollow error:', error);
          alert('Failed to unfollow. Please make sure the user_follows table is created in Supabase.');
          return;
        }
        setIsFollowing(false);
      } else {
        // Follow
        const { error } = await supabase
          .from('user_follows')
          .insert({
            follower_id: currentUserProfile.id,
            following_id: profile.id
          });
        
        if (error) {
          console.error('Follow error:', error);
          alert('Failed to follow. Please make sure the user_follows table is created in Supabase.');
          return;
        }
        setIsFollowing(true);
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      alert('Failed to update follow status. The user_follows table may not exist in Supabase.');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleSendMessage = () => {
    setShowMessageModal(true);
  };

  const customTheme = (profile as any)?.custom_profile_theme;
  const primaryColor = customTheme?.primaryColor;

  return (
    <div className="min-h-screen bg-mystery-900 py-8" style={primaryColor ? { '--mystery-accent': primaryColor } as React.CSSProperties : undefined}>
      <div className="max-w-5xl mx-auto px-4">
        {/* Profile Header */}
        <div
          className="bg-mystery-800 rounded-lg border border-mystery-700 p-8 mb-8 transition-colors duration-500"
          style={primaryColor ? { borderColor: `${primaryColor}40`, boxShadow: `0 0 20px ${primaryColor}10` } : undefined}
        >
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <div
              className="w-24 h-24 rounded-full bg-mystery-700 flex items-center justify-center overflow-hidden ring-2 ring-offset-2 ring-offset-mystery-900 transition-all duration-500"
              style={primaryColor ? { ringColor: primaryColor } : { ringColor: '#3b82f6' }}
            >
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-gray-500" />
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-3xl font-bold text-white">{profile.username}</h1>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    profile.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                    profile.role === 'investigator' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-green-500/20 text-green-400'
                  }`}
                  style={primaryColor && profile.role !== 'admin' ? {
                    backgroundColor: `${primaryColor}20`,
                    color: primaryColor
                  } : undefined}
                >
                  {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
                </span>
                
                {/* Verification Badge */}
                {verificationStatus && verificationStatus.verified && (
                  <ProBadge
                    type="verified"
                    level={verificationStatus.verification_level || 'basic'}
                    color={verificationStatus.badge_color}
                    size="md"
                  />
                )}
                
                {/* Pro Member Badge */}
                {(profile as any).is_pro_member && (
                  <ProBadge
                    type="pro"
                    size="md"
                  />
                )}
                
                {/* Legacy badges for pending status */}
                {profile.role === 'investigator' && profile.investigator_status === 'pending' && !verificationStatus?.verified && (
                  <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-medium flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> Pending Review
                  </span>
                )}
              </div>

              {profile.full_name && (
                <p className="text-gray-400 mb-2">{profile.full_name}</p>
              )}

              <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center gap-1">
                  <Mail className="w-4 h-4" />
                  {user.email}
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Joined {format(new Date(profile.created_at), 'MMM yyyy')}
                </div>
              </div>

              {profile.bio && (
                <p className="mt-4 text-gray-300">{profile.bio}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {/* Show application status or button for regular users */}
              {profile.role === 'user' && !hasApplication && (
                <button
                  onClick={() => setShowApplicationForm(true)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
                >
                  <Shield className="w-4 h-4" />
                  Apply to Become Investigator
                </button>
              )}
              
              {/* Show pending status */}
              {profile.role === 'user' && hasApplication && applicationStatus === 'pending' && (
                <div className="bg-yellow-500/20 text-yellow-400 px-6 py-2 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Application Pending Review
                </div>
              )}
              
              {/* Show rejected status with option to reapply */}
              {profile.role === 'user' && hasApplication && applicationStatus === 'rejected' && (
                <div className="flex flex-col gap-2">
                  <div className="bg-red-500/20 text-red-400 px-6 py-2 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Application Rejected
                  </div>
                  <button
                    onClick={() => setShowApplicationForm(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Shield className="w-4 h-4" />
                    Reapply
                  </button>
                </div>
              )}
              
              {/* Show application button for investigators who haven't applied yet */}
              {profile.role === 'investigator' && profile.investigator_status === 'pending' && hasApplication === false && (
                <button
                  onClick={() => setShowApplicationForm(true)}
                  className="bg-yellow-600 hover:bg-yellow-500 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2 animate-pulse"
                >
                  <AlertCircle className="w-4 h-4" />
                  Complete Application Required
                </button>
              )}
              
              {/* Show pending status for investigators who have applied */}
              {profile.role === 'investigator' && profile.investigator_status === 'pending' && hasApplication === true && (
                <div className="bg-yellow-500/10 border border-yellow-500/50 px-4 py-2 rounded-lg">
                  <p className="text-yellow-400 text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Application Under Review
                  </p>
                </div>
              )}

            <div className="flex gap-4 mt-4">
              {isOwnProfile ? (
                <>
                  <Link
                    to="/submit-case"
                    className="bg-mystery-500 hover:bg-mystery-600 text-white px-6 py-2 rounded-lg transition-colors text-center"
                  >
                    Submit Case
                  </Link>
                  <button 
                    onClick={() => setShowEditModal(true)}
                    className="bg-mystery-700 hover:bg-mystery-600 text-white px-6 py-2 rounded-lg transition-colors"
                  >
                    Edit Profile
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handleFollowToggle}
                    disabled={followLoading}
                    className={`px-6 py-2 rounded-lg transition-colors font-medium ${
                      isFollowing
                        ? 'bg-mystery-700 hover:bg-mystery-600 text-white'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}
                  >
                    {followLoading ? 'Loading...' : isFollowing ? 'Unfollow' : 'Follow'}
                  </button>
                  <button
                    onClick={handleSendMessage}
                    className="bg-mystery-500 hover:bg-mystery-600 text-white px-6 py-2 rounded-lg transition-colors font-medium flex items-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Send Message
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 pt-6 border-t border-mystery-700">
            <div className="text-center">
              <div className="text-2xl font-bold text-mystery-400 mb-1">
                {profile.role === 'investigator' ? investigatorStats.reputation : (profile.reputation || 0)}
              </div>
              <div className="text-sm text-gray-500 mb-2">Reputation</div>
              {(() => {
                const rep = profile.role === 'investigator' ? investigatorStats.reputation : (profile.reputation || 0);
                const rankInfo = getReputationRank(rep);
                return (
                  <div 
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: `${rankInfo.color}20`, color: rankInfo.color }}
                  >
                    <span>{rankInfo.icon}</span>
                    <span>{rankInfo.rank}</span>
                  </div>
                );
              })()}
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-mystery-400 mb-1">{userCases.length}</div>
              <div className="text-sm text-gray-500">Cases Submitted</div>
            </div>
            {/* Login Streak prominently in header */}
            {streaks && streaks.progress > 0 && (
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-400 mb-1 flex items-center justify-center gap-1">
                  🔥 {streaks.progress}
                </div>
                <div className="text-sm text-gray-500">Day Streak</div>
              </div>
            )}
            <div className="text-center">
              <div className="text-2xl font-bold text-mystery-400 mb-1">{followCount}</div>
              <div className="text-sm text-gray-500">Following</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-mystery-400 mb-1">{followerCount}</div>
              <div className="text-sm text-gray-500">Followers</div>
            </div>
          </div>
        </div>

        {/* Badges Section */}
        {badges.length > 0 && (
          <div className="bg-mystery-800 rounded-lg border border-mystery-700 p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-400" />
              Badges
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {badges.map((badge: any) => (
                <div
                  key={badge.id}
                  className="flex flex-col items-center text-center p-3 bg-mystery-700/50 rounded-lg hover:bg-mystery-700 transition-colors cursor-pointer group"
                  title={badge.badges?.description}
                >
                  <span className="text-3xl mb-2">
                    {badge.badges?.icon || '🏆'}
                  </span>
                  <span className="text-xs font-semibold text-gray-300 group-hover:text-white transition">
                    {badge.badges?.name || 'Badge'}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    {badge.earned_at ? format(new Date(badge.earned_at), 'MMM d, yyyy') : 'Earned'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Login Streak Section */}
        {streaks && streaks.progress > 0 && (
          <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-lg border border-orange-500/30 p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Zap className="w-6 h-6 text-orange-400" />
              🔥 Login Streak
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-4xl font-bold text-orange-400 mb-1">
                  {streaks.progress}
                </div>
                <div className="text-sm text-gray-300">Days</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400 mb-1">
                  {streaks.reward_points || 0}
                </div>
                <div className="text-sm text-gray-300">Points Earned</div>
              </div>
              {streaks.completed_at && (
                <div className="text-center">
                  <div className="text-lg font-bold text-green-400">✓</div>
                  <div className="text-sm text-gray-300">Challenge Complete</div>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-400 mt-4 text-center">Keep your login streak going to earn more rewards!</p>
          </div>
        )}

        {/* Investigator Information - Only show for approved investigators */}
        {profile.role === 'investigator' && profile.investigator_status === 'approved' && (
          <div className="bg-mystery-800 rounded-lg border border-mystery-700 p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Shield className="w-6 h-6 text-blue-400" />
              Investigator Profile
            </h2>

            {/* Bio/Motivation */}
            {profile.investigator_bio && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-300 mb-2">About</h3>
                <p className="text-gray-400 leading-relaxed">{profile.investigator_bio}</p>
              </div>
            )}

            {/* Expertise */}
            {profile.investigator_expertise && profile.investigator_expertise.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-300 mb-3">Areas of Expertise</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.investigator_expertise.map((skill: string, index: number) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Experience */}
            {(profile as any).investigator_experience && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-300 mb-2">Experience</h3>
                <p className="text-gray-400 whitespace-pre-line">{(profile as any).investigator_experience}</p>
              </div>
            )}

            {/* Certifications */}
            {profile.investigator_certifications && Array.isArray(profile.investigator_certifications) && profile.investigator_certifications.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-300 mb-3">Certifications</h3>
                <div className="space-y-3">
                  {profile.investigator_certifications.map((cert: any, index: number) => (
                    <div
                      key={index}
                      className="bg-mystery-700/50 border border-mystery-600 rounded-lg p-4"
                    >
                      <div className="font-medium text-white">{cert.name || cert}</div>
                      {typeof cert === 'object' && (
                        <>
                          {cert.issuer && <div className="text-sm text-gray-400 mt-1">{cert.issuer}</div>}
                          {cert.year && <div className="text-sm text-gray-500 mt-1">{cert.year}</div>}
                          {cert.url && (
                            <a
                              href={cert.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-400 hover:text-blue-300 mt-2 inline-block"
                            >
                              View Certificate →
                            </a>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-mystery-700">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400 mb-1">
                  {investigatorStats.casesSolved}
                </div>
                <div className="text-sm text-gray-500">Cases Solved</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400 mb-1">
                  {investigatorStats.successRate}%
                </div>
                <div className="text-sm text-gray-500">Success Rate</div>
              </div>
            </div>

            {/* Resolved Cases with Feedback */}
            {investigatorStats.resolvedCases.length > 0 && (
              <div className="mt-6 pt-6 border-t border-mystery-700">
                <h3 className="text-lg font-semibold text-gray-300 mb-4">Recent Resolutions</h3>
                <div className="space-y-3">
                  {investigatorStats.resolvedCases.slice(0, 5).map((resolvedCase: any) => (
                    <div key={resolvedCase.id} className="bg-mystery-700/50 border border-mystery-600 rounded-lg p-4">
                      <h4 className="font-medium text-white mb-2">{resolvedCase.title}</h4>
                      {resolvedCase.user_rating && (
                        <div className="flex items-center gap-2 mb-2">
                          <div className="flex">
                            {[1, 2, 3, 4, 5].map(star => (
                              <Star 
                                key={star} 
                                className={`w-4 h-4 ${star <= resolvedCase.user_rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`} 
                              />
                            ))}
                          </div>
                          <span className="text-sm text-green-400">
                            +{resolvedCase.user_rating * 5} reputation
                          </span>
                        </div>
                      )}
                      {resolvedCase.user_feedback && (
                        <p className="text-sm text-gray-400 italic">"{resolvedCase.user_feedback}"</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-mystery-800 rounded-lg border border-mystery-700 p-6">
          {/* Desktop Navigation - Horizontal Tabs */}
          <div className="hidden sm:flex gap-4 border-b border-mystery-700 mb-6">
            <button
              onClick={() => setActiveTab('cases')}
              className={`px-4 py-2 transition-colors flex items-center gap-2 ${
                activeTab === 'cases'
                  ? 'text-white border-b-2 border-mystery-500 font-medium'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {isOwnProfile ? 'My' : `${profile?.username}'s`} Cases ({userCases.length})
            </button>
            {isOwnProfile && (
              <>
                <button
                  onClick={() => setActiveTab('saved')}
                  className={`px-4 py-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'saved'
                      ? 'text-white border-b-2 border-mystery-500 font-medium'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Saved
                </button>
                <button
                  onClick={() => setActiveTab('activity')}
                  className={`px-4 py-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'activity'
                      ? 'text-white border-b-2 border-mystery-500 font-medium'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Activity
                </button>
                <button
                  onClick={() => setActiveTab('boost-analytics')}
                  className={`px-4 py-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'boost-analytics'
                      ? 'text-white border-b-2 border-mystery-500 font-medium'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  Boost Analytics
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`px-4 py-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'settings'
                      ? 'text-white border-b-2 border-mystery-500 font-medium'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  Settings
                </button>
              </>
            )}
          </div>

          {/* Mobile Navigation - Dropdown Menu */}
          <div className="sm:hidden mb-6">
            <div className="relative">
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="w-full bg-mystery-700 border border-mystery-600 rounded-lg px-4 py-3 flex items-center justify-between text-white"
              >
                <div className="flex items-center gap-2">
                  {activeTab === 'cases' && (
                    <>{isOwnProfile ? 'My' : `${profile?.username}'s`} Cases ({userCases.length})</>
                  )}
                  {activeTab === 'saved' && <>Saved</>}
                  {activeTab === 'activity' && <>Activity</>}
                  {activeTab === 'boost-analytics' && (
                    <><Zap className="w-4 h-4" />Boost Analytics</>
                  )}
                  {activeTab === 'settings' && (
                    <><Shield className="w-4 h-4" />Settings</>
                  )}
                </div>
                <ChevronDown className={`w-5 h-5 transition-transform ${
                  showMobileMenu ? 'rotate-180' : ''
                }`} />
              </button>

              {showMobileMenu && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-mystery-800 border border-mystery-700 rounded-lg shadow-xl z-50">
                  <button
                    onClick={() => { setActiveTab('cases'); setShowMobileMenu(false); }}
                    className={`w-full px-4 py-3 text-left hover:bg-mystery-700 transition-colors ${
                      activeTab === 'cases' ? 'text-mystery-400 bg-mystery-700/50' : 'text-white'
                    }`}
                  >
                    {isOwnProfile ? 'My' : `${profile?.username}'s`} Cases ({userCases.length})
                  </button>
                  {isOwnProfile && (
                    <>
                      <button
                        onClick={() => { setActiveTab('saved'); setShowMobileMenu(false); }}
                        className={`w-full px-4 py-3 text-left hover:bg-mystery-700 transition-colors ${
                          activeTab === 'saved' ? 'text-mystery-400 bg-mystery-700/50' : 'text-white'
                        }`}
                      >
                        Saved
                      </button>
                      <button
                        onClick={() => { setActiveTab('activity'); setShowMobileMenu(false); }}
                        className={`w-full px-4 py-3 text-left hover:bg-mystery-700 transition-colors ${
                          activeTab === 'activity' ? 'text-mystery-400 bg-mystery-700/50' : 'text-white'
                        }`}
                      >
                        Activity
                      </button>
                      <button
                        onClick={() => { setActiveTab('boost-analytics'); setShowMobileMenu(false); }}
                        className={`w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-mystery-700 transition-colors ${
                          activeTab === 'boost-analytics' ? 'text-mystery-400 bg-mystery-700/50' : 'text-white'
                        }`}
                      >
                        <Zap className="w-4 h-4" />
                        Boost Analytics
                      </button>
                      <button
                        onClick={() => { setActiveTab('settings'); setShowMobileMenu(false); }}
                        className={`w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-mystery-700 transition-colors ${
                          activeTab === 'settings' ? 'text-mystery-400 bg-mystery-700/50' : 'text-white'
                        }`}
                      >
                        <Shield className="w-4 h-4" />
                        Settings
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'cases' && (
            loadingCases ? (
              <div className="text-center py-12">
                <p className="text-gray-400">Loading cases...</p>
              </div>
            ) : userCases.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-4">{isOwnProfile ? "You haven't submitted any cases yet" : `${profile?.username} hasn't submitted any cases yet`}</p>
                {isOwnProfile && (
                  <Link
                    to="/submit-case"
                    className="inline-block bg-mystery-500 hover:bg-mystery-600 text-white px-6 py-3 rounded-lg transition-colors"
                  >
                    Submit Your First Case
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid gap-4">
                {userCases.map((caseItem) => (
                  <Link
                    key={caseItem.id}
                    to={`/cases/${caseItem.id}`}
                    className="block bg-mystery-700/50 hover:bg-mystery-700 rounded-lg p-4 transition-colors border border-mystery-600"
                  >
                    <div className="flex gap-4">
                      {caseItem.media_urls?.[0] && (
                        <img
                          src={caseItem.media_urls[0]}
                          alt={caseItem.title}
                          className="w-24 h-24 rounded object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-1">{caseItem.title}</h3>
                        <p className="text-sm text-gray-400 line-clamp-2 mb-2">{caseItem.description}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="capitalize">{caseItem.category}</span>
                          <span>{caseItem.status}</span>
                          <span>{new Date(caseItem.created_at).toLocaleDateString()}</span>
                          {caseItem.ai_generated && (
                            <span className="text-mystery-400">AI Generated</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}

          {activeTab === 'saved' && (
            loadingSaved ? (
              <div className="text-center py-12">
                <p className="text-gray-400">Loading saved cases...</p>
              </div>
            ) : savedCases.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-4">No saved cases yet</p>
                <Link
                  to="/explore"
                  className="inline-block bg-mystery-500 hover:bg-mystery-600 text-white px-6 py-3 rounded-lg transition-colors"
                >
                  Explore Cases
                </Link>
              </div>
            ) : (
              <div className="grid gap-4">
                {savedCases.map((saved: any) => (
                  <Link
                    key={saved.id}
                    to={`/cases/${saved.cases.id}`}
                    className="block bg-mystery-700/50 hover:bg-mystery-700 rounded-lg p-4 transition-colors border border-mystery-600"
                  >
                    <div className="flex gap-4">
                      {saved.cases.media_urls?.[0] && (
                        <img
                          src={saved.cases.media_urls[0]}
                          alt={saved.cases.title}
                          className="w-24 h-24 rounded object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-lg font-semibold text-white">{saved.cases.title}</h3>
                          <span className="text-xs text-yellow-400">📌 Saved</span>
                        </div>
                        <p className="text-sm text-gray-400 line-clamp-2 mb-2">{saved.cases.description}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="capitalize">{saved.cases.category}</span>
                          <span>{saved.cases.status}</span>
                          <span>Saved {new Date(saved.saved_at).toLocaleDateString()}</span>
                        </div>
                        {saved.notes && (
                          <p className="text-xs text-gray-500 italic mt-2 border-l-2 border-mystery-500 pl-2">
                            Note: {saved.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}

          {activeTab === 'activity' && (
            loadingActivity ? (
              <div className="text-center py-12">
                <p className="text-gray-400">Loading activity...</p>
              </div>
            ) : followingActivity.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-2">No recent activity from users you follow</p>
                <p className="text-gray-500 text-sm">Follow other users to see their activity here</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-4">Following Activity</h3>
                {followingActivity.map((activity, idx) => (
                  <div key={`${activity.type}-${activity.data.id}-${idx}`} className="bg-mystery-700/50 rounded-lg p-4 border border-mystery-600">
                    {activity.type === 'case' ? (
                      <div className="flex gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-mystery-700 flex items-center justify-center overflow-hidden">
                            {activity.data.profiles?.avatar_url ? (
                              <img src={activity.data.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-5 h-5 text-gray-500" />
                            )}
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-400 mb-2">
                            <Link to={`/profile/${activity.data.profiles?.username}`} className="text-mystery-400 hover:text-mystery-300 font-medium">
                              {activity.data.profiles?.username || 'User'}
                            </Link>
                            {' '}submitted a new case
                            <span className="text-gray-500 ml-2">{format(new Date(activity.data.created_at), 'MMM d, yyyy')}</span>
                          </p>
                          <Link to={`/cases/${activity.data.id}`} className="block hover:opacity-80 transition">
                            <div className="flex gap-3">
                              {activity.data.media_urls?.[0] && (
                                <img src={activity.data.media_urls[0]} alt="" className="w-20 h-20 rounded object-cover" />
                              )}
                              <div>
                                <h4 className="font-medium text-white mb-1">{activity.data.title}</h4>
                                <p className="text-sm text-gray-400 line-clamp-2">{activity.data.description}</p>
                                <span className="inline-block mt-2 text-xs px-2 py-1 bg-mystery-600 text-mystery-300 rounded capitalize">
                                  {activity.data.category}
                                </span>
                              </div>
                            </div>
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 rounded-full bg-mystery-700 flex items-center justify-center overflow-hidden">
                            {activity.data.profiles?.avatar_url ? (
                              <img src={activity.data.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-5 h-5 text-gray-500" />
                            )}
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-400 mb-2">
                            <Link to={`/profile/${activity.data.profiles?.username}`} className="text-mystery-400 hover:text-mystery-300 font-medium">
                              {activity.data.profiles?.username || 'User'}
                            </Link>
                            {' '}commented on{' '}
                            <Link to={`/cases/${activity.data.case_id}`} className="text-white hover:text-mystery-400">
                              {activity.data.cases?.title || 'a case'}
                            </Link>
                            <span className="text-gray-500 ml-2">{format(new Date(activity.data.created_at), 'MMM d, yyyy')}</span>
                          </p>
                          <p className="text-sm text-gray-300 bg-mystery-800/50 rounded p-3 border-l-2 border-mystery-500">
                            {activity.data.content}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'boost-analytics' && (
            <BoostAnalyticsDashboard userId={user.id} />
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && isOwnProfile && notificationPrefs && (
            <div className="space-y-6">
              <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-blue-400" />
                  Email Notifications
                </h3>
                <div className="space-y-4">
                  <label className="flex items-center justify-between">
                    <span className="text-gray-300">Case updates</span>
                    <input
                      type="checkbox"
                      checked={notificationPrefs.email_case_updates}
                      onChange={(e) => setNotificationPrefs({ ...notificationPrefs, email_case_updates: e.target.checked })}
                      className="w-5 h-5 rounded border-mystery-600 bg-mystery-700 text-mystery-500 focus:ring-2 focus:ring-mystery-500"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-gray-300">New messages</span>
                    <input
                      type="checkbox"
                      checked={notificationPrefs.email_new_messages}
                      onChange={(e) => setNotificationPrefs({ ...notificationPrefs, email_new_messages: e.target.checked })}
                      className="w-5 h-5 rounded border-mystery-600 bg-mystery-700 text-mystery-500 focus:ring-2 focus:ring-mystery-500"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-gray-300">New comments</span>
                    <input
                      type="checkbox"
                      checked={notificationPrefs.email_new_comments}
                      onChange={(e) => setNotificationPrefs({ ...notificationPrefs, email_new_comments: e.target.checked })}
                      className="w-5 h-5 rounded border-mystery-600 bg-mystery-700 text-mystery-500 focus:ring-2 focus:ring-mystery-500"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-gray-300">Mentions</span>
                    <input
                      type="checkbox"
                      checked={notificationPrefs.email_mentions}
                      onChange={(e) => setNotificationPrefs({ ...notificationPrefs, email_mentions: e.target.checked })}
                      className="w-5 h-5 rounded border-mystery-600 bg-mystery-700 text-mystery-500 focus:ring-2 focus:ring-mystery-500"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-gray-300">Case assigned to you</span>
                    <input
                      type="checkbox"
                      checked={notificationPrefs.email_case_assigned}
                      onChange={(e) => setNotificationPrefs({ ...notificationPrefs, email_case_assigned: e.target.checked })}
                      className="w-5 h-5 rounded border-mystery-600 bg-mystery-700 text-mystery-500 focus:ring-2 focus:ring-mystery-500"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-gray-300">Case resolved</span>
                    <input
                      type="checkbox"
                      checked={notificationPrefs.email_case_resolved}
                      onChange={(e) => setNotificationPrefs({ ...notificationPrefs, email_case_resolved: e.target.checked })}
                      className="w-5 h-5 rounded border-mystery-600 bg-mystery-700 text-mystery-500 focus:ring-2 focus:ring-mystery-500"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-gray-300">Reputation & rewards</span>
                    <input
                      type="checkbox"
                      checked={notificationPrefs.email_reward_updates}
                      onChange={(e) => setNotificationPrefs({ ...notificationPrefs, email_reward_updates: e.target.checked })}
                      className="w-5 h-5 rounded border-mystery-600 bg-mystery-700 text-mystery-500 focus:ring-2 focus:ring-mystery-500"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-gray-300">Team invites</span>
                    <input
                      type="checkbox"
                      checked={notificationPrefs.email_team_invites}
                      onChange={(e) => setNotificationPrefs({ ...notificationPrefs, email_team_invites: e.target.checked })}
                      className="w-5 h-5 rounded border-mystery-600 bg-mystery-700 text-mystery-500 focus:ring-2 focus:ring-mystery-500"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-gray-300">Weekly digest</span>
                    <input
                      type="checkbox"
                      checked={notificationPrefs.email_weekly_digest}
                      onChange={(e) => setNotificationPrefs({ ...notificationPrefs, email_weekly_digest: e.target.checked })}
                      className="w-5 h-5 rounded border-mystery-600 bg-mystery-700 text-mystery-500 focus:ring-2 focus:ring-mystery-500"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-gray-300">Marketing & updates</span>
                    <input
                      type="checkbox"
                      checked={notificationPrefs.email_marketing}
                      onChange={(e) => setNotificationPrefs({ ...notificationPrefs, email_marketing: e.target.checked })}
                      className="w-5 h-5 rounded border-mystery-600 bg-mystery-700 text-mystery-500 focus:ring-2 focus:ring-mystery-500"
                    />
                  </label>
                </div>
              </div>

              <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-blue-400" />
                  Push Notifications
                </h3>
                <div className="space-y-4">
                  <label className="flex items-center justify-between">
                    <span className="text-gray-300">Case updates</span>
                    <input
                      type="checkbox"
                      checked={notificationPrefs.push_case_updates}
                      onChange={(e) => setNotificationPrefs({ ...notificationPrefs, push_case_updates: e.target.checked })}
                      className="w-5 h-5 rounded border-mystery-600 bg-mystery-700 text-mystery-500 focus:ring-2 focus:ring-mystery-500"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-gray-300">New messages</span>
                    <input
                      type="checkbox"
                      checked={notificationPrefs.push_new_messages}
                      onChange={(e) => setNotificationPrefs({ ...notificationPrefs, push_new_messages: e.target.checked })}
                      className="w-5 h-5 rounded border-mystery-600 bg-mystery-700 text-mystery-500 focus:ring-2 focus:ring-mystery-500"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-gray-300">New comments</span>
                    <input
                      type="checkbox"
                      checked={notificationPrefs.push_new_comments}
                      onChange={(e) => setNotificationPrefs({ ...notificationPrefs, push_new_comments: e.target.checked })}
                      className="w-5 h-5 rounded border-mystery-600 bg-mystery-700 text-mystery-500 focus:ring-2 focus:ring-mystery-500"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-gray-300">Mentions</span>
                    <input
                      type="checkbox"
                      checked={notificationPrefs.push_mentions}
                      onChange={(e) => setNotificationPrefs({ ...notificationPrefs, push_mentions: e.target.checked })}
                      className="w-5 h-5 rounded border-mystery-600 bg-mystery-700 text-mystery-500 focus:ring-2 focus:ring-mystery-500"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <span className="text-gray-300">Case assigned to you</span>
                    <input
                      type="checkbox"
                      checked={notificationPrefs.push_case_assigned}
                      onChange={(e) => setNotificationPrefs({ ...notificationPrefs, push_case_assigned: e.target.checked })}
                      className="w-5 h-5 rounded border-mystery-600 bg-mystery-700 text-mystery-500 focus:ring-2 focus:ring-mystery-500"
                    />
                  </label>
                </div>
              </div>

              <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-blue-400" />
                  Digest Settings
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-300 mb-2">Digest frequency</label>
                    <select
                      value={notificationPrefs.digest_frequency}
                      onChange={(e) => setNotificationPrefs({ ...notificationPrefs, digest_frequency: e.target.value })}
                      className="w-full px-4 py-2 bg-mystery-700 border border-mystery-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-mystery-500"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="never">Never</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-gray-300 mb-2">Quiet hours start</label>
                      <input
                        type="time"
                        value={notificationPrefs.quiet_hours_start || '22:00'}
                        onChange={(e) => setNotificationPrefs({ ...notificationPrefs, quiet_hours_start: e.target.value })}
                        className="w-full px-4 py-2 bg-mystery-700 border border-mystery-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-mystery-500"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-300 mb-2">Quiet hours end</label>
                      <input
                        type="time"
                        value={notificationPrefs.quiet_hours_end || '08:00'}
                        onChange={(e) => setNotificationPrefs({ ...notificationPrefs, quiet_hours_end: e.target.value })}
                        className="w-full px-4 py-2 bg-mystery-700 border border-mystery-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-mystery-500"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    During quiet hours, you won't receive push notifications
                  </p>
                </div>
              </div>

              <button
                onClick={handleSaveNotificationPrefs}
                disabled={savingPrefs}
                className="w-full px-6 py-3 bg-mystery-600 hover:bg-mystery-500 disabled:bg-mystery-700 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {savingPrefs ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Settings
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Edit Profile Modal */}
      <EditProfileModal 
        isOpen={showEditModal} 
        onClose={() => setShowEditModal(false)} 
      />

      {/* Investigator Application Modal */}
      {showApplicationForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-mystery-800 rounded-xl border border-mystery-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-mystery-800 border-b border-mystery-700 p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Shield className="w-6 h-6 text-blue-400" />
                Investigator Application
              </h2>
              <button
                onClick={() => setShowApplicationForm(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <InvestigatorApplicationForm
                userId={profile.id}
                onSuccess={() => {
                  setShowApplicationForm(false);
                  setHasApplication(true);
                  setApplicationStatus('pending');
                  alert('✅ Application submitted! You will be notified once reviewed.');
                }}
                onCancel={() => setShowApplicationForm(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Direct Message Modal */}
      {profile && !isOwnProfile && (
        <DirectMessageModal
          isOpen={showMessageModal}
          onClose={() => setShowMessageModal(false)}
          recipientId={profile.id}
          recipientName={profile.username || 'User'}
        />
      )}
    </div>
  );
};
