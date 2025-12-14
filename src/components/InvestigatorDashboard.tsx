
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCases } from '../hooks/useCases';
import { User, Case } from '../types';
import { CheckCircle, FileSearch, Users, Star, AlertTriangle, Eye, Wallet, Shield, FolderOpen, ArrowRight, Sparkles, Mail, Award, ChevronDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AIToolsPanel } from './AIToolsPanel';
import { TeamInvitationsPanel } from './TeamInvitationsPanel';
import { InvestigatorApplicationForm } from './InvestigatorApplicationForm';
import VerificationRequestModal from './VerificationRequestModal';
import { ProBadge } from './ProBadge';
import { getMyInvitations } from '../services/teamService';
import { supabase } from '../lib/supabase';
import { verificationService } from '../services/verificationService';
import { walletService } from '../services/walletService';
import { getNotifications, Notification } from '../services/notificationService';

interface InvestigatorDashboardProps {
  user?: User;
  cases?: Case[];
  onNavigate?: (view: string, id?: string) => void;
}

export const InvestigatorDashboard: React.FC<InvestigatorDashboardProps> = ({
  user: propUser,
  cases: propCases,
  onNavigate: propOnNavigate
}) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { cases: fetchedCases } = useCases();

  // Use passed user or fall back to auth profile
  const user = (propUser || (profile ? {
    ...profile,
    // Map profile fields to User type expectations where possible
    name: profile.full_name || profile.username,
    avatar: profile.avatar_url || '',
    joinedDate: profile.created_at,
    // Add missing fields with defaults
    walletBalance: 0,
    cases_solved: 0,
    investigator_status: profile.investigator_status
  } : null)) as any; // Cast to any to handle extended properties

  const cases = React.useMemo(() => propCases || fetchedCases || [], [propCases, fetchedCases]);

  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [activityData, setActivityData] = useState<any[]>([]);
  
  const onNavigate = propOnNavigate || ((view: string, id?: string) => {
    if (view === 'case' && id) {
      navigate(`/cases/${id}`);
    } else {
      navigate(`/${view}`);
    }
  });

  const [activeTab, setActiveTab] = useState<'MY_CASES' | 'AVAILABLE' | 'WALLET' | 'INVITATIONS' | 'RESOLVED' | 'DISPUTED'>('MY_CASES');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [showAITools, setShowAITools] = useState(false);
  const [pendingInvitationsCount, setPendingInvitationsCount] = useState(0);
  const [hasApplication, setHasApplication] = useState<boolean | null>(null);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<any>(null);
  const [systemAlerts, setSystemAlerts] = useState<Notification[]>([]);

  const myCases = React.useMemo(() => (cases || []).filter(c => c.assignedInvestigator?.id === user?.id), [cases, user?.id]);
  const availableCases = React.useMemo(() => (cases || []).filter(c => c.status === 'OPEN' && !c.assignedInvestigator), [cases]);

  // Calculate activity data from real cases
  useEffect(() => {
    if (!myCases) return;

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(today.getDate() - (6 - i));
      return {
        date: d,
        dayName: days[d.getDay()],
        fullDate: d.toISOString().split('T')[0]
      };
    });

    const data = last7Days.map(day => {
      // Count cases assigned/created on this day
      const daysCases = myCases.filter(c => {
        const cDate = new Date(c.submittedDate || c.incidentDate); // Fallback to incident date if submitted is missing
        return cDate.toISOString().split('T')[0] === day.fullDate;
      }).length;

      // Count resolved cases on this day (mocking based on status + date proximity for now as resolvedDate isn't in standard Case type)
      // In a real scenario, we would check resolution date.
      const resolvedCount = myCases.filter(c => {
         const cDate = new Date(c.submittedDate);
         return c.status === 'RESOLVED' && cDate.toISOString().split('T')[0] === day.fullDate;
      }).length;

      return {
        name: day.dayName,
        cases: daysCases,
        resolved: resolvedCount
      };
    });

    setActivityData(data);
  }, [myCases]);

  // Load wallet balance
  useEffect(() => {
    if (!user?.id) return;
    
    const loadWallet = async () => {
      try {
        const balance = await walletService.getBalance(user.id);
        setWalletBalance(balance);
        
        const txs = await walletService.getTransactions(user.id, 5);
        setTransactions(txs);
      } catch (error) {
        console.error('Failed to load wallet data:', error);
      }
    };
    loadWallet();
  }, [user?.id]);

  // Check if user has submitted an application
  useEffect(() => {
    if (!user?.id) return;
    
    const checkApplication = async () => {
      try {
        // Use RPC function instead of direct table query
        const { data, error } = await supabase
          .rpc('check_investigator_application', { p_user_id: user.id });

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
  }, [user?.id]);

  // Load pending invitations count
  useEffect(() => {
    if (!user?.id) return;
    
    const loadInvitationsCount = async () => {
      try {
        // Wrap in try-catch to prevent crashing if table/service issue
        const invitations = await getMyInvitations(user.id);
        if (Array.isArray(invitations)) {
          setPendingInvitationsCount(invitations.length);
        }
      } catch (error) {
        // Silent fail or low-level log to avoid spamming console for known dev issues
        console.warn('Could not load team invitations - service may be unavailable', error);
      }
    };
    loadInvitationsCount();
  }, [user?.id]);

  // Load verification status
  useEffect(() => {
    if (!user?.id) return;
    
    const loadVerification = async () => {
      try {
        const status = await verificationService.getVerificationStatus(user.id);
        setVerificationStatus(status);
      } catch (error) {
        console.error('Failed to load verification:', error);
      }
    };
    loadVerification();
  }, [user?.id]);

  // Load system alerts (notifications)
  useEffect(() => {
    if (!user?.id) return;

    const loadAlerts = async () => {
      try {
        // Fetch latest 5 notifications
        const notifications = await getNotifications(user.id, 5);
        setSystemAlerts(notifications);
      } catch (error) {
        console.warn('Failed to load system alerts:', error);
      }
    };
    loadAlerts();
  }, [user?.id]);

  const openAITools = (caseItem: Case) => {
    setSelectedCase(caseItem);
    setShowAITools(true);
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Application Not Submitted - Show Form */}
      {user?.investigator_status === 'pending' && hasApplication === false && (
        <div className="bg-mystery-800 border-2 border-blue-500/50 rounded-xl p-8 mb-8">
          <div className="flex items-start gap-4 mb-6">
            <Shield className="w-12 h-12 text-blue-400 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-white mb-2">Complete Your Investigator Application</h3>
              <p className="text-gray-300 mb-4">
                You've registered as an investigator, but need to submit your application before you can accept cases.
                Please complete the form below to proceed.
              </p>
            </div>
          </div>
          
          <InvestigatorApplicationForm
            userId={user.id}
            onSuccess={() => {
              setHasApplication(true);
              setApplicationStatus('pending');
              alert('✅ Application submitted successfully! You will be notified once reviewed.');
            }}
            onCancel={() => {
              // User can't cancel from dashboard, form is required
            }}
          />
        </div>
      )}

      {/* Application Submitted - Pending Approval Banner */}
      {user?.investigator_status === 'pending' && hasApplication === true && applicationStatus === 'pending' && (
        <div className="bg-yellow-500/10 border-2 border-yellow-500/50 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-8 h-8 text-yellow-400 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-xl font-bold text-yellow-400 mb-2">⏳ Application Under Review</h3>
              <p className="text-white mb-2">
                Your investigator application has been submitted and is pending administrator review.
              </p>
              <p className="text-gray-300 text-sm">
                You will receive an email notification once your application is processed. 
                In the meantime, you can browse available cases but cannot accept assignments until approved.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Application Rejected Banner */}
      {applicationStatus === 'rejected' && (
        <div className="bg-red-500/10 border-2 border-red-500/50 rounded-xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-8 h-8 text-red-400 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="text-xl font-bold text-red-400 mb-2">❌ Application Rejected</h3>
              <p className="text-white mb-2">
                Unfortunately, your investigator application was not approved at this time.
              </p>
              <p className="text-gray-300 text-sm">
                You may reapply after addressing the feedback provided by administrators.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="mb-4">
           <h1 className="text-2xl sm:text-3xl font-bold text-white flex flex-wrap items-center gap-2 sm:gap-3">
            Investigation Console
            {user?.investigator_status === 'approved' && <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />}
            {verificationStatus?.verified && (
              <ProBadge
                type="verified"
                level={verificationStatus.verification_level || 'basic'}
                color={verificationStatus.badge_color}
                size="md"
              />
            )}
          </h1>
           <p className="text-gray-400 text-sm sm:text-base mt-1">Welcome back, {user?.username || 'Investigator'}.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Verification Buttons */}
          {user?.investigator_status === 'approved' && !verificationStatus?.verified && (
            <button
              onClick={() => setShowVerificationModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-500/20 text-sm sm:text-base"
            >
              <Shield className="w-4 h-4" />
              <span className="truncate">{verificationStatus ? 'Manage Verification' : 'Get Verified'}</span>
            </button>
          )}
          
          <button 
            onClick={() => setActiveTab('INVITATIONS')}
            className="px-4 py-2 bg-mystery-800 hover:bg-mystery-700 text-white border border-mystery-600 rounded-lg flex items-center justify-center gap-2 relative text-sm sm:text-base"
          >
            <Mail className="w-4 h-4" /> 
            <span className="truncate">Team Invitations</span>
            {pendingInvitationsCount > 0 && (
              <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {pendingInvitationsCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Subscription Promo Banner */}
      {user?.investigator_status === 'approved' && (
        <div className="bg-gradient-to-r from-mystery-500/20 via-purple-500/20 to-blue-500/20 border-2 border-mystery-500/50 rounded-xl p-4 sm:p-6 mb-8 hover:border-mystery-400/70 transition-all">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
            <div className="flex items-start gap-3 sm:gap-4 flex-1">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-mystery-500/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-mystery-300" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-xl font-bold text-white mb-1 flex items-center gap-2">
                  ⭐ Unlock AI-Powered Investigation Tools
                </h3>
                <p className="text-gray-300 text-xs sm:text-sm">
                  Upgrade to Basic, Premium, or Pro to access AI image analysis, document scanning, and advanced research tools
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/subscription/plans')}
              className="w-full sm:w-auto px-6 py-3 bg-mystery-500 hover:bg-mystery-400 text-white rounded-lg font-semibold flex items-center justify-center gap-2 whitespace-nowrap transition-all shadow-lg shadow-mystery-500/30 text-sm sm:text-base"
            >
              View Plans <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-mystery-800 p-6 rounded-xl border border-mystery-700">
          <div className="flex justify-between items-start mb-2">
            <span className="text-gray-400 text-sm">Active Cases</span>
            <FileSearch className="w-5 h-5 text-mystery-400" />
          </div>
          <div className="text-3xl font-bold text-white">{myCases.filter(c => c.status === 'INVESTIGATING' || c.status === 'PENDING_REVIEW').length}</div>
          <span className="text-xs text-green-400">Currently assigned</span>
        </div>
        
        <div className="bg-mystery-800 p-6 rounded-xl border border-mystery-700">
          <div className="flex justify-between items-start mb-2">
            <span className="text-gray-400 text-sm">Resolved</span>
            <CheckCircle className="w-5 h-5 text-green-400" />
          </div>
          <div className="text-3xl font-bold text-white">{user?.cases_solved || myCases.filter(c => c.status === 'RESOLVED').length}</div>
          <span className="text-xs text-gray-500">Career Total</span>
        </div>

        <div className="bg-mystery-800 p-6 rounded-xl border border-mystery-700">
          <div className="flex justify-between items-start mb-2">
            <span className="text-gray-400 text-sm">Reputation</span>
            <Star className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="text-3xl font-bold text-white">{user?.reputation || 0}</div>
          <span className="text-xs text-gray-500">Rank: Senior Investigator</span>
        </div>

        <div className="bg-mystery-800 p-6 rounded-xl border border-mystery-700">
          <div className="flex justify-between items-start mb-2">
            <span className="text-gray-400 text-sm">Wallet Balance</span>
            <Wallet className="w-5 h-5 text-green-400" />
          </div>
          <div className="text-3xl font-bold text-white">€{walletBalance.toFixed(2)}</div>
          <span className="text-xs text-gray-500">Available to withdraw</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Workspace */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Desktop Tabs */}
          <div className="hidden md:flex border-b border-mystery-700 mb-4">
             <button 
                onClick={() => setActiveTab('MY_CASES')}
                className={`pb-4 px-6 font-medium text-sm transition-colors relative whitespace-nowrap ${activeTab === 'MY_CASES' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Assigned Cases
                {activeTab === 'MY_CASES' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-mystery-500"></div>}
              </button>
              <button 
                onClick={() => setActiveTab('AVAILABLE')}
                className={`pb-4 px-6 font-medium text-sm transition-colors relative whitespace-nowrap ${activeTab === 'AVAILABLE' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Case Board (New)
                {activeTab === 'AVAILABLE' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-mystery-500"></div>}
              </button>
              <button 
                onClick={() => setActiveTab('INVITATIONS')}
                className={`pb-4 px-6 font-medium text-sm transition-colors relative whitespace-nowrap ${activeTab === 'INVITATIONS' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Team Invitations
                {pendingInvitationsCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                    {pendingInvitationsCount}
                  </span>
                )}
                {activeTab === 'INVITATIONS' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-mystery-500"></div>}
              </button>
              <button 
                onClick={() => setActiveTab('WALLET')}
                className={`pb-4 px-6 font-medium text-sm transition-colors relative whitespace-nowrap ${activeTab === 'WALLET' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Wallet
                {activeTab === 'WALLET' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-mystery-500"></div>}
              </button>
              <button 
                onClick={() => setActiveTab('RESOLVED')}
                className={`pb-4 px-6 font-medium text-sm transition-colors relative whitespace-nowrap ${activeTab === 'RESOLVED' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Resolved Cases
                {activeTab === 'RESOLVED' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-mystery-500"></div>}
              </button>
              <button 
                onClick={() => setActiveTab('DISPUTED')}
                className={`pb-4 px-6 font-medium text-sm transition-colors relative whitespace-nowrap ${activeTab === 'DISPUTED' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >
                Disputes
                {myCases.filter(c => c.status === 'DISPUTED').length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                    {myCases.filter(c => c.status === 'DISPUTED').length}
                  </span>
                )}
                {activeTab === 'DISPUTED' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-mystery-500"></div>}
              </button>
          </div>

          {/* Mobile Dropdown Navigation */}
          <div className="sm:hidden mb-4">
            <div className="relative">
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="w-full bg-mystery-800 border border-mystery-700 rounded-lg px-4 py-3 flex items-center justify-between text-white"
              >
                <div className="flex items-center gap-2">
                  {activeTab === 'MY_CASES' && (
                    <>Assigned Cases</>
                  )}
                  {activeTab === 'AVAILABLE' && (
                    <>Case Board (New)</>
                  )}
                  {activeTab === 'INVITATIONS' && (
                    <>Team Invitations
                    {pendingInvitationsCount > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                        {pendingInvitationsCount}
                      </span>
                    )}</>
                  )}
                  {activeTab === 'WALLET' && (
                    <>Wallet</>
                  )}
                  {activeTab === 'RESOLVED' && (
                    <>Resolved Cases</>
                  )}
                  {activeTab === 'DISPUTED' && (
                    <>Disputes
                    {myCases.filter(c => c.status === 'DISPUTED').length > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                        {myCases.filter(c => c.status === 'DISPUTED').length}
                      </span>
                    )}</>
                  )}
                </div>
                <ChevronDown className={`w-5 h-5 transition-transform ${
                  showMobileMenu ? 'rotate-180' : ''
                }`} />
              </button>

              {showMobileMenu && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-mystery-800 border border-mystery-700 rounded-lg shadow-xl z-50">
                  <button
                    onClick={() => { setActiveTab('MY_CASES'); setShowMobileMenu(false); }}
                    className={`w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-mystery-700 transition-colors ${
                      activeTab === 'MY_CASES' ? 'text-mystery-400 bg-mystery-700/50' : 'text-white'
                    }`}
                  >
                    Assigned Cases
                  </button>
                  <button
                    onClick={() => { setActiveTab('AVAILABLE'); setShowMobileMenu(false); }}
                    className={`w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-mystery-700 transition-colors ${
                      activeTab === 'AVAILABLE' ? 'text-mystery-400 bg-mystery-700/50' : 'text-white'
                    }`}
                  >
                    Case Board (New)
                  </button>
                  <button
                    onClick={() => { setActiveTab('INVITATIONS'); setShowMobileMenu(false); }}
                    className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-mystery-700 transition-colors ${
                      activeTab === 'INVITATIONS' ? 'text-mystery-400 bg-mystery-700/50' : 'text-white'
                    }`}
                  >
                    <span>Team Invitations</span>
                    {pendingInvitationsCount > 0 && (
                      <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                        {pendingInvitationsCount}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => { setActiveTab('WALLET'); setShowMobileMenu(false); }}
                    className={`w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-mystery-700 transition-colors ${
                      activeTab === 'WALLET' ? 'text-mystery-400 bg-mystery-700/50' : 'text-white'
                    }`}
                  >
                    Wallet
                  </button>
                  <button
                    onClick={() => { setActiveTab('RESOLVED'); setShowMobileMenu(false); }}
                    className={`w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-mystery-700 transition-colors ${
                      activeTab === 'RESOLVED' ? 'text-mystery-400 bg-mystery-700/50' : 'text-white'
                    }`}
                  >
                    Resolved Cases
                  </button>
                  <button
                    onClick={() => { setActiveTab('DISPUTED'); setShowMobileMenu(false); }}
                    className={`w-full px-4 py-3 text-left flex items-center justify-between hover:bg-mystery-700 transition-colors rounded-b-lg ${
                      activeTab === 'DISPUTED' ? 'text-mystery-400 bg-mystery-700/50' : 'text-white'
                    }`}
                  >
                    <span>Disputes</span>
                    {myCases.filter(c => c.status === 'DISPUTED').length > 0 && (
                      <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                        {myCases.filter(c => c.status === 'DISPUTED').length}
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {activeTab === 'INVITATIONS' && (
            <TeamInvitationsPanel />
          )}

          {/* Resolved Cases Tab with Feedback */}
          {activeTab === 'RESOLVED' && (
            <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6">
              <h3 className="font-bold text-white mb-6 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                Resolved Cases
              </h3>
              <div className="space-y-4">
                {myCases.filter(c => c.status === 'RESOLVED').length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No resolved cases yet</p>
                    <p className="text-sm text-gray-500 mt-1">Keep investigating to build your reputation!</p>
                  </div>
                ) : (
                  myCases.filter(c => c.status === 'RESOLVED').map(caseItem => (
                    <div key={caseItem.id} className="bg-mystery-900 p-4 rounded-lg border border-mystery-700 hover:border-mystery-600 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h4 className="font-bold text-white mb-1">{caseItem.title}</h4>
                          <p className="text-sm text-gray-400 mb-2">{caseItem.description.substring(0, 100)}...</p>
                          <div className="flex gap-4 text-xs text-gray-500">
                            <span>Resolved: {new Date(caseItem.updatedAt || '').toLocaleDateString()}</span>
                            <span>Reward: €{caseItem.rewardAmount || 0}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => onNavigate('case', caseItem.id)}
                          className="text-mystery-400 hover:text-mystery-300"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </div>
                      
                      {/* Rating and Feedback */}
                      {(caseItem as any).userRating && (
                        <div className="mt-3 pt-3 border-t border-mystery-700">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm text-gray-400">User Rating:</span>
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map(star => (
                                <Star 
                                  key={star} 
                                  className={`w-4 h-4 ${star <= ((caseItem as any).userRating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`} 
                                />
                              ))}
                            </div>
                            <span className="text-sm text-green-400 ml-2">
                              +{((caseItem as any).userRating || 0) * 5} reputation
                            </span>
                          </div>
                          {(caseItem as any).userFeedback && (
                            <div className="bg-mystery-800 p-3 rounded border border-mystery-700">
                              <p className="text-sm text-gray-300 italic">"{(caseItem as any).userFeedback}"</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Disputed Cases Tab */}
          {activeTab === 'DISPUTED' && (
            <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6">
              <h3 className="font-bold text-white mb-6 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                Disputed Cases
              </h3>
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-300">
                  <strong>Note:</strong> These cases have been disputed by the submitter and are under admin review.
                </p>
              </div>
              <div className="space-y-4">
                {myCases.filter(c => c.status === 'DISPUTED').length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-400">No disputed cases</p>
                    <p className="text-sm text-gray-500 mt-1">Great work! All your resolutions have been accepted.</p>
                  </div>
                ) : (
                  myCases.filter(c => c.status === 'DISPUTED').map(caseItem => (
                    <div key={caseItem.id} className="bg-mystery-900 p-4 rounded-lg border border-red-800 hover:border-red-700 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-bold text-white">{caseItem.title}</h4>
                            <span className="px-2 py-1 bg-red-900/50 text-red-300 text-xs rounded">DISPUTED</span>
                          </div>
                          <p className="text-sm text-gray-400 mb-2">{caseItem.description.substring(0, 100)}...</p>
                          <div className="flex gap-4 text-xs text-gray-500">
                            <span>Disputed: {new Date(caseItem.updatedAt || '').toLocaleDateString()}</span>
                            <span>Reward: €{caseItem.rewardAmount || 0}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => onNavigate('case', caseItem.id)}
                          className="text-mystery-400 hover:text-mystery-300"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-mystery-700">
                        <p className="text-sm text-gray-400">
                          <strong>Status:</strong> Awaiting admin review. You will be notified once the dispute is resolved.
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'WALLET' && (
             <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6">
               <h3 className="font-bold text-white mb-6">Financial Overview</h3>
               <div className="grid grid-cols-2 gap-4 mb-6">
                 <div className="bg-mystery-900 p-4 rounded-lg">
                   <p className="text-gray-400 text-sm mb-1">Total Earnings</p>
                   <p className="text-2xl font-bold text-white">€{walletBalance.toFixed(2)}</p>
                 </div>
                 <div className="bg-mystery-900 p-4 rounded-lg">
                   <p className="text-gray-400 text-sm mb-1">Pending Payouts</p>
                   <p className="text-2xl font-bold text-gray-300">$0</p>
                 </div>
               </div>
               
               <h4 className="font-bold text-white mb-4">Recent Transactions</h4>
               <div className="space-y-2">
                 {transactions.length === 0 ? (
                   <p className="text-gray-500 text-sm">No recent transactions.</p>
                 ) : (
                   transactions.map(tx => (
                     <div key={tx.id} className="flex justify-between items-center p-3 bg-mystery-900 rounded border border-mystery-700">
                       <div className="flex items-center gap-3">
                         {tx.amount > 0 ? (
                           <CheckCircle className="w-4 h-4 text-green-500" />
                         ) : (
                           <Wallet className="w-4 h-4 text-gray-400" />
                         )}
                         <span className="text-sm text-gray-300 capitalize">{tx.type} {tx.case_id ? `#${tx.case_id.substring(0, 4)}` : ''}</span>
                       </div>
                       <span className={`font-mono font-bold ${['reward', 'deposit', 'refund'].includes(tx.type) ? 'text-green-400' : 'text-red-400'}`}>
                         {['reward', 'deposit', 'refund'].includes(tx.type) ? '+' : '-'}{tx.amount.toFixed(2)} {tx.currency}
                       </span>
                     </div>
                   ))
                 )}
               </div>
             </div>
          )}

          {activeTab === 'MY_CASES' && (
            <div className="space-y-4">
              {myCases.length === 0 ? (
                <div className="text-center py-12 bg-mystery-800 rounded-xl border border-mystery-700">
                  <FolderOpen className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No active investigations. Check the Case Board.</p>
                </div>
              ) : (
                myCases.map(c => (
                  <div key={c.id} className="bg-mystery-800 p-4 rounded-xl border border-mystery-700 flex gap-4 hover:border-mystery-500 transition-colors">
                    <img src={c.imageUrl} className="w-32 h-24 object-cover rounded-lg bg-gray-900" />
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                         <h4 className="font-bold text-white text-lg">{c.title}</h4>
                         <span className={`px-2 py-1 rounded text-xs font-bold ${
                           c.status === 'RESOLVED' ? 'bg-green-900 text-green-400' : 
                           c.status === 'INVESTIGATING' ? 'bg-blue-900 text-blue-400' : 'bg-purple-900 text-purple-400'
                         }`}>{c.status}</span>
                      </div>
                      <p className="text-gray-400 text-sm mt-1 line-clamp-1">{c.description}</p>
                      <div className="mt-4 flex justify-between items-center gap-2">
                        <span className="text-xs text-gray-500">Inc: {new Date(c.incidentDate).toLocaleDateString()}</span>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => openAITools(c)}
                            className="px-4 py-2 bg-mystery-600 hover:bg-mystery-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                          >
                            <Sparkles className="w-3 h-3" /> AI Tools
                          </button>
                          <button 
                            onClick={() => onNavigate('case', c.id)}
                            className="px-4 py-2 bg-mystery-700 hover:bg-mystery-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2"
                          >
                            Open Case File <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'AVAILABLE' && (
             <div className="space-y-4">
               {availableCases.length === 0 ? (
                  <div className="text-center py-12 bg-mystery-800 rounded-xl border border-mystery-700">
                    <p className="text-gray-400">No open cases available for assignment right now.</p>
                  </div>
               ) : (
                  availableCases.map(c => (
                    <div key={c.id} className="bg-mystery-800 p-4 rounded-xl border border-mystery-700 flex gap-4">
                      <div className="w-24 h-24 bg-gray-900 rounded-lg flex-shrink-0 overflow-hidden">
                         <img src={c.imageUrl} className="w-full h-full object-cover opacity-80" />
                      </div>
                      <div className="flex-1">
                         <div className="flex justify-between items-start">
                           <h4 className="font-bold text-white">{c.title}</h4>
                           <span className="text-green-400 font-mono font-bold">${c.reward}</span>
                         </div>
                         <div className="flex items-center gap-2 mt-1 mb-2">
                           <span className="px-2 py-0.5 bg-mystery-900 text-xs text-gray-400 rounded border border-mystery-700">{c.category}</span>
                           <span className="text-xs text-gray-500">{c.location}</span>
                         </div>
                         <p className="text-xs text-gray-400 line-clamp-2 mb-3">{c.description}</p>
                         <button 
                           onClick={() => {
                             if (user?.investigator_status !== 'approved') {
                               alert('⚠️ You must complete your investigator application and be approved by administrators before accepting cases.');
                               return;
                             }
                             onNavigate('case', c.id);
                           }}
                           disabled={user?.investigator_status !== 'approved'}
                           className={`w-full py-2 text-white text-xs font-bold rounded-lg transition-colors ${
                             user?.investigator_status === 'approved'
                               ? 'bg-mystery-600 hover:bg-mystery-500'
                               : 'bg-gray-700 opacity-50 cursor-not-allowed'
                           }`}
                         >
                           {user?.investigator_status === 'approved' ? 'Review & Assign' : '🔒 Approval Required'}
                         </button>
                      </div>
                    </div>
                  ))
               )}
             </div>
          )}
        </div>

        {/* Sidebar Stats */}
        <div className="space-y-6">
          <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6">
            <h3 className="font-bold text-white mb-4">Weekly Activity</h3>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                    cursor={{ fill: '#334155', opacity: 0.2 }}
                  />
                  <Bar dataKey="cases" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="resolved" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

           <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2">
               <AlertTriangle className="w-4 h-4 text-yellow-500" /> System Alerts
            </h3>
            <div className="space-y-3">
              {systemAlerts.length === 0 ? (
                <p className="text-gray-500 text-sm italic">No new system alerts.</p>
              ) : (
                systemAlerts.map(alert => (
                  <div key={alert.id} className={`p-3 rounded-lg text-xs border ${
                    alert.type === 'case_update' || alert.type === 'dispute_created'
                      ? 'bg-yellow-900/20 border-yellow-900/50 text-yellow-200'
                      : 'bg-blue-900/20 border-blue-900/50 text-blue-200'
                  }`}>
                    <span className="font-bold block mb-1">{alert.title}</span>
                    {alert.message}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* AI Tools Modal */}
      {showAITools && selectedCase && (
        <AIToolsPanel
          caseId={selectedCase.id}
          caseData={{
            title: selectedCase.title,
            description: selectedCase.description,
            media_url: selectedCase.imageUrl
          }}
          onClose={() => setShowAITools(false)}
        />
      )}

      {/* Verification Request Modal */}
      {user?.id && (
        <VerificationRequestModal
          userId={user.id}
          isOpen={showVerificationModal}
          onClose={() => setShowVerificationModal(false)}
          onSuccess={() => {
            setShowVerificationModal(false);
            // Reload verification status
            verificationService.getVerificationStatus(user.id).then(setVerificationStatus);
          }}
        />
      )}
    </div>
  );
};
