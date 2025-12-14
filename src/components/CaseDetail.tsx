import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { translationService } from '../services/translationService';
import { supabase } from '../lib/supabase';
import { DepositModal } from './DepositModal';
import { followCase, followCaseGuest, unfollowCase, isFollowingCase, getFollowerCount } from '../services/notificationService';
import { useAuth } from '../contexts/AuthContext';
import { TeamManagementPanel } from './TeamManagementPanel';
import { TeamInvitationModal } from './TeamInvitationModal';
import { RewardSplitModal } from './RewardSplitModal';
import { BoostPurchaseModal } from './BoostPurchaseModal';
import { TeamDashboard } from './TeamDashboard';
import { CaseNotesSection } from './CaseNotesSection';
import { isTeamLeader, getCaseTeam } from '../services/teamService';
import { caseService } from '../services/caseService';
import { boostService } from '../services/boostService';
import type { Database } from '../lib/supabase';
import { MapPin, Calendar, User as UserIcon, AlertCircle, CheckCircle, Shield, DollarSign, ThumbsUp, ThumbsDown, Star, MessageSquare, Send, Sparkles, Scale, AlertTriangle, FileText, Languages, Globe, Bell, BellOff, Eye, Zap, MapIcon, Trash2, Edit2, Reply, X, Check, Users, Lightbulb, TrendingUp as TrendingUpIcon } from 'lucide-react';

// Define types from supabase schema
type Case = Database['public']['Tables']['cases']['Row'];
type User = Database['public']['Tables']['profiles']['Row'];

// Legacy props interface (for backward compatibility)
interface CaseDetailProps {
  caseData?: Case;
  currentUser?: User;
  onUpdateStatus?: (caseId: string, status: Case['status'], notes?: string, resolution?: string) => void;
  onAssignSelf?: (caseId: string) => void;
  onBack?: () => void;
  onVote?: (voteType: 'agree' | 'disagree') => void;
  onUserRating?: (rating: number, comment: string) => void;
  onEscalateDispute?: (caseId: string) => void;
}

