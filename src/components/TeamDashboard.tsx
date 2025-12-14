import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Users, MessageSquare, DollarSign, FileText, Send, UserPlus, X, Check, AlertCircle, Loader, TrendingUp, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface TeamMember {
  investigator_id: string;
  username: string;
  full_name: string;
  avatar_url: string;
  role: 'leader' | 'member';
  contribution_percentage: number;
  status: string;
  joined_at: string;
  reputation: number;
}

interface TeamMessage {
  id: string;
  sender_id: string;
  message: string;
  is_system_message: boolean;
  created_at: string;
  sender?: {
    username: string;
    avatar_url: string;
  };
}

interface TeamDashboardProps {
  caseId: string;
  caseTitle: string;
  rewardAmount: number;
  onClose: () => void;
}

export const TeamDashboard: React.FC<TeamDashboardProps> = ({
  caseId,
  caseTitle,
  rewardAmount,
  onClose
}) => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'chat' | 'members' | 'split' | 'analytics'>('chat');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [availableInvestigators, setAvailableInvestigators] = useState<any[]>([]);
  const [contributionEdits, setContributionEdits] = useState<Record<string, number>>({});
  const [analytics, setAnalytics] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const COLORS = ['#6366f1', '#22d3ee', '#a855f7', '#f59e0b', '#10b981'];

  useEffect(() => {
    loadTeamData();
    loadMessages();
    
    // Subscribe to real-time messages
    const subscription = supabase
      .channel(`team-chat-${caseId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'case_team_messages',
        filter: `case_id=eq.${caseId}`
      }, (payload) => {
        loadMessages(); // Reload messages when new one arrives
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [caseId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadTeamData = async () => {
    try {
      const { data, error } = await supabase.rpc('get_case_team', {
        p_case_id: caseId
      });

      if (error) throw error;
      
      setTeamMembers(data || []);
      
      // Check if current user is leader
      const currentMember = data?.find((m: TeamMember) => m.investigator_id === profile?.id);
      setIsLeader(currentMember?.role === 'leader');
      
      // Initialize contribution edits
      const edits: Record<string, number> = {};
      data?.forEach((m: TeamMember) => {
        edits[m.investigator_id] = m.contribution_percentage;
      });
      setContributionEdits(edits);
      
      // Load analytics
      await loadAnalytics();
      
    } catch (error) {
      console.error('Error loading team:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const loadAnalytics = async () => {
    try {
      // Get all cases worked on by team members
      const memberIds = teamMembers.map(m => m.investigator_id);
      if (memberIds.length === 0) return;
      
      const { data: allCases } = await supabase
        .from('cases')
        .select('id, status, category, created_at, updatedAt, assignedInvestigator')
        .in('assignedInvestigator', memberIds);
      
      // Calculate analytics
      const casesPerMember: Record<string, number> = {};
      const casesByCategory: Record<string, number> = {};
      const resolvedCases = (allCases || []).filter(c => c.status === 'RESOLVED');
      const totalCases = allCases?.length || 0;
      
      allCases?.forEach(c => {
        // Count by member
        if (c.assignedInvestigator) {
          casesPerMember[c.assignedInvestigator] = (casesPerMember[c.assignedInvestigator] || 0) + 1;
        }
        
        // Count by category
        casesByCategory[c.category] = (casesByCategory[c.category] || 0) + 1;
      });
      
      // Calculate average resolution time
      let totalResolutionDays = 0;
      resolvedCases.forEach(c => {
        if (c.created_at && c.updatedAt) {
          const created = new Date(c.created_at).getTime();
          const updated = new Date(c.updatedAt).getTime();
          const days = (updated - created) / (1000 * 60 * 60 * 24);
          totalResolutionDays += days;
        }
      });
      const avgResolutionTime = resolvedCases.length > 0 
        ? Math.round(totalResolutionDays / resolvedCases.length) 
        : 0;
      
      // Format data for charts
      const memberChartData = teamMembers.map(m => ({
        name: m.username,
        cases: casesPerMember[m.investigator_id] || 0,
        contribution: m.contribution_percentage
      }));
      
      const categoryChartData = Object.entries(casesByCategory).map(([name, value]) => ({
        name,
        value
      }));
      
      const successRate = totalCases > 0 
        ? Math.round((resolvedCases.length / totalCases) * 100) 
        : 0;
      
      setAnalytics({
        casesPerMember: memberChartData,
        avgResolutionTime,
        successRate,
        categoryDistribution: categoryChartData,
        totalCases,
        resolvedCases: resolvedCases.length
      });
      
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('case_team_messages')
        .select(`
          *,
          sender:profiles!case_team_messages_sender_id_fkey(username, avatar_url)
        `)
        .eq('case_id', caseId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      
      // Mark messages as read
      if (profile?.id) {
        await supabase.rpc('mark_team_messages_read', {
          p_case_id: caseId,
          p_user_id: profile.id
        });
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !profile) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('case_team_messages')
        .insert({
          case_id: caseId,
          sender_id: profile.id,
          message: newMessage.trim()
        });

      if (error) throw error;
      
      setNewMessage('');
      await loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const loadAvailableInvestigators = async () => {
    try {
      // Get all approved investigators who aren't already on the team
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, reputation')
        .eq('role', 'investigator')
        .eq('investigator_status', 'approved')
        .not('id', 'in', `(${teamMembers.map(m => m.investigator_id).join(',')})`);

      if (error) throw error;
      setAvailableInvestigators(data || []);
    } catch (error) {
      console.error('Error loading investigators:', error);
    }
  };

  const handleInviteInvestigator = async (investigatorId: string) => {
    try {
      const { error } = await supabase
        .from('team_invitations')
        .insert({
          case_id: caseId,
          from_investigator_id: profile?.id,
          to_investigator_id: investigatorId,
          status: 'pending'
        });

      if (error) throw error;
      
      alert('✅ Invitation sent!');
      setShowInviteModal(false);
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      if (error.code === '23505') {
        alert('This investigator has already been invited.');
      } else {
        alert('Failed to send invitation');
      }
    }
  };

  const handleSaveContributions = async () => {
    // Validate total equals 100%
    const total = Object.values(contributionEdits).reduce((sum, val) => sum + val, 0);
    if (total !== 100) {
      alert(`Total must equal 100%. Current total: ${total}%`);
      return;
    }

    try {
      // Update each member's contribution
      for (const [memberId, percentage] of Object.entries(contributionEdits)) {
        await supabase
          .from('case_team_members')
          .update({ contribution_percentage: percentage })
          .eq('case_id', caseId)
          .eq('investigator_id', memberId);
      }

      alert('✅ Contribution percentages updated!');
      await loadTeamData();
    } catch (error) {
      console.error('Error updating contributions:', error);
      alert('Failed to update contributions');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-mystery-800 rounded-xl p-8">
          <Loader className="w-8 h-8 text-mystery-accent animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-mystery-900 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-mystery-700 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-mystery-accent" />
              Team Dashboard
            </h2>
            <p className="text-gray-400 text-sm mt-1">{caseTitle}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-mystery-700 px-6">
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-3 font-medium transition-colors ${
              activeTab === 'chat'
                ? 'text-mystery-accent border-b-2 border-mystery-accent'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4 inline mr-2" />
            Team Chat
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`px-4 py-3 font-medium transition-colors ${
              activeTab === 'members'
                ? 'text-mystery-accent border-b-2 border-mystery-accent'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Members ({teamMembers.length})
          </button>
          {isLeader && (
            <button
              onClick={() => setActiveTab('split')}
              className={`px-4 py-3 font-medium transition-colors ${
                activeTab === 'split'
                  ? 'text-mystery-accent border-b-2 border-mystery-accent'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <DollarSign className="w-4 h-4 inline mr-2" />
              Reward Split
            </button>
          )}
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-3 font-medium transition-colors ${
              activeTab === 'analytics'
                ? 'text-mystery-accent border-b-2 border-mystery-accent'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline mr-2" />
            Analytics
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${
                      msg.sender_id === profile?.id ? 'flex-row-reverse' : ''
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-mystery-700 flex-shrink-0 overflow-hidden">
                      {msg.sender?.avatar_url ? (
                        <img src={msg.sender.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-mystery-accent text-xs font-bold">
                          {msg.sender?.username?.[0]?.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className={`flex-1 max-w-[70%] ${msg.sender_id === profile?.id ? 'text-right' : ''}`}>
                      <div className="text-xs text-gray-500 mb-1">
                        <span 
                          className="hover:text-blue-400 cursor-pointer transition-colors"
                          onClick={() => navigate(`/profile/${msg.sender?.username}`)}
                        >{msg.sender?.username}</span> • {new Date(msg.created_at).toLocaleTimeString()}
                      </div>
                      <div
                        className={`inline-block px-4 py-2 rounded-lg ${
                          msg.sender_id === profile?.id
                            ? 'bg-mystery-500 text-white'
                            : 'bg-mystery-800 text-gray-200'
                        }`}
                      >
                        {msg.message}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-mystery-700">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 bg-mystery-800 border border-mystery-600 rounded-lg px-4 py-2 text-white focus:ring-1 focus:ring-mystery-500 outline-none"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={sending || !newMessage.trim()}
                    className="px-4 py-2 bg-mystery-500 hover:bg-mystery-400 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Members Tab */}
          {activeTab === 'members' && (
            <div className="p-6 overflow-y-auto h-full">
              {isLeader && (
                <button
                  onClick={() => {
                    loadAvailableInvestigators();
                    setShowInviteModal(true);
                  }}
                  className="mb-4 px-4 py-2 bg-mystery-500 hover:bg-mystery-400 text-white rounded-lg flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Invite Investigator
                </button>
              )}

              <div className="space-y-3">
                {teamMembers.map((member) => (
                  <div
                    key={member.investigator_id}
                    className="bg-mystery-800 border border-mystery-700 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-mystery-700 overflow-hidden">
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-mystery-accent font-bold">
                            {member.username[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span 
                            className="text-white font-medium hover:text-blue-400 cursor-pointer transition-colors"
                            onClick={() => navigate(`/profile/${member.username}`)}
                          >{member.username}</span>
                          {member.role === 'leader' && (
                            <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full border border-yellow-500/30">
                              Leader
                            </span>
                          )}
                        </div>
                        <div className="text-gray-400 text-sm">
                          Reputation: {member.reputation} • Share: {member.contribution_percentage}%
                        </div>
                      </div>
                    </div>
                    <div className="text-gray-500 text-sm">
                      Joined {new Date(member.joined_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reward Split Tab */}
          {activeTab === 'split' && isLeader && (
            <div className="p-6 overflow-y-auto h-full">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-white mb-2">Reward Distribution</h3>
                <p className="text-gray-400 text-sm">
                  Total reward: <span className="text-mystery-accent font-bold">€{rewardAmount}</span>
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  Set contribution percentages for each team member. Total must equal 100%.
                </p>
              </div>

              <div className="space-y-4 mb-6">
                {teamMembers.map((member) => {
                  const memberAmount = (rewardAmount * (contributionEdits[member.investigator_id] || 0)) / 100;
                  return (
                    <div
                      key={member.investigator_id}
                      className="bg-mystery-800 border border-mystery-700 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{member.username}</span>
                          {member.role === 'leader' && (
                            <span className="text-xs text-yellow-400">(Leader)</span>
                          )}
                        </div>
                        <span className="text-mystery-accent font-bold">€{memberAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={contributionEdits[member.investigator_id] || 0}
                          onChange={(e) =>
                            setContributionEdits({
                              ...contributionEdits,
                              [member.investigator_id]: parseInt(e.target.value)
                            })
                          }
                          className="flex-1"
                        />
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={contributionEdits[member.investigator_id] || 0}
                          onChange={(e) =>
                            setContributionEdits({
                              ...contributionEdits,
                              [member.investigator_id]: Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                            })
                          }
                          className="w-16 bg-mystery-700 border border-mystery-600 rounded px-2 py-1 text-white text-sm text-center"
                        />
                        <span className="text-gray-400 text-sm">%</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-mystery-800 border border-mystery-600 rounded-lg p-4 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-white font-medium">Total:</span>
                  <span className={`font-bold ${
                    Object.values(contributionEdits).reduce((sum, val) => sum + val, 0) === 100
                      ? 'text-green-400'
                      : 'text-red-400'
                  }`}>
                    {Object.values(contributionEdits).reduce((sum, val) => sum + val, 0)}%
                  </span>
                </div>
              </div>

              <button
                onClick={handleSaveContributions}
                className="w-full px-4 py-3 bg-mystery-500 hover:bg-mystery-400 text-white rounded-lg font-medium"
              >
                Save Reward Distribution
              </button>
            </div>
          )}
          
          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="p-6 overflow-y-auto h-full">
              {!analytics ? (
                <div className="flex items-center justify-center h-full">
                  <Loader className="w-8 h-8 text-mystery-accent animate-spin" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-mystery-800 border border-mystery-700 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-5 h-5 text-blue-400" />
                        <h4 className="text-sm font-semibold text-gray-300">Total Cases</h4>
                      </div>
                      <p className="text-3xl font-bold text-white">{analytics.totalCases}</p>
                      <p className="text-xs text-gray-500 mt-1">Cases worked by team</p>
                    </div>
                    
                    <div className="bg-mystery-800 border border-mystery-700 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-green-400" />
                        <h4 className="text-sm font-semibold text-gray-300">Success Rate</h4>
                      </div>
                      <p className="text-3xl font-bold text-white">{analytics.successRate}%</p>
                      <p className="text-xs text-gray-500 mt-1">{analytics.resolvedCases} resolved</p>
                    </div>
                    
                    <div className="bg-mystery-800 border border-mystery-700 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-5 h-5 text-yellow-400" />
                        <h4 className="text-sm font-semibold text-gray-300">Avg Resolution Time</h4>
                      </div>
                      <p className="text-3xl font-bold text-white">{analytics.avgResolutionTime}</p>
                      <p className="text-xs text-gray-500 mt-1">days per case</p>
                    </div>
                  </div>
                  
                  {/* Cases per Member Chart */}
                  <div className="bg-mystery-800 border border-mystery-700 rounded-lg p-6">
                    <h4 className="text-lg font-bold text-white mb-4">Cases per Member</h4>
                    {analytics.casesPerMember.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={analytics.casesPerMember}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis 
                            dataKey="name" 
                            stroke="#9ca3af"
                            style={{ fontSize: '12px' }}
                          />
                          <YAxis 
                            stroke="#9ca3af"
                            style={{ fontSize: '12px' }}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#1f2937', 
                              border: '1px solid #374151',
                              borderRadius: '8px'
                            }}
                          />
                          <Bar dataKey="cases" fill="#6366f1" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-gray-500 text-center py-8">No case data available</p>
                    )}
                  </div>
                  
                  {/* Category Distribution */}
                  <div className="bg-mystery-800 border border-mystery-700 rounded-lg p-6">
                    <h4 className="text-lg font-bold text-white mb-4">Success Rate by Category</h4>
                    {analytics.categoryDistribution.length > 0 ? (
                      <div className="flex items-center justify-center">
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={analytics.categoryDistribution}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {analytics.categoryDistribution.map((entry: any, index: number) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#1f2937', 
                                border: '1px solid #374151',
                                borderRadius: '8px'
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">No category data available</p>
                    )}
                  </div>
                  
                  {/* Team Contribution Progress */}
                  <div className="bg-mystery-800 border border-mystery-700 rounded-lg p-6">
                    <h4 className="text-lg font-bold text-white mb-4">Team Contribution</h4>
                    <div className="space-y-3">
                      {analytics.casesPerMember.map((member: any, idx: number) => {
                        const totalTeamCases = analytics.casesPerMember.reduce((sum: number, m: any) => sum + m.cases, 0);
                        const percentage = totalTeamCases > 0 ? Math.round((member.cases / totalTeamCases) * 100) : 0;
                        
                        return (
                          <div key={idx}>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="text-gray-300 font-medium">{member.name}</span>
                              <span className="text-mystery-400 font-semibold">{percentage}%</span>
                            </div>
                            <div className="w-full h-4 bg-mystery-900 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-mystery-500 to-mystery-400 transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {member.cases} cases • {member.contribution}% reward share
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Invite Modal */}
        {showInviteModal && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-mystery-800 rounded-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Invite Investigator</h3>
                <button onClick={() => setShowInviteModal(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {availableInvestigators.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4">No available investigators to invite</p>
                ) : (
                  availableInvestigators.map((inv) => (
                    <div
                      key={inv.id}
                      className="bg-mystery-900 border border-mystery-700 rounded-lg p-3 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-mystery-700 overflow-hidden flex-shrink-0">
                          {inv.avatar_url ? (
                            <img src={inv.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-mystery-accent text-xs font-bold">
                              {inv.username[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-white text-sm font-medium">{inv.username}</div>
                          <div className="text-gray-500 text-xs">Rep: {inv.reputation}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleInviteInvestigator(inv.id)}
                        className="px-3 py-1 bg-mystery-500 hover:bg-mystery-400 text-white rounded text-sm"
                      >
                        Invite
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