export const CaseDetail: React.FC<CaseDetailProps> = (props) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  
  // State for loading case data
  const [caseData, setCaseData] = useState<Case | null>(props.caseData || null);
  const [loading, setLoading] = useState(!props.caseData);
  
  // Use props or loaded data - merge profile data with user for complete information
  const currentUser = props.currentUser || (profile ? { ...user, ...profile, role: profile.role, investigator_status: profile.investigator_status } : user);
  
  // ALL HOOKS MUST BE DECLARED HERE, BEFORE ANY CONDITIONAL RETURNS
  const [notes, setNotes] = useState('');
  const [proposal, setProposal] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  
  // Rating State
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const [showRatingModal, setShowRatingModal] = useState(false);

  // Comment State
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  // Donation State
  const [showDonationModal, setShowDonationModal] = useState(false);

  // Case Following State
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [showFollowModal, setShowFollowModal] = useState(false);
  const [guestEmail, setGuestEmail] = useState('');

  // Boost State
  const [isBoosted, setIsBoosted] = useState(false);
  const [showBoostModal, setShowBoostModal] = useState(false);

  // Team Management State
  const [showTeamDashboard, setShowTeamDashboard] = useState(false);
  const [showTeamInviteModal, setShowTeamInviteModal] = useState(false);
  const [showRewardSplitModal, setShowRewardSplitModal] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [isTeamMember, setIsTeamMember] = useState(false);

  // Translation State
  const [canTranslate, setCanTranslate] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedTitle, setTranslatedTitle] = useState<string | null>(null);
  const [translatedDescription, setTranslatedDescription] = useState<string | null>(null);
  const [translatedDetailedDescription, setTranslatedDetailedDescription] = useState<string | null>(null);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [showTranslation, setShowTranslation] = useState(false);
  const [commentTranslations, setCommentTranslations] = useState<Record<string, string>>({});
  
  // Map State
  const [mapInitialized, setMapInitialized] = useState(false);
  
  // Evidence Files State
  const [evidenceFiles, setEvidenceFiles] = useState<any[]>([]);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  
  // Similar Cases State
  const [similarCases, setSimilarCases] = useState<any[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  
  // Bookmark State
  const [isSaved, setIsSaved] = useState(false);
  const [savingCase, setSavingCase] = useState(false);
  
  // Evidence Upvoting State
  const [commentVotes, setCommentVotes] = useState<Record<string, { count: number, userVoted: boolean }>>({});
  const [votingComment, setVotingComment] = useState<string | null>(null);
  
  // Theories State
  const [activeTab, setActiveTab] = useState<'discussion' | 'theories'>('discussion');
  const [theories, setTheories] = useState<any[]>([]);
  const [theoryVotes, setTheoryVotes] = useState<Record<string, { count: number, userVoted: boolean }>>({});
  const [loadingTheories, setLoadingTheories] = useState(false);
  const [showTheoryForm, setShowTheoryForm] = useState(false);
  const [newTheory, setNewTheory] = useState({ type: 'Natural Phenomenon', title: '', description: '' });
  const [votingTheory, setVotingTheory] = useState<string | null>(null);
  
  // Update notes and proposal when caseData changes
  useEffect(() => {
    if (caseData) {
      setNotes(caseData.investigatorNotes || '');
      setProposal(caseData.resolutionProposal || '');
      setEvidenceFiles(caseData.evidence_files || []);
      setMapInitialized(false); // Reset map when case changes
    }
  }, [caseData]);

  // Load case data if not provided via props
  useEffect(() => {
    if (!props.caseData && id) {
      loadCaseData();
    }
  }, [id, props.caseData]);

  // Load comments when case data is available
  useEffect(() => {
    if (caseData?.id) {
      loadComments();
      loadTheories();
    }
  }, [caseData?.id]);
  
  // Load case following state
  useEffect(() => {
    if (!caseData) return;
    const loadFollowState = async () => {
      try {
        const count = await getFollowerCount(caseData.id);
        setFollowerCount(count);

        if (user) {
          const following = await isFollowingCase(caseData.id, user.id);
          setIsFollowing(following);
        }
      } catch (error) {
        console.error('Failed to load follow state:', error);
      }
    };
    loadFollowState();
  }, [caseData?.id, user]);

  // Load team leadership status
  useEffect(() => {
    if (!caseData || !user) return;
    const isAssigned = caseData.assignedInvestigator?.id === user.id;
    
    const loadTeamStatus = async () => {
      if (!isAssigned) return;
      
      try {
        const leader = await isTeamLeader(caseData.id, user.id);
        setIsLeader(leader);

        const team = await getCaseTeam(caseData.id);
        setTeamMembers(team);
      } catch (error) {
        console.error('Failed to load team status:', error);
      }
    };
    loadTeamStatus();
  }, [caseData?.id, caseData?.assignedInvestigator?.id, user]);

  // Check if case is boosted
  useEffect(() => {
    if (!caseData) return;
    const checkBoost = async () => {
      try {
        const boosted = await boostService.isCaseBoosted(caseData.id);
        setIsBoosted(boosted);
      } catch (error) {
        console.error('Failed to check boost status:', error);
      }
    };
    checkBoost();
  }, [caseData?.id]);

  // Check translation permissions on mount
  useEffect(() => {
    if (!currentUser) return;
    const checkPermissions = async () => {
      const canUse = await translationService.canUseTranslation(currentUser.id);
      setCanTranslate(canUse);
    };
    checkPermissions();
  }, [currentUser?.id]);

  // Detect original language on mount
  useEffect(() => {
    if (!caseData) return;
    const detectLang = async () => {
      try {
        const lang = await translationService.detectLanguage(caseData.description);
        setDetectedLanguage(lang);
      } catch (err) {
        console.error('Language detection failed:', err);
      }
    };
    detectLang();
  }, [caseData?.description]);

  // Load similar cases
  useEffect(() => {
    if (!caseData?.id) return;
    const loadSimilarCases = async () => {
      try {
        setLoadingSimilar(true);
        
        // Helper function to calculate distance between two points
        const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
          const R = 6371; // Earth radius in km
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLon = (lon2 - lon1) * Math.PI / 180;
          const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return R * c;
        };
        
        // Fetch cases with same category
        const { data: sameCategoryCases, error } = await supabase
          .from('cases')
          .select('id, title, description, category, status, media_urls, latitude, longitude, incident_date, created_at')
          .eq('category', caseData.category)
          .neq('id', caseData.id)
          .limit(20);
        
        if (error) throw error;
        
        // Filter by proximity if location is available
        let filtered = sameCategoryCases || [];
        if (caseData.latitude && caseData.longitude) {
          filtered = filtered
            .map(c => ({
              ...c,
              distance: c.latitude && c.longitude 
                ? getDistance(caseData.latitude!, caseData.longitude!, c.latitude, c.longitude)
                : Infinity
            }))
            .filter(c => c.distance < 500) // Within 500km
            .sort((a, b) => a.distance - b.distance);
        }
        
        // Take top 5 results
        setSimilarCases(filtered.slice(0, 5));
      } catch (err) {
        console.error('Failed to load similar cases:', err);
      } finally {
        setLoadingSimilar(false);
      }
    };
    loadSimilarCases();
  }, [caseData?.id, caseData?.category, caseData?.latitude, caseData?.longitude]);

  // Load team membership status
  useEffect(() => {
    if (!caseData?.id || !currentUser) return;
    const loadTeamStatus = async () => {
      try {
        const { data, error } = await supabase
          .rpc('get_case_team', { p_case_id: caseData.id });
        
        if (error) throw error;
        
        const isMember = data?.some((member: any) => member.user_id === currentUser.id);
        setIsTeamMember(isMember || false);
      } catch (err) {
        console.error('Failed to load team status:', err);
      }
    };
    loadTeamStatus();
  }, [caseData?.id, currentUser?.id]);

  // Check if case is saved by user
  useEffect(() => {
    if (!caseData?.id || !user?.id) return;
    const checkSavedStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('user_saved_cases')
          .select('id')
          .eq('user_id', user.id)
          .eq('case_id', caseData.id)
          .maybeSingle();
        
        if (error) throw error;
        setIsSaved(!!data);
      } catch (err) {
        console.error('Failed to check saved status:', err);
      }
    };
    checkSavedStatus();
  }, [caseData?.id, user?.id]);
  
  const loadCaseData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cases')
        .select(
          `*,
          profiles!cases_user_id_fkey(id, username, avatar_url, role),
          investigator:profiles!cases_investigator_id_fkey(id, username, avatar_url, role),
          assigned_investigator:profiles!cases_assigned_investigator_id_fkey(id, username, avatar_url, role)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      // Map to expected format, using reward_amount from cases table
      const mappedData = {
        ...data,
        submittedBy: data.profiles,
        assignedInvestigator: data.assigned_investigator || data.investigator,
        reward: data.reward_amount || data.reward || 0,
        // Map media_urls to imageUrl for frontend compatibility
        imageUrl: data.media_urls?.[0] || '',
        // Map database fields to frontend expected fields  
        incidentDate: data.date_occurred || data.created_at,
        location: data.location || '',
        // Map status to uppercase for frontend compatibility
        status: data.status === 'pending' ? 'OPEN' : 
                data.status === 'investigating' ? 'INVESTIGATING' : 
                data.status === 'resolved' ? 'RESOLVED' : 
                data.status?.toUpperCase() || 'OPEN',
        category: data.category?.toUpperCase() || 'OTHER',
        // Transform investigator fields from snake_case to camelCase
        investigatorNotes: data.investigator_notes || '',
        resolutionProposal: data.resolution_proposal || '',
        investigationLog: data.investigation_log || [],
        documents: data.documents || []
      };
      
      setCaseData(mappedData as any);
    } catch (error) {
      console.error('Error loading case:', error);
      alert('Failed to load case');
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async () => {
    if (!caseData?.id) return;
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          profiles (
            id,
            username,
            avatar_url,
            role
          )
        `)
        .eq('case_id', caseData.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
      
      // Load vote data for each comment
      if (data && data.length > 0) {
        await loadCommentVotes(data.map(c => c.id));
      }
    } catch (error) {
      console.error('Error loading comments:', error);
    }
  };
  
  const loadCommentVotes = async (commentIds: string[]) => {
    if (!commentIds.length) return;
    
    try {
      // Load vote counts
      const { data: voteCounts, error: countError } = await supabase
        .from('evidence_likes')
        .select('comment_id')
        .in('comment_id', commentIds);
      
      if (countError) throw countError;
      
      // Count votes per comment
      const counts: Record<string, number> = {};
      (voteCounts || []).forEach(vote => {
        counts[vote.comment_id] = (counts[vote.comment_id] || 0) + 1;
      });
      
      // Load user's votes if logged in
      let userVotes: string[] = [];
      if (user) {
        const { data: userVoteData, error: userError } = await supabase
          .from('evidence_likes')
          .select('comment_id')
          .eq('user_id', user.id)
          .in('comment_id', commentIds);
        
        if (userError) throw userError;
        userVotes = (userVoteData || []).map(v => v.comment_id);
      }
      
      // Build vote state
      const voteState: Record<string, { count: number, userVoted: boolean }> = {};
      commentIds.forEach(id => {
        voteState[id] = {
          count: counts[id] || 0,
          userVoted: userVotes.includes(id)
        };
      });
      
      setCommentVotes(voteState);
    } catch (error) {
      console.error('Error loading comment votes:', error);
    }
  };
  
  const handleVoteComment = async (commentId: string) => {
    if (!user) {
      alert('Please log in to vote on comments');
      return;
    }
    
    if (votingComment) return; // Prevent double-click
    setVotingComment(commentId);
    
    try {
      const currentVote = commentVotes[commentId];
      
      if (currentVote?.userVoted) {
        // Unlike
        const { error } = await supabase
          .from('evidence_likes')
          .delete()
          .eq('user_id', user.id)
          .eq('comment_id', commentId);
        
        if (error) throw error;
        
        setCommentVotes(prev => ({
          ...prev,
          [commentId]: {
            count: Math.max(0, (prev[commentId]?.count || 0) - 1),
            userVoted: false
          }
        }));
      } else {
        // Like
        const { error } = await supabase
          .from('evidence_likes')
          .insert({
            user_id: user.id,
            comment_id: commentId
          });
        
        if (error) throw error;
        
        setCommentVotes(prev => ({
          ...prev,
          [commentId]: {
            count: (prev[commentId]?.count || 0) + 1,
            userVoted: true
          }
        }));
      }
    } catch (error) {
      console.error('Error voting on comment:', error);
      alert('Failed to vote on comment');
    } finally {
      setVotingComment(null);
    }
  };
  
  const loadTheories = async () => {
    if (!caseData?.id) return;
    setLoadingTheories(true);
    
    try {
      const { data, error } = await supabase
        .from('case_theories')
        .select(`
          *,
          profiles (
            id,
            username,
            avatar_url
          )
        `)
        .eq('case_id', caseData.id)
        .order('vote_count', { ascending: false });
      
      if (error) throw error;
      setTheories(data || []);
      
      if (data && data.length > 0) {
        await loadTheoryVotes(data.map(t => t.id));
      }
    } catch (error) {
      console.error('Error loading theories:', error);
    } finally {
      setLoadingTheories(false);
    }
  };
  
  const loadTheoryVotes = async (theoryIds: string[]) => {
    if (!theoryIds.length) return;
    
    try {
      const { data: voteCounts, error: countError } = await supabase
        .from('theory_votes')
        .select('theory_id')
        .in('theory_id', theoryIds);
      
      if (countError) throw countError;
      
      const counts: Record<string, number> = {};
      (voteCounts || []).forEach(vote => {
        counts[vote.theory_id] = (counts[vote.theory_id] || 0) + 1;
      });
      
      let userVotes: string[] = [];
      if (user) {
        const { data: userVoteData, error: userError } = await supabase
          .from('theory_votes')
          .select('theory_id')
          .eq('user_id', user.id)
          .in('theory_id', theoryIds);
        
        if (userError) throw userError;
        userVotes = (userVoteData || []).map(v => v.theory_id);
      }
      
      const voteState: Record<string, { count: number, userVoted: boolean }> = {};
      theoryIds.forEach(id => {
        voteState[id] = {
          count: counts[id] || 0,
          userVoted: userVotes.includes(id)
        };
      });
      
      setTheoryVotes(voteState);
    } catch (error) {
      console.error('Error loading theory votes:', error);
    }
  };
  
  const handleVoteTheory = async (theoryId: string) => {
    if (!user) {
      alert('Please log in to vote on theories');
      return;
    }
    
    if (votingTheory) return;
    setVotingTheory(theoryId);
    
    try {
      const currentVote = theoryVotes[theoryId];
      
      if (currentVote?.userVoted) {
        const { error } = await supabase
          .from('theory_votes')
          .delete()
          .eq('user_id', user.id)
          .eq('theory_id', theoryId);
        
        if (error) throw error;
        
        setTheoryVotes(prev => ({
          ...prev,
          [theoryId]: {
            count: Math.max(0, (prev[theoryId]?.count || 0) - 1),
            userVoted: false
          }
        }));
      } else {
        const { error } = await supabase
          .from('theory_votes')
          .insert({
            user_id: user.id,
            theory_id: theoryId
          });
        
        if (error) throw error;
        
        setTheoryVotes(prev => ({
          ...prev,
          [theoryId]: {
            count: (prev[theoryId]?.count || 0) + 1,
            userVoted: true
          }
        }));
      }
      
      await loadTheories(); // Reload to update sort order
    } catch (error) {
      console.error('Error voting on theory:', error);
      alert('Failed to vote on theory');
    } finally {
      setVotingTheory(null);
    }
  };
  
  const handleSubmitTheory = async () => {
    if (!user) {
      alert('Please log in to submit theories');
      return;
    }
    
    if (!newTheory.title.trim() || !newTheory.description.trim()) {
      alert('Please provide both a title and description');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('case_theories')
        .insert({
          case_id: caseData!.id,
          user_id: user.id,
          theory_type: newTheory.type,
          title: newTheory.title,
          description: newTheory.description
        });
      
      if (error) throw error;
      
      setNewTheory({ type: 'Natural Phenomenon', title: '', description: '' });
      setShowTheoryForm(false);
      await loadTheories();
    } catch (error) {
      console.error('Error submitting theory:', error);
      alert('Failed to submit theory');
    }
  };
  
  // NOW SAFE TO DO CONDITIONAL RETURNS
  if (loading) {
    return <div className="flex items-center justify-center h-screen">
      <div className="text-white">Loading case...</div>
    </div>;
  }
  
  if (!caseData || !currentUser) {
    return <div className="flex items-center justify-center h-screen">
      <div className="text-white">Case not found</div>
    </div>;
  }

  const isInvestigator = currentUser.role === 'investigator';
  const isAssigned = caseData.assignedInvestigator?.id === currentUser.id;
  const isSubmitter = caseData.submittedBy.id === currentUser.id;

  const handleFollow = async () => {
    if (!user) {
      // Guest user - show email modal
      setShowFollowModal(true);
      return;
    }

    try {
      const result = await followCase(caseData.id, user.id);
      if (result.success) {
        setIsFollowing(true);
        setFollowerCount(prev => prev + 1);
      } else {
        alert(result.error);
      }
    } catch (error) {
      console.error('Follow failed:', error);
    }
  };

  const handleUnfollow = async () => {
    if (!user) return;

    try {
      const success = await unfollowCase(caseData.id, user.id);
      if (success) {
        setIsFollowing(false);
        setFollowerCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Unfollow failed:', error);
    }
  };

  const handleGuestFollow = async () => {
    if (!guestEmail.trim()) {
      alert('Please enter your email address');
      return;
    }

    try {
      const result = await followCaseGuest(caseData.id, guestEmail);
      if (result.success) {
        alert('Check your email to confirm subscription!');
        setShowFollowModal(false);
        setGuestEmail('');
        setFollowerCount(prev => prev + 1);
      } else {
        alert(result.error || 'Failed to follow case');
      }
    } catch (error) {
      console.error('Guest follow failed:', error);
      alert('Failed to follow case');
    }
  };

  const handleSaveCase = async () => {
    if (!user?.id) {
      alert('Please sign in to save cases');
      return;
    }

    setSavingCase(true);
    try {
      if (isSaved) {
        // Unsave
        const { error } = await supabase
          .from('user_saved_cases')
          .delete()
          .eq('user_id', user.id)
          .eq('case_id', caseData.id);
        
        if (error) throw error;
        setIsSaved(false);
      } else {
        // Save
        const { error } = await supabase
          .from('user_saved_cases')
          .insert({
            user_id: user.id,
            case_id: caseData.id
          });
        
        if (error) throw error;
        setIsSaved(true);
      }
    } catch (error) {
      console.error('Failed to save case:', error);
      alert('Failed to save case. Please try again.');
    } finally {
      setSavingCase(false);
    }
  };

  const handleTranslateCase = async () => {
    if (!canTranslate || isTranslating) return;
    
    setIsTranslating(true);
    setShowTranslation(true);
    
    try {
      const [title, desc, detailed] = await translationService.batchTranslate([
        caseData.title,
        caseData.description,
        caseData.detailedDescription || ''
      ], targetLanguage);
      
      setTranslatedTitle(title);
      setTranslatedDescription(desc);
      if (caseData.detailedDescription) {
        setTranslatedDetailedDescription(detailed);
      }
      
      // Track usage
      await translationService.trackTranslation(
        currentUser.id,
        detectedLanguage || 'unknown',
        targetLanguage,
        (title?.length || 0) + (desc?.length || 0) + (detailed?.length || 0)
      );
    } catch (err) {
      console.error('Translation failed:', err);
      alert('Translation failed. Please try again.');
      setShowTranslation(false);
    } finally {
      setIsTranslating(false);
    }
  };

  const handleTranslateComment = async (commentId: string, text: string) => {
    if (!canTranslate || commentTranslations[commentId]) return;
    
    try {
      const translated = await translationService.translate(text, targetLanguage);
      setCommentTranslations(prev => ({ ...prev, [commentId]: translated }));
      await translationService.trackTranslation(
        currentUser.id,
        detectedLanguage || 'unknown',
        targetLanguage,
        translated.length || 0
      );
    } catch (err) {
      console.error('Comment translation failed:', err);
    }
  };

  const handleSaveProposal = async () => {
    try {
      const { error } = await supabase
        .from('cases')
        .update({
          investigator_notes: notes,
          resolution_proposal: proposal,
          status: 'PENDING_REVIEW'
        })
        .eq('id', caseData.id);
      
      if (error) throw error;
      
      // Legacy callback if exists
      if (props.onUpdateStatus) {
        props.onUpdateStatus(caseData.id, 'PENDING_REVIEW', notes, proposal);
      }
      
      setIsEditing(false);
      await loadCaseData();
      alert('✅ Resolution submitted for review!');
    } catch (error) {
      console.error('Error saving proposal:', error);
      alert('Failed to save proposal. Please try again.');
    }
  };

  const handleAiReport = () => {
    setIsGeneratingReport(true);
    setTimeout(() => {
        const aiSummary = `**INCIDENT SUMMARY:**\nUser reported ${caseData.category} phenomena at ${caseData.location}.\n\n**ANALYSIS:**\nBased on cross-referencing environmental data and user testimony, the likelihood of conventional explanation is low. \n\n**CONCLUSION:**\nRecommended classification: Unresolved/Anomalous pending further spectral data.`;
        setNotes(prev => prev + (prev ? '\n\n' : '') + aiSummary);
        setProposal("The investigation concludes that the event represents a genuine anomaly.");
        setIsGeneratingReport(false);
    }, 1500);
  };

  const handleAcceptResolution = async () => {
    try {
      // Call process_case_resolution with accepted=true
      const { caseService } = await import('../services/caseService');
      const result = await caseService.processCaseResolution({
        caseId: caseData.id,
        investigatorId: caseData.assignedInvestigator?.id || '',
        submitterId: caseData.submittedBy.id,
        rating: ratingScore,
        accepted: true,
        feedback: ratingComment
      });
      
      console.log('Resolution result:', result);
      
      // Legacy callback if exists
      if (props.onUserRating) {
        props.onUserRating(ratingScore, ratingComment);
      }
      
      setShowRatingModal(false);
      
      // Reload case data to show RESOLVED status
      await loadCaseData();
      
      alert(`✅ Case resolved! Investigator received ${ratingScore * 5} reputation points and escrow funds released.`);
    } catch (error) {
      console.error('Error accepting resolution:', error);
      alert('Failed to accept resolution. Please try again.');
    }
  };

  const handleRejectResolution = async () => {
    try {
      // Call process_case_resolution with accepted=false (sets status to DISPUTED)
      const { caseService } = await import('../services/caseService');
      await caseService.processCaseResolution({
        caseId: caseData.id,
        investigatorId: caseData.assignedInvestigator?.id || '',
        submitterId: caseData.submittedBy.id,
        rating: 1, // Lowest rating for dispute
        accepted: false
      });
      
      // Reload case data to show DISPUTED status
      await loadCaseData();
      
      // Legacy callback if exists
      if (props.onUpdateStatus) {
        props.onUpdateStatus(caseData.id, 'DISPUTED', notes, proposal);
      }
      
      setShowRatingModal(false);
      alert('⚠️ Case marked as DISPUTED. Admin or community can review.');
    } catch (error) {
      console.error('Error rejecting resolution:', error);
      alert('Failed to reject resolution. Please try again.');
    }
  };

  const handleVote = async (voteType: 'agree' | 'disagree') => {
    try {
      // Call process_voting_outcome
      await caseService.processVotingOutcome(
        caseData.id,
        voteType === 'agree'
      );
      
      // Legacy callback if exists
      if (props.onVote) {
        props.onVote(voteType);
      }
      
      // Reload case to show updated status
      await loadCaseData();
      
      const outcome = voteType === 'agree' 
        ? '✅ Community approved! Escrow released to investigator.' 
        : '❌ Community rejected! Escrow refunded to donors.';
      alert(outcome);
    } catch (error) {
      console.error('Error processing vote:', error);
      alert('Failed to process vote. Please try again.');
    }
  };

  const handleAssignSelf = async () => {
    if (!currentUser || !profile) return;
    
    // Check if user is approved investigator
    if (profile.role === 'investigator' && profile.investigator_status !== 'approved') {
      alert('⚠️ You must complete your investigator application and be approved by administrators before accepting cases.');
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('cases')
        .update({ assigned_investigator_id: profile.id, status: 'INVESTIGATING' })
        .eq('id', caseData.id)
        .select();
      
      if (error) throw error;
      
      // Legacy callback if exists
      if (props.onAssignSelf) {
        props.onAssignSelf(caseData.id);
      }
      
      // Reload case data
      await loadCaseData();
      alert('✅ Case assigned to you!');
    } catch (error) {
      console.error('Error assigning case:', error);
      alert('Failed to assign case. Please try again.');
    }
  };

  const handleUploadEvidence = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    setUploadingEvidence(true);
    try {
      const uploadedFiles = [];
      
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${caseData.id}/${Date.now()}-${Math.random()}.${fileExt}`;
        const filePath = `evidence/${fileName}`;
        
        // Upload to Supabase storage
        const { error: uploadError } = await supabase.storage
          .from('media')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });
        
        if (uploadError) throw uploadError;
        
        const { data: urlData } = supabase.storage.from('media').getPublicUrl(filePath);
        
        // Determine file type
        let fileType = 'document';
        if (file.type.startsWith('image/')) fileType = 'image';
        else if (file.type.startsWith('video/')) fileType = 'video';
        
        uploadedFiles.push({
          url: urlData.publicUrl,
          name: file.name,
          type: fileType,
          uploaded_at: new Date().toISOString(),
          uploaded_by: profile?.username || 'Unknown'
        });
      }
      
      // Update evidence files in state and database
      const updatedEvidence = [...evidenceFiles, ...uploadedFiles];
      setEvidenceFiles(updatedEvidence);
      
      // Save to database
      const { error } = await supabase
        .from('cases')
        .update({ evidence_files: updatedEvidence })
        .eq('id', caseData.id);
      
      if (error) throw error;
      
      alert(`✅ ${uploadedFiles.length} file(s) uploaded successfully!`);
    } catch (error) {
      console.error('Error uploading evidence:', error);
      alert('Failed to upload files. Please try again.');
    } finally {
      setUploadingEvidence(false);
      event.target.value = ''; // Reset input
    }
  };
  
  const handleRemoveEvidence = async (index: number) => {
    if (!confirm('Remove this evidence file?')) return;
    
    const updatedEvidence = evidenceFiles.filter((_, i) => i !== index);
    setEvidenceFiles(updatedEvidence);
    
    try {
      await supabase
        .from('cases')
        .update({ evidence_files: updatedEvidence })
        .eq('id', caseData.id);
    } catch (error) {
      console.error('Error removing evidence:', error);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim()) return;
    
    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          case_id: caseData.id,
          user_id: currentUser.id,
          content: newComment
        });
      
      if (error) throw error;
      
      setNewComment('');
      // Refresh comments list
      await loadComments();
    } catch (err) {
      console.error('Error posting comment:', err);
      alert('Failed to post comment. Please try again.');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);
      
      if (error) throw error;
      await loadComments();
    } catch (err) {
      console.error('Error deleting comment:', err);
      alert('Failed to delete comment.');
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editingContent.trim()) return;
    
    try {
      const { error } = await supabase
        .from('comments')
        .update({ content: editingContent, updated_at: new Date().toISOString() })
        .eq('id', commentId);
      
      if (error) throw error;
      
      setEditingCommentId(null);
      setEditingContent('');
      await loadComments();
    } catch (err) {
      console.error('Error editing comment:', err);
      alert('Failed to edit comment.');
    }
  };

  const handleReplyComment = async (parentId: string) => {
    if (!replyContent.trim()) return;
    
    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          case_id: caseData.id,
          user_id: currentUser.id,
          content: replyContent,
          parent_id: parentId
        });
      
      if (error) throw error;
      
      setReplyingToId(null);
      setReplyContent('');
      await loadComments();
    } catch (err) {
      console.error('Error posting reply:', err);
      alert('Failed to post reply.');
    }
  };

  // Check if user can delete comment (comment owner or case owner)
  const canDeleteComment = (comment: any) => {
    return currentUser?.id === comment.user_id || currentUser?.id === caseData.user_id;
  };

  // Check if user can edit comment (only comment owner)
  const canEditComment = (comment: any) => {
    return currentUser?.id === comment.user_id;
  };

  // Get top-level comments (no parent)
  const topLevelComments = comments.filter(c => !c.parent_id);
  
  // Get replies for a comment
  const getReplies = (commentId: string) => comments.filter(c => c.parent_id === commentId);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <button onClick={props.onBack || (() => navigate('/explore'))} className="text-gray-400 hover:text-white mb-6 flex items-center gap-2">
        ← Back to list
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-mystery-800 rounded-xl overflow-hidden border border-mystery-700 shadow-2xl">
            <div className="relative h-64 md:h-96">
              <img src={caseData.media_urls?.[0] || caseData.imageUrl} alt={caseData.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-mystery-900 to-transparent opacity-80"></div>
              {caseData.isAiGeneratedImage && (
                  <div className="absolute top-4 right-4 bg-black/60 px-2 py-1 rounded text-xs text-mystery-accent border border-mystery-accent/30 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> AI Visualized
                  </div>
              )}
              <div className="absolute bottom-0 left-0 p-6 md:p-8 w-full">
                <div className="flex justify-between items-end">
                   <div>
                     {/* Boost Badge */}
                     {isBoosted && (
                       <div className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-500 rounded-full text-xs font-bold text-black mb-2 shadow-lg animate-pulse">
                         <Zap className="w-3 h-3" /> BOOSTED
                       </div>
                     )}
                     <span className="inline-block px-3 py-1 bg-mystery-500 rounded-full text-xs font-bold text-white mb-2 shadow-lg">
                       {caseData.category}
                     </span>
                     <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 shadow-black drop-shadow-lg">
                       {showTranslation && translatedTitle ? translatedTitle : caseData.title}
                     </h1>
                     {showTranslation && translatedTitle && (
                       <div className="bg-blue-900/40 border border-blue-500/50 rounded px-2 py-1 inline-block mb-2">
                         <span className="text-blue-200 text-xs flex items-center gap-1">
                           <Languages className="w-3 h-3" /> Translated
                         </span>
                       </div>
                     )}
                     <div className="flex items-center gap-4 text-gray-300 text-sm">
                       <span className="flex items-center gap-1"><MapPin className="w-4 h-4"/> {caseData.location}</span>
                       <span className="flex items-center gap-1"><Calendar className="w-4 h-4"/> {new Date(caseData.incidentDate).toLocaleDateString()}</span>
                     </div>
                     
                     {/* Progress Bar */}
                     {(caseData as any).progress_percentage !== undefined && (
                       <div className="mt-4">
                         <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                           <span>Investigation Progress</span>
                           <span className="font-bold text-mystery-400 text-sm">{(caseData as any).progress_percentage}%</span>
                         </div>
                         <div className="w-full h-3 bg-mystery-900 rounded-full overflow-hidden border border-mystery-700">
                           <div 
                             className="h-full bg-gradient-to-r from-blue-500 via-mystery-400 to-green-500 transition-all duration-500 relative"
                             style={{ width: `${(caseData as any).progress_percentage}%` }}
                           >
                             <div className="absolute inset-0 bg-white/20 animate-pulse" />
                           </div>
                         </div>
                         <p className="text-xs text-gray-500 mt-2">
                           {(caseData as any).progress_percentage === 100 ? 'Investigation complete' :
                            (caseData as any).progress_percentage >= 75 ? 'Nearly resolved' :
                            (caseData as any).progress_percentage >= 50 ? 'Investigation in progress' :
                            (caseData as any).progress_percentage > 0 ? 'Initial investigation' :
                            'Not yet started'}
                         </p>
                       </div>
                     )}
                     
                     {caseData.assignedInvestigator && (
                       <div className="mt-2 flex items-center gap-2 text-blue-300 text-sm">
                         <UserIcon className="w-4 h-4" />
                         <span>Investigated by <span 
                           className="font-semibold hover:text-blue-200 cursor-pointer underline transition-colors"
                           onClick={() => navigate(`/profile/${caseData.assignedInvestigator.username}`)}
                         >{caseData.assignedInvestigator.username}</span></span>
                       </div>
                     )}
                   </div>
                   <div className={`px-4 py-2 rounded-lg text-sm font-bold shadow-lg ${ 
                      caseData.status === 'RESOLVED' ? 'bg-green-600 text-white' : 
                      caseData.status === 'INVESTIGATING' ? 'bg-blue-600 text-white' : 
                      caseData.status === 'PENDING_REVIEW' ? 'bg-purple-600 text-white' : 
                      caseData.status === 'DISPUTED' || caseData.status === 'VOTING' ? 'bg-red-600 text-white' : 
                      'bg-yellow-600 text-black'
                   }`}>
                     {caseData.status === 'PENDING_REVIEW' ? 'Reviewing' : caseData.status}
                   </div>
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              {/* Follow and Save Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Follow Case Button */}
                <div className="flex items-center justify-between bg-mystery-900/50 border border-mystery-600 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Eye className="w-5 h-5 text-mystery-accent" />
                    <div>
                      <h4 className="text-white font-bold text-sm">Get Updates</h4>
                      <p className="text-xs text-gray-400">{followerCount} following</p>
                    </div>
                  </div>
                  {isFollowing ? (
                    <button
                      onClick={handleUnfollow}
                      className="px-4 py-2 bg-mystery-700 hover:bg-mystery-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                    >
                      <BellOff className="w-4 h-4" />
                      Unfollow
                    </button>
                  ) : (
                    <button
                      onClick={handleFollow}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                    >
                      <Bell className="w-4 h-4" />
                      Follow
                    </button>
                  )}
                </div>

                {/* Save Case Button */}
                <div className="flex items-center justify-between bg-mystery-900/50 border border-mystery-600 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-yellow-400" />
                    <div>
                      <h4 className="text-white font-bold text-sm">Save for Later</h4>
                      <p className="text-xs text-gray-400">{isSaved ? 'Saved' : 'Not saved'}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleSaveCase}
                    disabled={savingCase}
                    className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                      isSaved
                        ? 'bg-yellow-600 hover:bg-yellow-500 text-white'
                        : 'bg-mystery-700 hover:bg-mystery-600 text-white'
                    }`}
                  >
                    {savingCase ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    ) : (
                      <>
                        {isSaved ? '📌' : '☐'} {isSaved ? 'Saved' : 'Save'}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Translation Panel for Investigators/Admins */}
              {canTranslate && (
                <div className="bg-mystery-900/50 border border-mystery-600 rounded-lg p-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <Languages className="w-5 h-5 text-mystery-accent" />
                      <div>
                        <h4 className="text-white font-bold text-sm">Translation Tool</h4>
                        {detectedLanguage && (
                          <p className="text-xs text-gray-400">Original: {detectedLanguage.toUpperCase()}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <select 
                        value={targetLanguage}
                        onChange={(e) => setTargetLanguage(e.target.value)}
                        className="bg-mystery-800 border border-mystery-600 text-white text-sm rounded px-3 py-1.5 focus:ring-1 focus:ring-mystery-500 outline-none"
                      >
                        <option value="en">English</option>
                        <option value="et">Estonian</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                        <option value="ru">Russian</option>
                        <option value="zh">Chinese</option>
                        <option value="ja">Japanese</option>
                        <option value="ar">Arabic</option>
                        <option value="hi">Hindi</option>
                      </select>
                      <button 
                        onClick={handleTranslateCase}
                        disabled={isTranslating}
                        className="px-4 py-1.5 bg-mystery-600 hover:bg-mystery-500 disabled:opacity-50 text-white rounded text-sm font-medium flex items-center gap-2 transition-colors"
                      >
                        <Globe className={`w-4 h-4 ${isTranslating ? 'animate-spin' : ''}`} />
                        {isTranslating ? 'Translating...' : 'Translate Case'}
                      </button>
                      {showTranslation && (
                        <button 
                          onClick={() => setShowTranslation(false)}
                          className="px-3 py-1.5 bg-mystery-800 hover:bg-mystery-700 text-gray-400 hover:text-white rounded text-sm transition-colors"
                        >
                          Show Original
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-lg font-bold text-white mb-2">Description of Event</h3>
                {showTranslation && translatedDescription ? (
                  <div>
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded px-2 py-1 inline-block mb-2">
                      <span className="text-blue-300 text-xs flex items-center gap-1">
                        <Languages className="w-3 h-3" /> Translated to {targetLanguage.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-gray-300 leading-relaxed">{translatedDescription}</p>
                  </div>
                ) : (
                  <p className="text-gray-300 leading-relaxed">{caseData.description}</p>
                )}
              </div>

              {caseData.detailedDescription && (
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">Detailed Report</h3>
                  <div className="bg-mystery-900 p-4 rounded-lg border border-mystery-700 text-gray-400 text-sm leading-relaxed">
                    {showTranslation && translatedDetailedDescription ? (
                      <div>
                        <div className="bg-blue-900/20 border border-blue-500/30 rounded px-2 py-1 inline-block mb-2">
                          <span className="text-blue-300 text-xs flex items-center gap-1">
                            <Languages className="w-3 h-3" /> Translated to {targetLanguage.toUpperCase()}
                          </span>
                        </div>
                        <p>{translatedDetailedDescription}</p>
                      </div>
                    ) : (
                      caseData.detailedDescription
                    )}
                  </div>
                </div>
              )}

              {/* Investigation Section */}
              <div className="border-t border-mystery-700 pt-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Shield className="text-mystery-accent w-5 h-5" /> Professional Case File
                </h3>

                {caseData.assignedInvestigator ? (
                  <div className="bg-mystery-900/50 rounded-lg p-6 border border-mystery-700">
                     <div className="flex items-center gap-3 mb-6">
                       <img 
                         src={caseData.assignedInvestigator.avatar_url} 
                         className="w-12 h-12 rounded-full border-2 border-mystery-500 cursor-pointer hover:border-blue-400 transition-colors" 
                         onClick={() => navigate(`/profile/${caseData.assignedInvestigator.username}`)}
                       />
                       <div>
                         <p className="text-white font-medium text-lg">
                           Investigator: <span 
                             className="hover:text-blue-400 cursor-pointer underline transition-colors"
                             onClick={() => navigate(`/profile/${caseData.assignedInvestigator.username}`)}
                           >{caseData.assignedInvestigator.username}</span>
                         </p>
                         <p className="text-xs text-gray-500">Reputation Score: {caseData.assignedInvestigator.reputation || 0}</p>
                       </div>
                       <div className="ml-auto flex items-center gap-2">
                         {isTeamMember && (
                           <button 
                             onClick={() => setShowTeamDashboard(true)}
                             className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white border border-blue-500/50 rounded-lg text-xs font-bold flex items-center gap-2 transition-all"
                           >
                               <Users className="w-3 h-3" />
                               Team Dashboard
                           </button>
                         )}
                         {isAssigned && isEditing && (
                           <button 
                             onClick={handleAiReport}
                             disabled={isGeneratingReport}
                             className="px-3 py-1.5 bg-mystery-700 hover:bg-mystery-600 text-mystery-accent border border-mystery-500/50 rounded-lg text-xs font-bold flex items-center gap-2 transition-all"
                           >
                               <Sparkles className={`w-3 h-3 ${isGeneratingReport ? 'animate-spin' : ''}`} />
                               {isGeneratingReport ? 'Analyzing...' : 'Auto-Generate Report'}
                           </button>
                         )}
                       </div>
                     </div>

                     {/* Investigator Input Area */}
                     {(isAssigned || caseData.status === 'RESOLVED' || caseData.status === 'PENDING_REVIEW' || caseData.status === 'DISPUTED') && (
                        <div className="space-y-6">
                          {/* Evidence Files Section */}
                          <div>
                            <label className="text-xs uppercase font-bold text-gray-500 mb-2 block flex items-center justify-between">
                              <span>Evidence Files (Optional)</span>
                              {isAssigned && isEditing && (
                                <label className="px-3 py-1 bg-mystery-700 hover:bg-mystery-600 text-white rounded text-xs cursor-pointer flex items-center gap-2">
                                  <FileText className="w-3 h-3" />
                                  {uploadingEvidence ? 'Uploading...' : 'Upload Files'}
                                  <input
                                    type="file"
                                    multiple
                                    accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                                    onChange={handleUploadEvidence}
                                    disabled={uploadingEvidence}
                                    className="hidden"
                                  />
                                </label>
                              )}
                            </label>
                            {evidenceFiles.length > 0 ? (
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {evidenceFiles.map((file: any, index: number) => (
                                  <div key={index} className="bg-mystery-800 border border-mystery-600 rounded-lg p-3 relative group">
                                    {file.type === 'image' && (
                                      <img src={file.url} alt={file.name} className="w-full h-32 object-cover rounded mb-2" />
                                    )}
                                    {file.type === 'video' && (
                                      <video src={file.url} className="w-full h-32 object-cover rounded mb-2" controls />
                                    )}
                                    {file.type === 'document' && (
                                      <div className="w-full h-32 bg-mystery-700 rounded mb-2 flex items-center justify-center">
                                        <FileText className="w-12 h-12 text-mystery-accent" />
                                      </div>
                                    )}
                                    <p className="text-xs text-white truncate" title={file.name}>{file.name}</p>
                                    <p className="text-xs text-gray-500">by {file.uploaded_by}</p>
                                    {isAssigned && isEditing && (
                                      <button
                                        onClick={() => handleRemoveEvidence(index)}
                                        className="absolute top-2 right-2 bg-red-600 hover:bg-red-500 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <Trash2 className="w-3 h-3 text-white" />
                                      </button>
                                    )}
                                    <a
                                      href={file.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="absolute bottom-2 right-2 bg-mystery-600 hover:bg-mystery-500 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <Eye className="w-3 h-3 text-white" />
                                    </a>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-gray-500 text-sm italic">No evidence files uploaded yet.</p>
                            )}
                          </div>

                          <div>
                            <label className="text-xs uppercase font-bold text-gray-500 mb-2 block">Field Notes / Analysis</label>
                            {isEditing && isAssigned ? (
                              <textarea 
                                className="w-full bg-mystery-800 border border-mystery-600 rounded p-3 text-white text-sm focus:ring-1 focus:ring-mystery-500 outline-none"
                                rows={6}
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Enter your findings or click Auto-Generate Report..."
                              />
                            ) : (
                              <p className="text-gray-300 text-sm whitespace-pre-wrap">{caseData.investigatorNotes || "No notes logged yet."}</p>
                            )}
                          </div>

                          <div>
                             <label className="text-xs uppercase font-bold text-gray-500 mb-2 block">Proposed Resolution</label>
                             {isEditing && isAssigned ? (
                               <textarea 
                                 className="w-full bg-mystery-800 border border-mystery-600 rounded p-3 text-white text-sm focus:ring-1 focus:ring-mystery-500 outline-none"
                                 rows={4}
                                 value={proposal}
                                 onChange={e => setProposal(e.target.value)}
                                 placeholder="Enter your final conclusion to propose case resolution..."
                               />
                             ) : (
                               <div className={`p-4 rounded-lg border ${ 
                                 caseData.status === 'RESOLVED' 
                                 ? 'bg-green-900/20 border-green-900/50' 
                                 : caseData.status === 'DISPUTED'
                                 ? 'bg-red-900/20 border-red-900/50'
                                 : 'bg-mystery-800 border-mystery-700'
                               }`}>
                                 <p className="text-gray-200 text-sm">
                                   {caseData.resolution || caseData.resolutionProposal || "Investigation in progress..."}
                                 </p>
                               </div>
                             )}
                          </div>

                          {/* Controls for Investigator */}
                          {isAssigned && caseData.status !== 'RESOLVED' && caseData.status !== 'VOTING' && (
                            <div className="flex flex-col gap-3">
                              {isEditing ? (
                                <div className="flex gap-3">
                                  <button onClick={handleSaveProposal} className="px-4 py-2 bg-mystery-500 hover:bg-mystery-400 text-white rounded-lg text-sm font-medium transition-colors">Submit Findings</button>
                                  <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-transparent border border-gray-600 text-gray-400 hover:text-white rounded-lg text-sm transition-colors">Cancel</button>
                                </div>
                              ) : (
                                <div className="flex gap-3">
                                    <button onClick={() => setIsEditing(true)} className="flex-1 px-4 py-2 bg-mystery-700 hover:bg-mystery-600 text-white rounded-lg text-sm font-medium transition-colors">
                                        {caseData.status === 'PENDING_REVIEW' || caseData.status === 'DISPUTED' ? 'Edit Findings' : 'Log Evidence & Propose Resolution'}
                                    </button>
                                    {caseData.status === 'DISPUTED' && (
                                        <button 
                                            onClick={() => props.onEscalateDispute && props.onEscalateDispute(caseData.id)}
                                            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Scale className="w-4 h-4" /> Escalate to Admin
                                        </button>
                                    )}
                                </div>
                              )}
                              {caseData.status === 'DISPUTED' && !isEditing && (
                                  <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3" /> User rejected the resolution. Update findings or escalate to Admin for fee claim.
                                  </p>
                              )}
                            </div>
                          )}
                        </div>
                     )}
                     
                     {/* Submitter Review Action */}
                     {isSubmitter && (caseData.status === 'PENDING_REVIEW' || caseData.status === 'DISPUTED') && (
                       <div className="mt-6 bg-purple-900/30 border border-purple-500/30 p-4 rounded-lg">
                         <div className="flex items-center gap-2 mb-2 text-purple-300 font-bold">
                           <AlertCircle className="w-5 h-5" /> Action Required
                         </div>
                         <p className="text-sm text-gray-300 mb-4">
                           Your investigator has submitted a resolution. Please review their findings above. If you are satisfied, you can close the case and release the reward.
                         </p>
                         <div className="flex gap-3">
                           <button 
                             onClick={() => setShowRatingModal(true)}
                             className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors"
                           >
                             {caseData.status === 'DISPUTED' ? 'Accept Resolution (Resolve Dispute)' : 'Accept & Rate Investigator'}
                           </button>
                           {caseData.status !== 'DISPUTED' && (
                               <button 
                                    onClick={handleRejectResolution}
                                    className="px-4 py-2 bg-red-900/50 hover:bg-red-900 border border-red-800 text-red-200 rounded-lg text-sm font-medium transition-colors"
                                >
                                    Reject & Request More Info
                                </button>
                           )}
                         </div>
                       </div>
                     )}

                     {/* Rating Display (if resolved) */}
                     {caseData.status === 'RESOLVED' && caseData.userReview && (
                       <div className="mt-6 border-t border-mystery-700 pt-4">
                         <h4 className="text-sm font-bold text-white mb-2">Submitter Feedback</h4>
                         <div className="flex items-center gap-1 text-yellow-400 mb-1">
                           {[...Array(5)].map((_, i) => (
                             <Star key={i} className={`w-4 h-4 ${i < caseData.userReview!.rating ? 'fill-current' : 'text-gray-600'}`} />
                           ))}
                         </div>
                         <p className="text-sm text-gray-400 italic">"{caseData.userReview.comment}"</p>
                       </div>
                     )}

                  </div>
                ) : (
                  <div className="bg-yellow-900/10 border border-yellow-900/30 rounded-lg p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="text-yellow-500 w-6 h-6" />
                      <div>
                         <span className="text-white font-medium block">Unclaimed Case</span>
                         <span className="text-gray-400 text-sm">This case needs an expert review.</span>
                      </div>
                    </div>
                    {isInvestigator && caseData.status === 'OPEN' && !caseData.assignedInvestigator && (
                      <button 
                        onClick={handleAssignSelf}
                        disabled={profile?.investigator_status !== 'approved'}
                        className={`px-6 py-2 rounded-lg text-sm font-bold shadow-lg whitespace-nowrap ${ 
                          profile?.investigator_status === 'approved'
                            ? 'bg-mystery-500 hover:bg-mystery-400 shadow-mystery-500/20 text-white'
                            : 'bg-gray-700 opacity-50 cursor-not-allowed text-gray-400'
                        }`}
                        title={profile?.investigator_status !== 'approved' ? 'You must be approved before accepting cases' : ''}
                      >
                        {profile?.investigator_status === 'approved' ? 'Investigate This Case' : '🔒 Approval Required'}
                      </button>
                    )}
                  </div>
                )}
              </div>
              
              {/* Boost Case Button (for case submitters) */}
              {isSubmitter && user && (
                <div className="border-t border-mystery-700 pt-6">
                  <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-lg p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                          <Zap className="w-5 h-5 text-yellow-400" />
                          Boost Your Case Visibility
                        </h3>
                        <p className="text-gray-300 text-sm mb-3">
                          Get your case seen by more investigators. Boosted cases appear at the top of browse results and get featured in newsletters.
                        </p>
                        {isBoosted ? (
                          <div className="inline-flex items-center gap-2 px-3 py-2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-yellow-300 text-sm font-medium">
                            <Zap className="w-4 h-4" />
                            This case is currently boosted
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowBoostModal(true)}
                            className="px-6 py-2 bg-yellow-500 hover:bg-yellow-400 text-black rounded-lg font-bold text-sm transition-colors shadow-lg shadow-yellow-500/20 flex items-center gap-2"
                          >
                            <Zap className="w-4 h-4" />
                            Boost This Case
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Team Management Panel (for assigned investigators) */}
              {isAssigned && user && (
                <div className="border-t border-mystery-700 pt-6">
                  <TeamManagementPanel
                    caseId={caseData.id}
                    currentUserId={user.id}
                    isLeader={isLeader}
                    onInviteClick={() => setShowTeamInviteModal(true)}
                    onRewardSplitClick={() => setShowRewardSplitModal(true)}
                  />
                </div>
              )}

              {/* Case Notes Section (for team members) */}
              {isTeamMember && user && (
                <CaseNotesSection caseId={caseData.id} userId={user.id} />
              )}
              
              {/* Voting / Dispute Section */}
               {caseData.status === 'VOTING' && (
                   <div className="bg-mystery-800 rounded-xl border border-red-500/50 p-6 mt-6 relative overflow-hidden">
                       <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-yellow-500 to-red-500 animate-pulse"></div>
                       <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                           <Scale className="text-red-400" /> Community Tribunal In Session
                       </h3>
                       <p className="text-gray-300 text-sm mb-4">
                           This case is under dispute. The admin has requested a community vote to determine if the resolution is valid and if funds should be released.
                       </p>
                       <div className="flex items-center gap-8 justify-center p-4 bg-mystery-900/50 rounded-lg">
                           <button onClick={() => handleVote('agree')} className="text-green-400 hover:text-green-300 flex flex-col items-center">
                               <ThumbsUp className="w-8 h-8 mb-1" />
                               <span className="font-bold">Approve Resolution</span>
                               <span className="text-xs text-gray-500">{caseData.communityVotes?.agree || 0} votes</span>
                           </button>
                           <div className="h-12 w-px bg-gray-700 mx-4"></div>
                           <button onClick={() => handleVote('disagree')} className="text-red-400 hover:text-red-300 flex flex-col items-center">
                               <ThumbsDown className="w-8 h-8 mb-1" />
                               <span className="font-bold">Reject Resolution</span>
                               <span className="text-xs text-gray-500">{caseData.communityVotes?.disagree || 0} votes</span>
                           </button>
                       </div>
                   </div>
               )}

               {/* Standard Community Voting Section (Visible when Resolved) */}
               {caseData.status === 'RESOLVED' && (
                <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6 mt-6">
                  <h3 className="font-bold text-white mb-4">Community Verdict</h3>
                  <div className="flex items-center gap-8">
                    <button 
                      onClick={() => handleVote('agree')}
                      className="flex items-center gap-2 text-green-400 hover:text-green-300 transition-colors"
                    >
                      <ThumbsUp className="w-6 h-6" />
                      <div>
                        <span className="block text-xl font-bold">{caseData.communityVotes?.agree || 0}</span>
                        <span className="text-xs">Agree</span>
                      </div>
                    </button>
                    <div className="h-10 w-px bg-mystery-700"></div>
                    <button 
                      onClick={() => handleVote('disagree')}
                      className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors"
                    >
                      <ThumbsDown className="w-6 h-6" />
                      <div>
                         <span className="block text-xl font-bold">{caseData.communityVotes?.disagree || 0}</span>
                         <span className="text-xs">Disagree</span>
                      </div>
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">Do you agree with the investigator's resolution?</p>
                </div>
               )}

            </div>
          </div>
          
          {/* Community Discussion & Theories Section */}
          <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6 md:p-8">
            {/* Tab Headers */}
            <div className="flex border-b border-mystery-700 mb-6">
              <button
                onClick={() => setActiveTab('discussion')}
                className={`px-6 py-3 font-semibold flex items-center gap-2 transition-colors relative ${
                  activeTab === 'discussion'
                    ? 'text-mystery-400 border-b-2 border-mystery-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <MessageSquare className="w-5 h-5" />
                Discussion
                <span className="text-xs bg-mystery-700 px-2 py-0.5 rounded-full">
                  {comments.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('theories')}
                className={`px-6 py-3 font-semibold flex items-center gap-2 transition-colors relative ${
                  activeTab === 'theories'
                    ? 'text-mystery-400 border-b-2 border-mystery-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Lightbulb className="w-5 h-5" />
                Community Theories
                <span className="text-xs bg-mystery-700 px-2 py-0.5 rounded-full">
                  {theories.length}
                </span>
              </button>
            </div>

            {/* Discussion Tab */}
            {activeTab === 'discussion' && (
              <div>
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" /> Community Discussion
                </h3>
                
                {/* Input */}
                <div className="flex gap-4 mb-8">
                  <img src={currentUser.avatar_url} className="w-10 h-10 rounded-full" />
                  <div className="flex-1">
                    <textarea 
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Share your thoughts on this case..." 
                      className="w-full bg-mystery-900 border border-mystery-700 rounded-lg p-3 text-white text-sm focus:ring-2 focus:ring-mystery-500 outline-none resize-none"
                      rows={2}
                    />
                    <div className="flex justify-end mt-2">
                      <button 
                        onClick={handlePostComment}
                        disabled={!newComment.trim()}
                        className="px-4 py-2 bg-mystery-500 hover:bg-mystery-400 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" /> Post Comment
                  </button>
                </div>
              </div>
            </div>

            {/* List */}
            <div className="space-y-6">
              {topLevelComments && topLevelComments.length > 0 ? (
                topLevelComments.map(comment => (
                  <div key={comment.id} className="space-y-4">
                    {/* Main Comment */}
                    <div className="flex gap-4">
                      <img src={comment.profiles?.avatar_url || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="%234B5563"/><circle cx="20" cy="15" r="7" fill="%239CA3AF"/><path d="M6 38c0-10 7-14 14-14s14 4 14 14" fill="%239CA3AF"/></svg>'} className="w-10 h-10 rounded-full" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span 
                              className="text-white font-bold text-sm hover:text-blue-400 cursor-pointer transition-colors"
                              onClick={() => comment.profiles?.username && navigate(`/profile/${comment.profiles.username}`)}
                            >{comment.profiles?.username || 'Anonymous'}</span>
                            {comment.profiles?.role === 'investigator' && <Shield className="w-3 h-3 text-blue-400" />}
                            <span className="text-xs text-gray-500">{new Date(comment.created_at).toLocaleDateString()}</span>
                            {comment.updated_at !== comment.created_at && (
                              <span className="text-xs text-gray-600">(edited)</span>
                            )}
                          </div>
                          {/* Edit/Delete buttons */}
                          <div className="flex items-center gap-2">
                            {canEditComment(comment) && (
                              <button 
                                onClick={() => { setEditingCommentId(comment.id); setEditingContent(comment.content); }}
                                className="text-xs text-gray-500 hover:text-blue-400"
                                title="Edit"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                            {canDeleteComment(comment) && (
                              <button 
                                onClick={() => handleDeleteComment(comment.id)}
                                className="text-xs text-gray-500 hover:text-red-400"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        
                        {/* Comment Text - Edit Mode or Display Mode */}
                        {editingCommentId === comment.id ? (
                          <div className="space-y-2">
                            <textarea
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              className="w-full bg-mystery-900 border border-mystery-700 rounded-lg p-2 text-white text-sm focus:ring-2 focus:ring-mystery-500 outline-none resize-none"
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleEditComment(comment.id)}
                                className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-xs flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" /> Save
                              </button>
                              <button 
                                onClick={() => { setEditingCommentId(null); setEditingContent(''); }}
                                className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-xs flex items-center gap-1"
                              >
                                <X className="w-3 h-3" /> Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            {commentTranslations[comment.id] ? (
                              <div className="space-y-2">
                                <div className="bg-blue-900/20 border border-blue-500/30 rounded px-2 py-1 inline-block">
                                  <span className="text-blue-300 text-xs flex items-center gap-1">
                                    <Languages className="w-3 h-3" /> Translated to {targetLanguage.toUpperCase()}
                                  </span>
                                </div>
                                <p className="text-gray-300 text-sm">{commentTranslations[comment.id]}</p>
                                <button 
                                  onClick={() => setCommentTranslations(prev => {
                                    const newState = { ...prev };
                                    delete newState[comment.id];
                                    return newState;
                                  })}
                                  className="text-xs text-gray-500 hover:text-white"
                                >
                                  Show original
                                </button>
                              </div>
                            ) : (
                              <p className="text-gray-300 text-sm">{comment.content}</p>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-3 mt-2">
                          <button 
                            onClick={() => handleVoteComment(comment.id)}
                            disabled={votingComment === comment.id}
                            className={`text-xs flex items-center gap-1 transition-colors ${
                              commentVotes[comment.id]?.userVoted 
                                ? 'text-mystery-400 hover:text-mystery-300' 
                                : 'text-gray-500 hover:text-white'
                            }`}
                          >
                            <ThumbsUp className={`w-3 h-3 ${commentVotes[comment.id]?.userVoted ? 'fill-current' : ''}`} />
                            <span className="font-semibold">{commentVotes[comment.id]?.count || 0}</span>
                          </button>
                          <button 
                            onClick={() => { setReplyingToId(comment.id); setReplyContent(''); }}
                            className="text-xs text-gray-500 hover:text-mystery-accent flex items-center gap-1"
                          >
                            <Reply className="w-3 h-3" /> Reply
                          </button>
                          {canTranslate && !commentTranslations[comment.id] && (
                            <button 
                              onClick={() => handleTranslateComment(comment.id, comment.content)}
                              className="text-xs text-mystery-accent hover:text-mystery-400 flex items-center gap-1"
                            >
                              <Languages className="w-3 h-3" /> Translate
                            </button>
                          )}
                        </div>

                        {/* Reply Input */}
                        {replyingToId === comment.id && (
                          <div className="mt-3 flex gap-3">
                            <img src={currentUser.avatar_url || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%234B5563"/><circle cx="16" cy="12" r="5" fill="%239CA3AF"/><path d="M5 30c0-8 5-11 11-11s11 3 11 11" fill="%239CA3AF"/></svg>'} className="w-8 h-8 rounded-full" />
                            <div className="flex-1">
                              <textarea
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                placeholder={`Reply to ${comment.profiles?.username || 'Anonymous'}...`}
                                className="w-full bg-mystery-900 border border-mystery-700 rounded-lg p-2 text-white text-sm focus:ring-2 focus:ring-mystery-500 outline-none resize-none"
                                rows={2}
                                autoFocus
                              />
                              <div className="flex gap-2 mt-2">
                                <button 
                                  onClick={() => handleReplyComment(comment.id)}
                                  disabled={!replyContent.trim()}
                                  className="px-3 py-1 bg-mystery-500 hover:bg-mystery-400 disabled:opacity-50 text-white rounded text-xs flex items-center gap-1"
                                >
                                  <Send className="w-3 h-3" /> Reply
                                </button>
                                <button 
                                  onClick={() => { setReplyingToId(null); setReplyContent(''); }}
                                  className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-xs flex items-center gap-1"
                                >
                                  <X className="w-3 h-3" /> Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Replies */}
                    {getReplies(comment.id).length > 0 && (
                      <div className="ml-14 space-y-4 border-l-2 border-mystery-700 pl-4">
                        {getReplies(comment.id).map(reply => (
                          <div key={reply.id} className="flex gap-3">
                            <img src={reply.profiles?.avatar_url || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%234B5563"/><circle cx="16" cy="12" r="5" fill="%239CA3AF"/><path d="M5 30c0-8 5-11 11-11s11 3 11 11" fill="%239CA3AF"/></svg>'} className="w-8 h-8 rounded-full" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2">
                                  <span 
                                    className="text-white font-bold text-xs hover:text-blue-400 cursor-pointer transition-colors"
                                    onClick={() => reply.profiles?.username && navigate(`/profile/${reply.profiles.username}`)}
                                  >{reply.profiles?.username || 'Anonymous'}</span>
                                  {reply.profiles?.role === 'investigator' && <Shield className="w-3 h-3 text-blue-400" />}
                                  <span className="text-xs text-gray-500">{new Date(reply.created_at).toLocaleDateString()}</span>
                                  {reply.updated_at !== reply.created_at && (
                                    <span className="text-xs text-gray-600">(edited)</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {canEditComment(reply) && (
                                    <button 
                                      onClick={() => { setEditingCommentId(reply.id); setEditingContent(reply.content); }}
                                      className="text-xs text-gray-500 hover:text-blue-400"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                  )}
                                  {canDeleteComment(reply) && (
                                    <button 
                                      onClick={() => handleDeleteComment(reply.id)}
                                      className="text-xs text-gray-500 hover:text-red-400"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              
                              {editingCommentId === reply.id ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={editingContent}
                                    onChange={(e) => setEditingContent(e.target.value)}
                                    className="w-full bg-mystery-900 border border-mystery-700 rounded-lg p-2 text-white text-xs focus:ring-2 focus:ring-mystery-500 outline-none resize-none"
                                    rows={2}
                                  />
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => handleEditComment(reply.id)}
                                      className="px-2 py-1 bg-green-600 hover:bg-green-500 text-white rounded text-xs flex items-center gap-1"
                                    >
                                      <Check className="w-3 h-3" /> Save
                                    </button>
                                    <button 
                                      onClick={() => { setEditingCommentId(null); setEditingContent(''); }}
                                      className="px-2 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded text-xs flex items-center gap-1"
                                    >
                                      <X className="w-3 h-3" /> Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-gray-300 text-xs">{reply.content}</p>
                              )}
                              
                              <div className="flex items-center gap-3 mt-1">
                                <button 
                                  onClick={() => handleVoteComment(reply.id)}
                                  disabled={votingComment === reply.id}
                                  className={`text-xs flex items-center gap-1 transition-colors ${
                                    commentVotes[reply.id]?.userVoted 
                                      ? 'text-mystery-400 hover:text-mystery-300' 
                                      : 'text-gray-500 hover:text-white'
                                  }`}
                                >
                                  <ThumbsUp className={`w-3 h-3 ${commentVotes[reply.id]?.userVoted ? 'fill-current' : ''}`} />
                                  <span className="font-semibold">{commentVotes[reply.id]?.count || 0}</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )) 
              ) : (
                <p className="text-gray-500 text-sm text-center">No comments yet. Be the first to discuss this case.</p>
              )}
            </div>
              </div>
            )}
            
            {/* Theories Tab */}
            {activeTab === 'theories' && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Lightbulb className="w-5 h-5" /> Community Theories
                  </h3>
                  <button
                    onClick={() => setShowTheoryForm(!showTheoryForm)}
                    className="px-4 py-2 bg-mystery-500 hover:bg-mystery-400 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                  >
                    <Lightbulb className="w-4 h-4" />
                    {showTheoryForm ? 'Cancel' : 'Submit Theory'}
                  </button>
                </div>
                
                {/* Theory Submission Form */}
                {showTheoryForm && (
                  <div className="bg-mystery-900 border border-mystery-700 rounded-lg p-6 mb-6">
                    <h4 className="font-semibold text-white mb-4">Share Your Theory</h4>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-300 mb-2">Theory Type</label>
                        <select
                          value={newTheory.type}
                          onChange={(e) => setNewTheory({ ...newTheory, type: e.target.value })}
                          className="w-full bg-mystery-800 border border-mystery-700 rounded-lg p-2 text-white text-sm focus:ring-2 focus:ring-mystery-500 outline-none"
                        >
                          <option>Natural Phenomenon</option>
                          <option>UFO/Extraterrestrial</option>
                          <option>Government/Military</option>
                          <option>Weather Balloon</option>
                          <option>Hoax/Misidentification</option>
                          <option>Cryptid/Unknown Creature</option>
                          <option>Paranormal Activity</option>
                          <option>Other</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-300 mb-2">Title</label>
                        <input
                          type="text"
                          value={newTheory.title}
                          onChange={(e) => setNewTheory({ ...newTheory, title: e.target.value })}
                          placeholder="Brief summary of your theory..."
                          className="w-full bg-mystery-800 border border-mystery-700 rounded-lg p-2 text-white text-sm focus:ring-2 focus:ring-mystery-500 outline-none"
                          maxLength={200}
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm text-gray-300 mb-2">Description</label>
                        <textarea
                          value={newTheory.description}
                          onChange={(e) => setNewTheory({ ...newTheory, description: e.target.value })}
                          placeholder="Explain your theory in detail..."
                          className="w-full bg-mystery-800 border border-mystery-700 rounded-lg p-3 text-white text-sm focus:ring-2 focus:ring-mystery-500 outline-none resize-none"
                          rows={4}
                        />
                      </div>
                      
                      <button
                        onClick={handleSubmitTheory}
                        disabled={!newTheory.title.trim() || !newTheory.description.trim()}
                        className="w-full px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium"
                      >
                        Submit Theory
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Theories List */}
                <div className="space-y-4">
                  {loadingTheories ? (
                    <p className="text-gray-500 text-center py-8">Loading theories...</p>
                  ) : theories.length > 0 ? (
                    <>
                      {/* Statistics */}
                      <div className="bg-mystery-900/50 border border-mystery-700 rounded-lg p-4 mb-6">
                        <h4 className="text-sm font-semibold text-gray-300 mb-3">Community Consensus</h4>
                        <div className="space-y-2">
                          {(() => {
                            const totalVotes = theories.reduce((sum, t) => sum + (theoryVotes[t.id]?.count || 0), 0);
                            const typeGroups: Record<string, number> = {};
                            
                            theories.forEach(t => {
                              const votes = theoryVotes[t.id]?.count || 0;
                              typeGroups[t.theory_type] = (typeGroups[t.theory_type] || 0) + votes;
                            });
                            
                            return Object.entries(typeGroups)
                              .sort((a, b) => b[1] - a[1])
                              .slice(0, 5)
                              .map(([type, votes]) => {
                                const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                                return (
                                  <div key={type} className="flex items-center gap-3">
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between text-xs mb-1">
                                        <span className="text-gray-300">{type}</span>
                                        <span className="text-mystery-400 font-semibold">{percentage}%</span>
                                      </div>
                                      <div className="w-full h-2 bg-mystery-800 rounded-full overflow-hidden">
                                        <div 
                                          className="h-full bg-gradient-to-r from-mystery-500 to-mystery-400"
                                          style={{ width: `${percentage}%` }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              });
                          })()}
                        </div>
                      </div>
                      
                      {/* Theory Cards */}
                      {theories.map((theory) => (
                        <div key={theory.id} className="bg-mystery-900/50 border border-mystery-700 rounded-lg p-4 hover:border-mystery-600 transition-colors">
                          <div className="flex items-start gap-4">
                            <div className="flex flex-col items-center gap-1">
                              <button
                                onClick={() => handleVoteTheory(theory.id)}
                                disabled={votingTheory === theory.id}
                                className={`p-2 rounded transition-colors ${
                                  theoryVotes[theory.id]?.userVoted
                                    ? 'bg-mystery-500 text-white'
                                    : 'bg-mystery-800 text-gray-400 hover:bg-mystery-700'
                                }`}
                              >
                                <ThumbsUp className={`w-4 h-4 ${theoryVotes[theory.id]?.userVoted ? 'fill-current' : ''}`} />
                              </button>
                              <span className="text-white font-bold text-sm">
                                {theoryVotes[theory.id]?.count || 0}
                              </span>
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs px-2 py-1 bg-mystery-700 text-mystery-300 rounded">
                                      {theory.theory_type}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      by {theory.profiles?.username || 'Anonymous'}
                                    </span>
                                  </div>
                                  <h4 className="font-semibold text-white">{theory.title}</h4>
                                </div>
                              </div>
                              <p className="text-gray-300 text-sm mb-2">{theory.description}</p>
                              <span className="text-xs text-gray-500">
                                {new Date(theory.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <p className="text-gray-500 text-sm text-center py-8">No theories yet. Be the first to share your explanation!</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Reward Pool */}
          <div className="bg-mystery-800 rounded-xl p-6 border border-mystery-700 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <DollarSign className="w-24 h-24 text-green-500" />
            </div>
            <h3 className="font-bold text-white mb-1">Reward Pool</h3>
            <div className="text-4xl font-bold text-green-400 mb-2">€{caseData.reward}</div>
            <p className="text-xs text-gray-400 mb-6">
              {caseData.status === 'RESOLVED' 
               ? "Payout released to investigator." 
               : caseData.status === 'DISPUTED' || caseData.status === 'VOTING'
               ? "FUNDS FROZEN: Dispute in progress."
               : "Funds held in escrow until case resolution is verified."}
            </p>
            {caseData.status !== 'RESOLVED' && caseData.status !== 'CLOSED' && (
              <button 
                onClick={() => setShowDonationModal(true)}
                className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold text-sm shadow-lg shadow-green-900/20 transition-colors flex justify-center items-center gap-2"
              >
                <DollarSign className="w-4 h-4" /> Support This Case
              </button>
            )}
          </div>

          <div className="bg-mystery-800 rounded-xl p-6 border border-mystery-700">
            <h3 className="font-bold text-white mb-4">Submitted By</h3>
            <div 
              className="flex items-center gap-3 cursor-pointer hover:bg-mystery-700/30 p-3 -m-3 rounded-lg transition-colors"
              onClick={() => navigate(`/profile/${caseData.submittedBy.username}`)}
            >
              {caseData.submittedBy.avatar_url ? (
                <img src={caseData.submittedBy.avatar_url} className="w-12 h-12 rounded-full" />
              ) : (
                <UserIcon className="w-12 h-12 text-gray-500" />
              )}
              <div>
                <p className="text-white font-medium hover:text-blue-400 transition-colors">{caseData.submittedBy.username}</p>
                <p className="text-xs text-gray-500">Joined {new Date(caseData.submittedBy.created_at).getFullYear()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-mystery-800 rounded-xl p-6 border border-mystery-700">
            <h3 className="font-bold text-white mb-4 flex items-center justify-between">
              <span>Location</span>
              {caseData.latitude && caseData.longitude && (
                <a 
                  href={`https://www.google.com/maps?q=${caseData.latitude},${caseData.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-mystery-400 hover:text-mystery-300 transition-colors flex items-center gap-1"
                >
                  <MapIcon className="w-3 h-3" />
                  Open in Maps
                </a>
              )}
            </h3>
            {caseData.latitude && caseData.longitude ? (
              <div className="w-full h-64 rounded-lg overflow-hidden border border-mystery-700 relative">
                <div 
                  id={`case-map-${caseData.id}`}
                  className="w-full h-full"
                  ref={(el) => {
                    if (el && !mapInitialized && !el.querySelector('.leaflet-container')) {
                      setMapInitialized(true);
                      // Dynamically import Leaflet
                      import('leaflet').then((L) => {
                        const map = L.default.map(el, {
                          center: [caseData.latitude!, caseData.longitude!],
                          zoom: 13,
                          zoomControl: true,
                          attributionControl: true
                        });

                        L.default.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                          attribution: '© OpenStreetMap contributors'
                        }).addTo(map);

                        // Add marker
                        const getCategoryColor = (category: string) => {
                          switch (category.toLowerCase()) {
                            case 'ufo': return '#6366f1';
                            case 'cryptid': return '#16a34a';
                            case 'paranormal': return '#9333ea';
                            case 'supernatural': return '#dc2626';
                            default: return '#64748b';
                          }
                        };

                        const color = getCategoryColor(caseData.category);
                        const markerIcon = L.default.divIcon({
                          html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
                          className: '',
                          iconSize: [30, 30],
                          iconAnchor: [15, 15]
                        });

                        L.default.marker([caseData.latitude!, caseData.longitude!], { icon: markerIcon })
                          .addTo(map)
                          .bindPopup(`<strong>${caseData.title}</strong><br>${caseData.category}`);
                      }).catch(() => setMapInitialized(false));
                    }
                  }}
                />
              </div>
            ) : (
              <div className="w-full h-48 bg-gray-900 rounded-lg flex items-center justify-center border border-mystery-700">
                <div className="text-center text-gray-500">
                  <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{caseData.location || 'Location not specified'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Similar Cases Widget */}
      {similarCases.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <div className="bg-mystery-800 rounded-xl p-6 border border-mystery-700">
            <h3 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <MapPin className="w-6 h-6 text-mystery-400" />
              Similar Cases
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              Other cases in the same category {caseData.latitude && caseData.longitude && 'and nearby location'}
            </p>
            
            {loadingSimilar ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mystery-400 mx-auto"></div>
                <p className="text-gray-500 mt-2 text-sm">Loading similar cases...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {similarCases.map((similarCase: any) => (
                  <div
                    key={similarCase.id}
                    onClick={() => navigate(`/cases/${similarCase.id}`)}
                    className="bg-mystery-700/50 rounded-lg border border-mystery-600 hover:border-mystery-500 p-4 cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 group"
                  >
                    {similarCase.media_urls?.[0] && (
                      <div className="w-full h-32 mb-3 rounded-lg overflow-hidden">
                        <img 
                          src={similarCase.media_urls[0]} 
                          alt={similarCase.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                    )}
                    <h4 className="font-semibold text-white mb-2 line-clamp-2 group-hover:text-mystery-400 transition-colors">
                      {similarCase.title}
                    </h4>
                    <p className="text-gray-400 text-xs mb-3 line-clamp-2">
                      {similarCase.description}
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        similarCase.status === 'RESOLVED' ? 'bg-green-500/20 text-green-400' :
                        similarCase.status === 'INVESTIGATING' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {similarCase.status}
                      </span>
                      <span className="text-gray-500">
                        {new Date(similarCase.incident_date || similarCase.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {showRatingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-mystery-800 w-full max-w-md rounded-2xl border border-mystery-600 p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-2">Rate Investigation</h2>
            <p className="text-gray-400 text-sm mb-6">Please rate the thoroughness and professionalism of the investigator to release the reward.</p>
            
            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map((star) => (
                <button 
                  key={star} 
                  onClick={() => setRatingScore(star)}
                  className={`transition-transform hover:scale-110 ${star <= ratingScore ? 'text-yellow-400' : 'text-gray-600'}`}
                >
                  <Star className="w-8 h-8 fill-current" />
                </button>
              ))}
            </div>

            <textarea
              className="w-full bg-mystery-900 border border-mystery-600 rounded-lg p-3 text-white text-sm mb-6 focus:ring-1 focus:ring-mystery-500 outline-none resize-none"
              rows={3}
              placeholder="Optional feedback..."
              value={ratingComment}
              onChange={(e) => setRatingComment(e.target.value)}
            />

            <div className="flex gap-3">
              <button 
                onClick={handleAcceptResolution}
                className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold transition-colors"
              >
                Confirm Resolution
              </button>
              <button 
                onClick={() => setShowRatingModal(false)}
                className="px-4 py-3 bg-transparent border border-gray-600 text-gray-400 hover:text-white rounded-lg font-bold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Donation Modal */}
      <DepositModal
        isOpen={showDonationModal}
        onClose={() => setShowDonationModal(false)}
        caseId={caseData.id}
        caseName={caseData.title}
        onSuccess={() => {
          setShowDonationModal(false);
          loadCaseData(); // Refresh case data to show updated reward pool
        }}
      />

      {/* Guest Follow Modal */}
      {showFollowModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-mystery-900 rounded-xl border border-mystery-700 p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <Bell className="w-6 h-6 text-blue-400" />
              Follow This Case
            </h3>
            <p className="text-gray-300 text-sm mb-4">
              Enter your email to receive updates when this case has new developments, 
              comments, or status changes.
            </p>
            <input
              type="email"
              placeholder="your@email.com"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              className="w-full bg-mystery-800 border border-mystery-600 rounded-lg p-3 text-white mb-4 focus:ring-1 focus:ring-blue-500 outline-none"
            />
            <div className="flex gap-3">
              <button
                onClick={handleGuestFollow}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
              >
                Subscribe
              </button>
              <button
                onClick={() => {
                  setShowFollowModal(false);
                  setGuestEmail('');
                }}
                className="px-4 py-2 bg-mystery-700 hover:bg-mystery-600 text-gray-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              💡 We'll send you a confirmation email. You can unsubscribe anytime.
            </p>
          </div>
        </div>
      )}

      {/* Team Invitation Modal */}
      {showTeamInviteModal && user && isLeader && (
        <TeamInvitationModal
          isOpen={showTeamInviteModal}
          onClose={() => setShowTeamInviteModal(false)}
          caseId={caseData.id}
          leaderId={user.id}
          excludeIds={teamMembers.map(m => m.investigator_id)}
        />
      )}

      {/* Reward Split Modal */}
      {showRewardSplitModal && user && isLeader && (
        <RewardSplitModal
          isOpen={showRewardSplitModal}
          onClose={() => setShowRewardSplitModal(false)}
          caseId={caseData.id}
          leaderId={user.id}
          totalReward={caseData.reward}
        />
      )}

      {/* Boost Purchase Modal */}
      <BoostPurchaseModal
        caseId={caseData.id}
        userId={user?.id || ''}
        caseTitle={caseData.title}
        isOpen={showBoostModal}
        onClose={() => setShowBoostModal(false)}
        onSuccess={() => {
          setShowBoostModal(false);
          setIsBoosted(true);
          alert('✅ Case boosted successfully!');
        }}
      />

      {/* Team Dashboard Modal */}
      {showTeamDashboard && isTeamMember && currentUser && (
        <TeamDashboard
          caseId={caseData.id}
          userId={currentUser.id}
          onClose={() => setShowTeamDashboard(false)}
        />
      )}
    </div>
  );
};