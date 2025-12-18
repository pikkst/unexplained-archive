
import React, { useEffect, useState } from 'react';
import { Shield, AlertCircle, Users, Database, Scale, Gavel, FileText, ArrowRightLeft, TrendingUp, TrendingDown, BarChart3, Globe, Search, Newspaper, Eye, MousePointer, CheckCircle, X, DollarSign, ChevronDown, Activity, CreditCard } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Case } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { MassNotificationPanel } from './MassNotificationPanel';
import { SubscriptionGroupNotifications } from './SubscriptionGroupNotifications';
import WorldMapVisualization from './WorldMapVisualization';
import { CampaignManager } from './CampaignManager';
import { AdminPaymentDashboard } from './AdminPaymentDashboard';

const COLORS = ['#6366f1', '#22d3ee', '#a855f7', '#94a3b8', '#f59e0b', '#10b981'];

// Props to receive cases and action handlers
interface AdminDashboardProps {
    cases?: Case[];
    onResolveDispute?: (caseId: string, action: 'RELEASE' | 'REJECT' | 'VOTE') => void;
}

interface CategoryDistribution {
  name: string;
  value: number;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ cases: initialCases, onResolveDispute }) => {
  const [cases, setCases] = useState<Case[]>(initialCases || []);
  const [categoryDistribution, setCategoryDistribution] = useState<CategoryDistribution[]>([]);
  const [pendingInvestigators, setPendingInvestigators] = useState<any[]>([]);
  const [investigatorApplications, setInvestigatorApplications] = useState<any[]>([]);
  const [activeInvestigators, setActiveInvestigators] = useState<any[]>([]);
  const [backgroundChecks, setBackgroundChecks] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [selectedUserForCredits, setSelectedUserForCredits] = useState<any | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [awardingCredits, setAwardingCredits] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'content' | 'investigators' | 'verifications' | 'subscriptions' | 'campaigns' | 'payments' | 'users'>('overview');
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [stats, setStats] = useState({
  totalCases: 0,
  activeUsers: 0,
  pendingInvestigators: 0,
  pendingVerifications: 0,
  disputedCases: 0,
  totalVolume: 0,
  platformRevenue: 0,
  totalUserDeposits: 0,
  stripeBalance: 0,
  proSubscribers: 0
});
  const [analyticsData, setAnalyticsData] = useState({
    pageViews: 0,
    uniqueVisitors: 0,
    activeUsersNow: 0,
    avgSessionDuration: '0m',
    bounceRate: '0%',
    topPages: [] as { page: string; views: number }[],
    trafficSources: [] as { source: string; visits: number }[],
    topCountries: [] as { country: string; visits: number }[]
  });
  const [categoryTrends, setCategoryTrends] = useState<any[]>([]);
  const [seoRankings, setSeoRankings] = useState<any[]>([]);
  const [newSeoRanking, setNewSeoRanking] = useState({ keyword: '', page_url: '', search_engine: 'google', ranking_position: 1, country: 'US' });
  const [editingSeoId, setEditingSeoId] = useState<string | null>(null);
  const [articles, setArticles] = useState<any[]>([]);
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null);
  const [editingArticle, setEditingArticle] = useState<any>(null);
  const [newArticle, setNewArticle] = useState({ title: '', content: '', seo_keywords: '' });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [publishingArticle, setPublishingArticle] = useState(false);
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  
  // Forum Moderation State
  const [forumPosts, setForumPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  
  // Auto-refresh timer for analytics
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [prevAnalyticsData, setPrevAnalyticsData] = useState(analyticsData);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // Animated counter hook
  const useAnimatedCounter = (targetValue: number, duration: number = 1000) => {
    const [displayValue, setDisplayValue] = useState(targetValue);
    
    useEffect(() => {
      const startValue = displayValue;
      const difference = targetValue - startValue;
      const startTime = Date.now();
      
      if (difference === 0) return;
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = Math.round(startValue + difference * easeOutQuart);
        
        setDisplayValue(currentValue);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      requestAnimationFrame(animate);
    }, [targetValue]);
    
    return displayValue;
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  useEffect(() => {
    if (activeTab === 'content') {
      loadForumPosts();
    }
    if (activeTab === 'users') {
      loadUsers();
    }
  }, [activeTab]);
  
  // Auto-refresh analytics every 30 seconds when on analytics tab
  useEffect(() => {
    if (activeTab === 'analytics' && autoRefreshEnabled) {
      const interval = setInterval(() => {
        // Only load if not already loading
        if (!isLoadingAnalytics) {
          loadAnalytics();
        }
      }, 30000); // 30 seconds
      
      return () => clearInterval(interval);
    }
  }, [activeTab, autoRefreshEnabled, isLoadingAnalytics]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, role, credits, lifetime_credits_earned, lifetime_credits_spent, reputation, is_pro_member, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
      setFilteredUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadAnalytics = async () => {
    if (isLoadingAnalytics) return; // Prevent concurrent calls
    
    try {
      setIsLoadingAnalytics(true);
      // Save previous data for animation
      setPrevAnalyticsData(analyticsData);
      
      // Try to fetch from Google Analytics API first with timeout
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // Reduced to 5 second timeout
        
        // Fetch both regular analytics and realtime data
        const [gaResponse, realtimeResponse] = await Promise.race([
          Promise.all([
            supabase.functions.invoke('google-analytics', {
              body: { action: 'fetch_analytics' }
            }),
            supabase.functions.invoke('google-analytics', {
              body: { action: 'fetch_realtime' }
            })
          ]),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('GA API timeout')), 5000)
          )
        ]) as any;
        
        clearTimeout(timeoutId);

        // Check if GA API returned meaningful data (not just zeros)
        const hasGAData = gaResponse.data?.success && 
                         gaResponse.data.data && 
                         (gaResponse.data.data.pageViews > 0 || gaResponse.data.data.uniqueVisitors > 0);

        if (hasGAData) {
          console.log('✅ Using Google Analytics API data');
          setAnalyticsData({
            pageViews: gaResponse.data.data.pageViews,
            uniqueVisitors: gaResponse.data.data.uniqueVisitors,
            activeUsersNow: realtimeResponse.data?.data?.activeUsers || 0,
            avgSessionDuration: gaResponse.data.data.avgSessionDuration,
            bounceRate: gaResponse.data.data.bounceRate,
            topPages: gaResponse.data.data.topPages,
            trafficSources: gaResponse.data.data.trafficSources,
            topCountries: gaResponse.data.data.topCountries,
          });
          
          await loadCategoryTrends();
          setIsLoadingAnalytics(false);
          return; // Success, exit early
        }
        
        console.log('⚠️ GA API returned no data, using Supabase fallback');
        if (gaResponse.error) {
          console.warn('Google Analytics API not available:', gaResponse.error);
        }
      } catch (gaError) {
        console.warn('Failed to fetch Google Analytics:', gaError);
        // Don't fail completely, continue to fallback
      }

      // Fallback to Supabase analytics_events table
      console.log('📊 Using fallback Supabase analytics');
      const { data: analyticsEvents, error: analyticsError } = await supabase
        .from('analytics_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);

      console.log('Analytics events fetched:', {
        count: analyticsEvents?.length || 0,
        error: analyticsError,
        sample: analyticsEvents?.[0]
      });

      if (analyticsEvents) {
        // Calculate metrics
        const pageViews = analyticsEvents.length;
        const uniqueVisitors = new Set(analyticsEvents.map(e => e.visitor_id)).size;
        
        console.log('📈 Calculated metrics:', {
          pageViews,
          uniqueVisitors,
          events: analyticsEvents.length
        });
        
        // Top pages
        const pageCount: { [key: string]: number } = {};
        analyticsEvents.forEach(e => {
          if (e.page_path) {
            pageCount[e.page_path] = (pageCount[e.page_path] || 0) + 1;
          }
        });
        const topPages = Object.entries(pageCount)
          .map(([page, views]) => ({ page, views }))
          .sort((a, b) => b.views - a.views)
          .slice(0, 10);

        // Traffic sources
        const sourceCount: { [key: string]: number } = {};
        analyticsEvents.forEach(e => {
          if (e.referrer) {
            sourceCount[e.referrer] = (sourceCount[e.referrer] || 0) + 1;
          }
        });
        const trafficSources = Object.entries(sourceCount)
          .map(([source, visits]) => ({ source, visits }))
          .sort((a, b) => b.visits - a.visits)
          .slice(0, 10);

        // Top countries
        const countryCount: { [key: string]: number } = {};
        analyticsEvents.forEach(e => {
          if (e.country) {
            countryCount[e.country] = (countryCount[e.country] || 0) + 1;
          }
        });
        const topCountries = Object.entries(countryCount)
          .map(([country, visits]) => ({ country, visits }))
          .sort((a, b) => b.visits - a.visits);

        // Calculate session duration
        const sessionTimes: { [key: string]: { start: Date; end: Date } } = {};
        analyticsEvents.forEach(e => {
          if (e.session_id) {
            const eventTime = new Date(e.created_at);
            if (!sessionTimes[e.session_id]) {
              sessionTimes[e.session_id] = { start: eventTime, end: eventTime };
            } else {
              if (eventTime < sessionTimes[e.session_id].start) {
                sessionTimes[e.session_id].start = eventTime;
              }
              if (eventTime > sessionTimes[e.session_id].end) {
                sessionTimes[e.session_id].end = eventTime;
              }
            }
          }
        });
        
        const sessionDurations = Object.values(sessionTimes).map(({ start, end }) => 
          (end.getTime() - start.getTime()) / 1000
        ).filter(d => d > 0);
        
        const avgDuration = sessionDurations.length > 0
          ? sessionDurations.reduce((sum, d) => sum + d, 0) / sessionDurations.length
          : 0;
        const avgSessionDuration = avgDuration > 0 
          ? `${Math.floor(avgDuration / 60)}m ${Math.floor(avgDuration % 60)}s`
          : 'N/A';

        // Calculate bounce rate
        const sessionPages: { [key: string]: number } = {};
        analyticsEvents.forEach(e => {
          if (e.session_id) {
            sessionPages[e.session_id] = (sessionPages[e.session_id] || 0) + 1;
          }
        });
        const totalSessions = Object.keys(sessionPages).length;
        const bouncedSessions = Object.values(sessionPages).filter(count => count === 1).length;
        const bounceRate = totalSessions > 0 
          ? `${Math.round((bouncedSessions / totalSessions) * 100)}%`
          : 'N/A';

        // Calculate active users (visitors in last 5 minutes)
        const fiveMinutesAgo = new Date();
        fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
        const activeUsersNow = new Set(
          analyticsEvents
            .filter(e => new Date(e.created_at) > fiveMinutesAgo)
            .map(e => e.visitor_id)
        ).size;

        setAnalyticsData({
          pageViews,
          uniqueVisitors,
          activeUsersNow,
          avgSessionDuration,
          bounceRate,
          topPages,
          trafficSources,
          topCountries
        });
      }
      
      await loadCategoryTrends();
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  const loadAdminData = async () => {
    try {
      // Get all cases
      const { data: casesData } = await supabase.from('cases').select('*');
      
      // Get all users
      const { data: usersData } = await supabase.from('profiles').select('id');
      
      // Get pending investigator applications via RPC
      const { data: applicationsRpcData, error: appsError } = await supabase
        .rpc('get_pending_investigator_applications');
      
      if (appsError) {
        console.error('Error loading applications:', appsError);
      } else if (applicationsRpcData?.success && applicationsRpcData.applications) {
        setInvestigatorApplications(applicationsRpcData.applications);
      }

      // Get all active investigators
      const { data: investigatorsRpcData, error: invError } = await supabase
        .rpc('get_all_investigators');
      
      if (invError) {
        console.error('Error loading investigators:', invError);
      } else if (investigatorsRpcData?.success && investigatorsRpcData.investigators) {
        setActiveInvestigators(investigatorsRpcData.investigators);
      }

      // Get pending background checks
      const { data: checksData, error: checksError } = await supabase
        .from('background_checks')
        .select('*, investigator:profiles!investigator_id(username, full_name, avatar_url)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (checksError) {
        console.error('Error loading background checks:', checksError);
      } else {
        setBackgroundChecks(checksData || []);
      }

      // Get Pro subscribers count
      const { count: proCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_pro_member', true);
      
      // Get disputed cases count
      const { count: disputedCount } = await supabase
        .from('cases')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'DISPUTED');

      // Get recent transactions
      const { data: transactionsData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      console.log('Transactions query result:', { transactionsData, txError });

      if (txError) {
        console.error('Error loading transactions:', txError);
      }

      // Get wallet user mappings
      let enrichedTransactions = transactionsData || [];
      if (transactionsData && transactionsData.length > 0) {
        const walletIds = new Set<string>();
        transactionsData.forEach(tx => {
          if (tx.from_wallet_id) walletIds.add(tx.from_wallet_id);
          if (tx.to_wallet_id) walletIds.add(tx.to_wallet_id);
        });

        if (walletIds.size > 0) {
          const { data: walletsData } = await supabase
            .from('wallets')
            .select('id, user_id, user:profiles(username, avatar_url)')
            .in('id', Array.from(walletIds));

          const walletMap = new Map(walletsData?.map(w => [w.id, w]) || []);
          
          enrichedTransactions = transactionsData.map(tx => ({
            ...tx,
            from_wallet: tx.from_wallet_id ? walletMap.get(tx.from_wallet_id) : null,
            to_wallet: tx.to_wallet_id ? walletMap.get(tx.to_wallet_id) : null
          }));
        }
      }

      if (enrichedTransactions.length > 0) {
        setTransactions(enrichedTransactions);
        setFilteredTransactions(enrichedTransactions);
      }

      // Calculate total transaction volume
      const { data: volumeData } = await supabase
        .from('transactions')
        .select('amount')
        .eq('status', 'completed');
      
      const totalVolume = volumeData?.reduce((sum, tx) => sum + (tx.amount || 0), 0) || 0;

      // Calculate ALL money that entered Stripe (not just wallet deposits)
      // 1. Wallet deposits
      const { data: walletDepositsData } = await supabase
        .from('transactions')
        .select('amount')
        .eq('transaction_type', 'deposit')
        .eq('status', 'completed');
      
      const walletDeposits = walletDepositsData?.reduce((sum, tx) => sum + (tx.amount || 0), 0) || 0;
      
      // 2. ALL revenue (boosts, fees, etc) from platform_revenue table
      const { data: allRevenueData } = await supabase
        .from('platform_revenue')
        .select('amount');
      
      const directRevenue = allRevenueData?.reduce((sum, r) => sum + (r.amount || 0), 0) || 0;
      
      // 3. Withdrawals (money that left Stripe)
      const { data: withdrawalsData } = await supabase
        .from('transactions')
        .select('amount')
        .eq('transaction_type', 'withdrawal')
        .eq('status', 'completed');
      
      const totalWithdrawals = withdrawalsData?.reduce((sum, tx) => sum + (tx.amount || 0), 0) || 0;
      
      // Physical money in Stripe account
      // = Wallet deposits + Direct revenue (boosts, fees) - Withdrawals
      const stripeAccountBalance = walletDeposits + directRevenue - totalWithdrawals;

      // Calculate User Liabilities (what we owe to users in their wallets)
      const { data: walletsData } = await supabase
        .from('wallets')
        .select('balance, user_id')
        .not('user_id', 'is', null); // Only user wallets
      
      const totalUserLiabilities = walletsData?.reduce((sum, w) => sum + (w.balance || 0), 0) || 0;

      // Platform Revenue = Money earned that we can use
      // When user spends from wallet (donations, boosts), that becomes our revenue
      // Formula: What entered Stripe - What we owe users - What left Stripe
      const platformRevenue = stripeAccountBalance - totalUserLiabilities;

      if (casesData) {
        setCases(casesData);
        
        // Calculate category distribution from actual data
        const categoryCount: { [key: string]: number } = {};
        casesData.forEach(c => {
          const category = c.category || 'Other';
          categoryCount[category] = (categoryCount[category] || 0) + 1;
        });
        
        const distribution = Object.entries(categoryCount).map(([name, value]) => ({
          name,
          value
        }));
        
        setCategoryDistribution(distribution);
      }
      
      setStats({
        totalCases: casesData?.length || 0,
        activeUsers: usersData?.length || 0,
        pendingInvestigators: applicationsRpcData?.applications?.length || 0,
        pendingVerifications: checksData?.length || 0,
        disputedCases: disputedCount || 0,
        totalVolume,
        platformRevenue, // Available for development = Stripe - Liabilities
        totalUserDeposits: totalUserLiabilities, // Rename for clarity: User Liabilities
        stripeBalance: stripeAccountBalance, // Add new stat
        proSubscribers: proCount || 0
      });

      // Load analytics data
      await loadAnalytics();
      
      // Load SEO rankings
      await loadSeoRankings();
      
      // Load articles
      await loadArticles();
      
      // Load analytics data
      await loadAnalytics();
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategoryTrends = async () => {
    try {
      // Get case counts by category for last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const { data: cases } = await supabase
        .from('cases')
        .select('category, created_at')
        .gte('created_at', sixMonthsAgo.toISOString())
        .order('created_at', { ascending: true });
      
      if (cases) {
        // Group by month and category
        const monthlyData: Record<string, Record<string, number>> = {};
        
        cases.forEach((c: any) => {
          const date = new Date(c.created_at);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          
          if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {};
          }
          
          const category = c.category || 'Unknown';
          monthlyData[monthKey][category] = (monthlyData[monthKey][category] || 0) + 1;
        });
        
        // Convert to chart format
        const trends = Object.entries(monthlyData)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([month, categories]) => {
            // Format month for display
            const [year, monthNum] = month.split('-');
            const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString('en', { month: 'short', year: 'numeric' });
            
            return {
              month: monthName,
              UFO: categories['UFO'] || 0,
              Cryptid: categories['Cryptid'] || 0,
              Paranormal: categories['Paranormal'] || 0,
              Supernatural: categories['Supernatural'] || 0,
              'Mystery Location': categories['Mystery Location'] || 0,
              Other: categories['Other'] || 0
            };
          });
        
        setCategoryTrends(trends);
      }
    } catch (error) {
      console.error('Failed to load category trends:', error);
    }
  };

  const loadSeoRankings = async () => {
    try {
      const { data } = await (supabase as any)
        .from('seo_rankings')
        .select('*')
        .order('date', { ascending: false })
        .limit(100);
      
      if (data) {
        setSeoRankings(data);
      }
    } catch (error) {
      console.error('Failed to load SEO rankings:', error);
    }
  };

  const loadArticles = async () => {
    try {
      const { data } = await supabase
        .from('blog_articles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (data) {
        setArticles(data);
      }
    } catch (error) {
      console.error('Failed to load articles:', error);
    }
  };

  const loadForumPosts = async () => {
    try {
      setLoadingPosts(true);
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Forum posts load timeout')), 10000)
      );
      
      // Query only basic fields that definitely exist
      const dataPromise = supabase
        .from('forum_threads')
        .select(`
          id,
          title,
          created_at,
          category,
          user_id,
          profiles:user_id (
            id,
            username,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      
      const { data, error } = await Promise.race([dataPromise, timeoutPromise]) as any;
      
      if (error) {
        console.error('Forum posts query error:', error);
        throw error;
      }
      
      setForumPosts(data || []);
    } catch (error) {
      console.error('Failed to load forum posts:', error);
      // Set empty array on error so UI doesn't hang
      setForumPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  };

  const moderatePost = async (postId: string, action: 'approve' | 'reject' | 'flag') => {
    try {
      if (action === 'reject') {
        const confirmed = confirm('Are you sure you want to delete this post? This action cannot be undone.');
        if (!confirmed) return;
        
        const { error } = await supabase
          .from('forum_threads')
          .delete()
          .eq('id', postId);
        
        if (error) throw error;
        alert('Post deleted successfully');
      } else if (action === 'flag') {
        // You could add a flagged column to track flagged posts
        alert('Post flagged for review');
      } else {
        // Approve just means doing nothing - post stays visible
        alert('Post approved');
      }
      
      await loadForumPosts();
    } catch (error) {
      console.error('Failed to moderate post:', error);
      alert('Failed to moderate post');
    }
  };

  const publishArticle = async () => {
    if (!newArticle.title || !newArticle.content) {
      alert('Please fill in title and content');
      return;
    }

    setPublishingArticle(true);
    try {
      const { error } = await supabase
        .from('blog_articles')
        .insert({
          title: newArticle.title,
          content: newArticle.content,
          seo_keywords: newArticle.seo_keywords,
          slug: newArticle.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          published: true
        });

      if (error) throw error;

      setNewArticle({ title: '', content: '', seo_keywords: '' });
      await loadArticles();
      alert('Article published successfully!');
    } catch (error) {
      console.error('Failed to publish article:', error);
      alert('Failed to publish article');
    } finally {
      setPublishingArticle(false);
    }
  };

  const addSeoRanking = async () => {
    if (!newSeoRanking.keyword || !newSeoRanking.page_url) {
      alert('Please fill in keyword and page URL');
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from('seo_rankings')
        .insert({
          keyword: newSeoRanking.keyword,
          page_url: newSeoRanking.page_url,
          search_engine: newSeoRanking.search_engine,
          ranking_position: newSeoRanking.ranking_position,
          country: newSeoRanking.country,
          date: new Date().toISOString().split('T')[0]
        });

      if (error) throw error;

      setNewSeoRanking({ keyword: '', page_url: '', search_engine: 'google', ranking_position: 1, country: 'US' });
      await loadSeoRankings();
      alert('SEO ranking added successfully!');
    } catch (error) {
      console.error('Failed to add SEO ranking:', error);
      alert('Failed to add SEO ranking');
    }
  };

  const updateSeoRanking = async (id: string, updates: any) => {
    try {
      const { error } = await (supabase as any)
        .from('seo_rankings')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      await loadSeoRankings();
      setEditingSeoId(null);
      alert('SEO ranking updated!');
    } catch (error) {
      console.error('Failed to update SEO ranking:', error);
      alert('Failed to update SEO ranking');
    }
  };

  const deleteSeoRanking = async (id: string) => {
    if (!confirm('Delete this SEO ranking entry?')) return;

    try {
      const { error } = await (supabase as any)
        .from('seo_rankings')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await loadSeoRankings();
      alert('SEO ranking deleted!');
    } catch (error) {
      console.error('Failed to delete SEO ranking:', error);
      alert('Failed to delete SEO ranking');
    }
  };

  const updateArticle = async (id: string) => {
    if (!editingArticle?.title || !editingArticle?.content) {
      alert('Please fill in title and content');
      return;
    }

    try {
      const { error } = await supabase
        .from('blog_articles')
        .update({
          title: editingArticle.title,
          content: editingArticle.content,
          seo_keywords: editingArticle.seo_keywords,
          slug: editingArticle.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      setEditingArticleId(null);
      setEditingArticle(null);
      await loadArticles();
      alert('Article updated successfully!');
    } catch (error) {
      console.error('Failed to update article:', error);
      alert('Failed to update article');
    }
  };

  const deleteArticle = async (id: string, title: string) => {
    if (!confirm(`Delete article "${title}"?`)) return;

    try {
      const { error } = await supabase
        .from('blog_articles')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await loadArticles();
      alert('Article deleted successfully!');
    } catch (error) {
      console.error('Failed to delete article:', error);
      alert('Failed to delete article');
    }
  };

  const disputedCases = cases.filter(c => c.status === 'DISPUTED');

  // Handle dispute resolution
  const handleResolveDispute = async (caseId: string, action: 'RELEASE' | 'REJECT' | 'VOTE') => {
    try {
      const caseData = cases.find(c => c.id === caseId);
      if (!caseData) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('You must be logged in as admin');
        return;
      }

      if (action === 'RELEASE') {
        // Admin approves investigator - release funds
        const { data, error } = await supabase.rpc('admin_resolve_dispute', {
          p_case_id: caseId,
          p_admin_id: user.id,
          p_resolution: 'Admin approved investigator work - funds released',
          p_approve_investigator: true
        });

        if (error) throw error;
        alert('✅ Dispute resolved! Funds released to investigator.');
        await loadAdminData(); // Reload data
        
      } else if (action === 'REJECT') {
        // Admin rejects investigator - refund submitter
        const { data, error } = await supabase.rpc('admin_resolve_dispute', {
          p_case_id: caseId,
          p_admin_id: user.id,
          p_resolution: 'Admin rejected investigator work - case reopened for new investigation',
          p_approve_investigator: false
        });

        if (error) throw error;
        alert('✅ Dispute resolved! Case reopened for new investigation.');
        await loadAdminData();
        
      } else if (action === 'VOTE') {
        // Send to community voting (implement later)
        alert('Community voting feature coming soon!');
      }
    } catch (error: any) {
      console.error('Error resolving dispute:', error);
      alert('Failed to resolve dispute: ' + error.message);
    }
  };

  const filterUsers = () => {
    if (!userSearchTerm.trim()) {
      setFilteredUsers(users);
      return;
    }

    const searchLower = userSearchTerm.toLowerCase();
    const filtered = users.filter(user => 
      (user.username?.toLowerCase().includes(searchLower)) ||
      (user.full_name?.toLowerCase().includes(searchLower)) ||
      (user.id?.toLowerCase().includes(searchLower))
    );
    setFilteredUsers(filtered);
  };

  useEffect(() => {
    filterUsers();
  }, [userSearchTerm, users]);

  const handleAwardCredits = async () => {
    if (!selectedUserForCredits || !creditAmount || !creditReason.trim()) {
      alert('Please fill in all fields');
      return;
    }

    const amount = parseInt(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid positive amount');
      return;
    }

    if (!confirm(`Award ${amount} credits to ${selectedUserForCredits.username}?\n\nReason: ${creditReason}`)) {
      return;
    }

    setAwardingCredits(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const adminId = userData.user?.id;

      if (!adminId) {
        throw new Error('Admin ID not found');
      }

      const { data, error } = await supabase.rpc('admin_grant_credits', {
        p_admin_id: adminId,
        p_user_id: selectedUserForCredits.id,
        p_amount: amount,
        p_reason: creditReason
      });

      if (error) throw error;
      
      if (data && !data.success) {
        throw new Error(data.error || 'Failed to award credits');
      }

      alert(`✅ Successfully awarded ${amount} credits to ${selectedUserForCredits.username}!`);
      
      // Reset form
      setSelectedUserForCredits(null);
      setCreditAmount('');
      setCreditReason('');
      
      // Reload users to show updated credit balance
      await loadUsers();
    } catch (error: any) {
      console.error('Error awarding credits:', error);
      alert('Failed to award credits: ' + (error.message || 'Unknown error'));
    } finally {
      setAwardingCredits(false);
    }
  };

  const filterTransactions = () => {
    let filtered = [...transactions];
    
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter(tx => new Date(tx.created_at) >= fromDate);
    }
    
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999); // Include entire end date
      filtered = filtered.filter(tx => new Date(tx.created_at) <= toDate);
    }
    
    setFilteredTransactions(filtered);
  };

  const exportToPDF = async () => {
    setExporting(true);
    try {
      // Create PDF content
      const content = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Transaction Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; border-bottom: 2px solid #6366f1; padding-bottom: 10px; }
            .header { margin-bottom: 20px; }
            .info { color: #666; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th { background-color: #6366f1; color: white; padding: 12px; text-align: left; }
            td { padding: 10px; border-bottom: 1px solid #ddd; }
            tr:hover { background-color: #f5f5f5; }
            .amount-positive { color: #10b981; font-weight: bold; }
            .amount-negative { color: #ef4444; font-weight: bold; }
            .status-completed { color: #10b981; }
            .status-pending { color: #f59e0b; }
            .status-failed { color: #ef4444; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Unexplained Archive - Transaction Report</h1>
            <p class="info">Generated: ${new Date().toLocaleString()}</p>
            <p class="info">Period: ${dateFrom || 'All time'} ${dateTo ? `to ${dateTo}` : ''}</p>
            <p class="info">Total Transactions: ${filteredTransactions.length}</p>
            <p class="info">Total Volume: €${filteredTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0).toFixed(2)}</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Transaction ID</th>
                <th>From</th>
                <th>To</th>
                <th>Type</th>
                <th>Amount (€)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTransactions.map(tx => `
                <tr>
                  <td>${new Date(tx.created_at).toLocaleString()}</td>
                  <td style="font-size: 10px; color: #666;">${tx.id}</td>
                  <td>${tx.from_wallet?.user?.username || 'System'}</td>
                  <td>${tx.to_wallet?.user?.username || 'System'}</td>
                  <td>${tx.transaction_type.replace('_', ' ')}</td>
                  <td class="${['deposit', 'reward'].includes(tx.transaction_type) ? 'amount-positive' : 'amount-negative'}">
                    ${['deposit', 'reward'].includes(tx.transaction_type) ? '+' : '-'}${tx.amount.toFixed(2)}
                  </td>
                  <td class="status-${tx.status}">${tx.status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          
          <div class="footer">
            <p>This is an official transaction report generated from Unexplained Archive platform.</p>
            <p>For verification purposes, please contact: admin@unexplainedarchive.com</p>
          </div>
        </body>
        </html>
      `;

      // Create blob and download
      const blob = new Blob([content], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions_${dateFrom || 'all'}_to_${dateTo || 'now'}_${Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Note: For actual PDF, user needs to use browser's "Print to PDF" feature
      alert('Transaction report downloaded! Open the file and use your browser\'s "Print to PDF" feature to convert it to PDF format.');
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export report. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // Animated Metric Component for live counting
  const AnimatedMetric: React.FC<{ value: number; suffix?: string }> = ({ value, suffix = '' }) => {
    const animatedValue = useAnimatedCounter(value, 1500);
    return <span>{animatedValue.toLocaleString()}{suffix}</span>;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-white mb-8">System Administration</h1>

      {/* Tab Navigation */}
      {/* Desktop Navigation */}
      <div className="hidden md:flex gap-2 mb-8 border-b border-mystery-700">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'overview'
              ? 'text-mystery-400 border-b-2 border-mystery-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Overview
          </div>
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'analytics'
              ? 'text-mystery-400 border-b-2 border-mystery-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Analytics & SEO
          </div>
        </button>
        <button
          onClick={() => setActiveTab('content')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'content'
              ? 'text-mystery-400 border-b-2 border-mystery-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Newspaper className="w-5 h-5" />
            Content Management
          </div>
        </button>
        <button
          onClick={() => setActiveTab('investigators')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'investigators'
              ? 'text-mystery-400 border-b-2 border-mystery-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Applications
            {investigatorApplications.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                {investigatorApplications.length}
              </span>
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('verifications')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'verifications'
              ? 'text-mystery-400 border-b-2 border-mystery-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Verifications
            {backgroundChecks.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-black text-xs font-bold rounded-full">
                {backgroundChecks.length}
              </span>
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'subscriptions'
              ? 'text-mystery-400 border-b-2 border-mystery-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Subscriptions & Groups
          </div>
        </button>
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'campaigns'
              ? 'text-mystery-400 border-b-2 border-mystery-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
            Campaigns
          </div>
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'users'
              ? 'text-mystery-400 border-b-2 border-mystery-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Users Management
          </div>
        </button>
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-6 py-3 font-medium transition-colors ${
            activeTab === 'payments'
              ? 'text-mystery-400 border-b-2 border-mystery-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Payment Monitoring
          </div>
        </button>
      </div>

      {/* Mobile Navigation */}
      <div className="sm:hidden mb-8">
        <div className="relative">
          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="w-full bg-mystery-800 border border-mystery-700 rounded-lg px-4 py-3 flex items-center justify-between text-white"
          >
            <div className="flex items-center gap-2">
              {activeTab === 'overview' && (
                <><Shield className="w-5 h-5" />Overview</>
              )}
              {activeTab === 'analytics' && (
                <><BarChart3 className="w-5 h-5" />Analytics & SEO</>
              )}
              {activeTab === 'content' && (
                <><Newspaper className="w-5 h-5" />Content Management</>
              )}
              {activeTab === 'investigators' && (
                <><Shield className="w-5 h-5" />Applications
                {investigatorApplications.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                    {investigatorApplications.length}
                  </span>
                )}</>
              )}
              {activeTab === 'verifications' && (
                <><Shield className="w-5 h-5" />Verifications
                {backgroundChecks.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-black text-xs font-bold rounded-full">
                    {backgroundChecks.length}
                  </span>
                )}</>
              )}
              {activeTab === 'subscriptions' && (
                <><Users className="w-5 h-5" />Subscriptions & Groups</>
              )}
              {activeTab === 'campaigns' && (
                <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>Campaigns</>
              )}
              {activeTab === 'users' && (
                <><Users className="w-5 h-5" />Users Management</>
              )}
              {activeTab === 'payments' && (
                <><CreditCard className="w-5 h-5" />Payment Monitoring</>
              )}
            </div>
            <ChevronDown className={`w-5 h-5 transition-transform ${
              showMobileMenu ? 'rotate-180' : ''
            }`} />
          </button>

          {showMobileMenu && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-mystery-800 border border-mystery-700 rounded-lg shadow-xl z-50">
              <button
                onClick={() => { setActiveTab('overview'); setShowMobileMenu(false); }}
                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-mystery-700 transition-colors ${
                  activeTab === 'overview' ? 'text-mystery-400 bg-mystery-700/50' : 'text-white'
                }`}
              >
                <Shield className="w-5 h-5" />
                Overview
              </button>
              <button
                onClick={() => { setActiveTab('analytics'); setShowMobileMenu(false); }}
                className={`w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-mystery-700 transition-colors ${
                  activeTab === 'analytics' ? 'text-mystery-400 bg-mystery-700/50' : 'text-white'
                }`}
              >
                <BarChart3 className="w-5 h-5" />
                Analytics & SEO
              </button>
              <button
                onClick={() => { setActiveTab('content'); setShowMobileMenu(false); }}
                className={`w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-mystery-700 transition-colors ${
                  activeTab === 'content' ? 'text-mystery-400 bg-mystery-700/50' : 'text-white'
                }`}
              >
                <Newspaper className="w-5 h-5" />
                Content Management
              </button>
              <button
                onClick={() => { setActiveTab('investigators'); setShowMobileMenu(false); }}
                className={`w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-mystery-700 transition-colors ${
                  activeTab === 'investigators' ? 'text-mystery-400 bg-mystery-700/50' : 'text-white'
                }`}
              >
                <Shield className="w-5 h-5" />
                Applications
                {investigatorApplications.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                    {investigatorApplications.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => { setActiveTab('verifications'); setShowMobileMenu(false); }}
                className={`w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-mystery-700 transition-colors ${
                  activeTab === 'verifications' ? 'text-mystery-400 bg-mystery-700/50' : 'text-white'
                }`}
              >
                <Shield className="w-5 h-5" />
                Verifications
                {backgroundChecks.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-black text-xs font-bold rounded-full">
                    {backgroundChecks.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => { setActiveTab('subscriptions'); setShowMobileMenu(false); }}
                className={`w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-mystery-700 transition-colors ${
                  activeTab === 'subscriptions' ? 'text-mystery-400 bg-mystery-700/50' : 'text-white'
                }`}
              >
                <Users className="w-5 h-5" />
                Subscriptions & Groups
              </button>
              <button
                onClick={() => { setActiveTab('campaigns'); setShowMobileMenu(false); }}
                className={`w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-mystery-700 transition-colors ${
                  activeTab === 'campaigns' ? 'text-mystery-400 bg-mystery-700/50' : 'text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
                Campaigns
              </button>
              <button
                onClick={() => { setActiveTab('users'); setShowMobileMenu(false); }}
                className={`w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-mystery-700 transition-colors ${
                  activeTab === 'users' ? 'text-mystery-400 bg-mystery-700/50' : 'text-white'
                }`}
              >
                <Users className="w-5 h-5" />
                Users Management
              </button>
              <button
                onClick={() => { setActiveTab('payments'); setShowMobileMenu(false); }}
                className={`w-full px-4 py-3 text-left flex items-center gap-2 hover:bg-mystery-700 transition-colors rounded-b-lg ${
                  activeTab === 'payments' ? 'text-mystery-400 bg-mystery-700/50' : 'text-white'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                Payment Monitoring
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-mystery-400"></div>
        </div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-mystery-800 p-6 rounded-xl border border-mystery-700 flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Database className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Cases</p>
                <p className="text-2xl font-bold text-white">{stats.totalCases}</p>
              </div>
            </div>
            
            <div className="bg-mystery-800 p-6 rounded-xl border border-mystery-700 flex items-center gap-4">
              <div className="p-3 bg-red-500/10 rounded-lg">
                <AlertCircle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Disputed Cases</p>
                <p className="text-2xl font-bold text-white">{stats.disputedCases}</p>
              </div>
            </div>

            <div className="bg-mystery-800 p-6 rounded-xl border border-mystery-700 flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <Users className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Pending Applications</p>
                <p className="text-2xl font-bold text-white">{investigatorApplications.length}</p>
              </div>
            </div>

            <div className="bg-mystery-800 p-6 rounded-xl border border-mystery-700 flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <Users className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Active Users</p>
                <p className="text-2xl font-bold text-white">{stats.activeUsers}</p>
              </div>
            </div>

            <div className="bg-mystery-800 p-6 rounded-xl border border-mystery-700 flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <DollarSign className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Stripe Account Balance</p>
                <p className="text-2xl font-bold text-blue-400">€{stats.stripeBalance.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1">Deposits - Withdrawals</p>
              </div>
            </div>

            <div className="bg-mystery-800 p-6 rounded-xl border border-mystery-700 flex items-center gap-4">
              <div className="p-3 bg-orange-500/10 rounded-lg">
                <Database className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-gray-400">User Liabilities</p>
                <p className="text-2xl font-bold text-orange-400">€{stats.totalUserDeposits.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1">Wallet balances owed</p>
              </div>
            </div>

            <div className="bg-mystery-800 p-6 rounded-xl border border-mystery-700 flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <Shield className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Platform Revenue</p>
                <p className="text-2xl font-bold text-green-400">€{stats.platformRevenue.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1">Available for development</p>
              </div>
            </div>

            <div className="bg-mystery-800 p-6 rounded-xl border border-mystery-700 flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <Users className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Pro Subscribers</p>
                <p className="text-2xl font-bold text-white">{stats.proSubscribers}</p>
              </div>
            </div>
          </div>

      {/* MASS NOTIFICATION PANEL */}
      <div className="mb-8">
        <MassNotificationPanel />
      </div>

      {/* DISPUTE MANAGEMENT SECTION */}
      <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6 mb-8">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Scale className="text-red-400" /> Active Disputes & Escrow Management
          </h3>
          {disputedCases.length === 0 ? (
              <p className="text-gray-400">No active disputes requiring admin attention.</p>
          ) : (
              <div className="space-y-4">
                  {disputedCases.map(c => (
                      <div key={c.id} className="bg-mystery-900 border border-mystery-700 rounded-lg p-6">
                          <div className="flex justify-between items-start mb-4">
                              <div>
                                  <h4 className="font-bold text-white text-lg">{c.title}</h4>
                                  <p className="text-sm text-gray-400">Submitter: {c.submittedBy.name} | Investigator: {c.assignedInvestigator?.name}</p>
                                  <div className="flex gap-4 mt-2 text-sm">
                                      <span className="text-green-400 font-bold">Escrow Amount: ${c.reward}</span>
                                      <span className="text-red-400 font-bold">Status: DISPUTED</span>
                                  </div>
                              </div>
                              <button className="text-blue-400 hover:text-white text-sm flex items-center gap-1">
                                  <FileText className="w-4 h-4" /> View Full Case
                              </button>
                          </div>
                          
                          <div className="bg-mystery-800 p-4 rounded mb-4">
                              <p className="text-xs font-bold text-gray-500 uppercase">Investigator Resolution:</p>
                              <p className="text-gray-300 mb-3">{c.resolutionProposal}</p>
                              <p className="text-xs font-bold text-gray-500 uppercase">User Rejection Note:</p>
                              <p className="text-red-300 italic">"Resolution insufficient or evidence lacking." (Standard Rejection)</p>
                          </div>

                          <div className="flex gap-3 pt-2 border-t border-mystery-700">
                              <button 
                                onClick={() => handleResolveDispute(c.id, 'RELEASE')}
                                className="px-4 py-2 bg-green-700 hover:bg-green-600 text-white rounded font-medium text-sm flex items-center gap-2"
                              >
                                  <Gavel className="w-4 h-4" /> Approve Investigator
                              </button>
                              <button 
                                onClick={() => handleResolveDispute(c.id, 'REJECT')}
                                className="px-4 py-2 bg-red-800 hover:bg-red-700 text-white rounded font-medium text-sm flex items-center gap-2"
                              >
                                  <AlertCircle className="w-4 h-4" /> Approve Submitter
                              </button>
                              <button 
                                onClick={() => handleResolveDispute(c.id, 'VOTE')}
                                className="ml-auto px-4 py-2 bg-mystery-600 hover:bg-mystery-500 text-white rounded font-medium text-sm flex items-center gap-2"
                              >
                                  <Users className="w-4 h-4" /> Community Vote
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          )}
      </div>

      {/* Transaction Monitoring */}
      <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ArrowRightLeft className="w-6 h-6 text-mystery-400" />
            <h3 className="font-bold text-white">Transaction Monitoring</h3>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Total Volume</p>
            <p className="text-2xl font-bold text-white">€{stats.totalVolume.toFixed(2)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-mystery-900/50 rounded-lg border border-mystery-700 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 bg-mystery-800 border border-mystery-600 rounded-lg text-white focus:outline-none focus:border-mystery-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                To Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 bg-mystery-800 border border-mystery-600 rounded-lg text-white focus:outline-none focus:border-mystery-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={filterTransactions}
                className="flex-1 px-4 py-2 bg-mystery-600 hover:bg-mystery-500 text-white rounded-lg font-medium transition-colors"
              >
                Filter
              </button>
              <button
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                  setFilteredTransactions(transactions);
                }}
                className="px-4 py-2 bg-mystery-700 hover:bg-mystery-600 text-white rounded-lg font-medium transition-colors"
              >
                Reset
              </button>
              <button
                onClick={exportToPDF}
                disabled={exporting || filteredTransactions.length === 0}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                {exporting ? 'Exporting...' : 'Export PDF'}
              </button>
            </div>
          </div>
          {filteredTransactions.length > 0 && (
            <div className="mt-3 text-sm text-gray-400">
              Showing {filteredTransactions.length} transaction(s) 
              {dateFrom || dateTo ? ` (filtered)` : ''}
              {' • '}
              Volume: €{filteredTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0).toFixed(2)}
            </div>
          )}
        </div>

        {transactions.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No transactions yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-mystery-700">
                  <th className="pb-3 text-sm font-medium text-gray-400">Date</th>
                  <th className="pb-3 text-sm font-medium text-gray-400">From</th>
                  <th className="pb-3 text-sm font-medium text-gray-400">To</th>
                  <th className="pb-3 text-sm font-medium text-gray-400">Type</th>
                  <th className="pb-3 text-sm font-medium text-gray-400 text-right">Amount</th>
                  <th className="pb-3 text-sm font-medium text-gray-400 text-center">Status</th>
                  <th className="pb-3 text-sm font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mystery-700">
                {filteredTransactions.slice(0, 20).map((tx) => (
                  <tr key={tx.id} className="hover:bg-mystery-700/30">
                    <td className="py-3 text-sm text-gray-300">
                      {new Date(tx.created_at).toLocaleDateString()}
                      <br />
                      <span className="text-xs text-gray-500">
                        {new Date(tx.created_at).toLocaleTimeString()}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {tx.from_wallet?.user?.avatar_url ? (
                          <img src={tx.from_wallet.user.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                        ) : (
                          <div className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center">
                            <Users className="w-3 h-3 text-gray-400" />
                          </div>
                        )}
                        <span className="text-sm text-white">
                          {tx.from_wallet?.user?.username || 'System'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {tx.to_wallet?.user?.avatar_url ? (
                          <img src={tx.to_wallet.user.avatar_url} alt="" className="w-6 h-6 rounded-full" />
                        ) : (
                          <div className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center">
                            <Users className="w-3 h-3 text-gray-400" />
                          </div>
                        )}
                        <span className="text-sm text-white">
                          {tx.to_wallet?.user?.username || 'System'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-col gap-1">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-mystery-700 text-gray-300">
                          {tx.transaction_type === 'deposit' && <TrendingUp className="w-3 h-3 text-green-400" />}
                          {tx.transaction_type === 'withdrawal' && <TrendingDown className="w-3 h-3 text-red-400" />}
                          {tx.transaction_type.replace('_', ' ')}
                        </span>
                        {tx.transaction_type === 'donation' && (
                          <span className="text-xs text-gray-500">
                            → {tx.case_id ? 'Case' : tx.metadata?.target === 'platform' ? 'Platform' : 'Unknown'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      {(() => {
                        // Stripe Account Cash Flow perspective:
                        // + = Money ENTERS Stripe account (deposits)
                        // - = Money LEAVES Stripe account (withdrawals)
                        // Virtual wallet transactions (donations, etc) don't affect Stripe balance directly
                        
                        let sign = '';
                        let colorClass = 'text-gray-400';
                        
                        if (tx.transaction_type === 'deposit') {
                          // Money enters Stripe account (but is liability to user)
                          sign = '+';
                          colorClass = 'text-blue-400';
                        } else if (tx.transaction_type === 'withdrawal') {
                          // Money leaves Stripe account
                          sign = '-';
                          colorClass = 'text-red-400';
                        } else if (tx.transaction_type === 'donation' && !tx.from_wallet?.user) {
                          // Donation FROM platform wallet (rare, admin donation)
                          sign = '-';
                          colorClass = 'text-red-400';
                        } else if (tx.transaction_type === 'donation' && !tx.to_wallet?.user) {
                          // Donation TO platform = platform revenue
                          sign = '+';
                          colorClass = 'text-green-400';
                        }
                        
                        return (
                          <span className={`text-sm font-bold ${colorClass}`}>
                            {sign}€{tx.amount.toFixed(2)}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-3 text-center">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        tx.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                        tx.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        tx.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <button onClick={() => setSelectedTx(tx)} className="text-mystery-400 hover:text-mystery-300 text-xs">
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Verification Queue */}
        <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6">
          <h3 className="font-bold text-white mb-6">Investigator Verification Queue</h3>
          {pendingInvestigators.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No pending investigator applications</p>
          ) : (
            <div className="space-y-4">
              {pendingInvestigators.slice(0, 5).map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-4 bg-mystery-900 rounded-lg border border-mystery-700">
                  <div className="flex items-center gap-3">
                    {inv.user?.avatar_url ? (
                      <img src={inv.user.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                    ) : (
                      <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                    <div>
                      <p className="text-white font-medium">{inv.user?.username || 'Unknown'}</p>
                      <p className="text-xs text-gray-400">
                        Applied: {new Date(inv.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded transition-colors">
                      Approve
                    </button>
                    <button className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition-colors">
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Case Distribution Chart */}
        <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6">
          <h3 className="font-bold text-white mb-6">Phenomena Distribution</h3>
          {categoryDistribution.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No case data available</p>
          ) : (
            <>
              <div style={{ width: '100%', height: '256px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {categoryDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#1e293b', 
                        borderColor: '#334155', 
                        color: '#ffffff',
                        borderRadius: '8px',
                        padding: '8px 12px'
                      }}
                      itemStyle={{ color: '#ffffff' }}
                      labelStyle={{ color: '#ffffff', fontWeight: 'bold' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs text-gray-400">
                {categoryDistribution.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                    {d.name} ({d.value})
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
            </>
          )}

          {/* Analytics & SEO Tab */}
          {activeTab === 'analytics' && (
            <>
              {/* Loading State */}
              {isLoadingAnalytics && analyticsData.pageViews === 0 && (
                <div className="mb-6 bg-mystery-800 border border-mystery-700 rounded-xl p-8">
                  <div className="flex flex-col items-center justify-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-mystery-400"></div>
                    <p className="text-gray-400">Loading analytics data...</p>
                  </div>
                </div>
              )}
              
              {/* Data Collection Notice */}
              {!isLoadingAnalytics && analyticsData.pageViews === 0 && analyticsData.uniqueVisitors === 0 && (
                <div className="mb-6 bg-blue-900/30 border border-blue-700 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-blue-300 font-medium mb-1">📊 Data Collection in Progress</p>
                      <p className="text-blue-200/80 text-sm">
                        Google Analytics is now active and tracking visitors. Real data will appear here within 24-48 hours. 
                        The tracking code is working correctly on your site.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Analytics Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-mystery-800 p-6 rounded-xl border border-mystery-700 relative overflow-hidden">
                  <div className="flex items-center gap-3 mb-2">
                    <Eye className="w-5 h-5 text-blue-400" />
                    <p className="text-sm text-gray-400">Page Views</p>
                  </div>
                  <p className="text-3xl font-bold text-white">
                    <AnimatedMetric value={analyticsData.pageViews} />
                  </p>
                  {autoRefreshEnabled && (
                    <div className="absolute top-2 right-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    </div>
                  )}
                </div>

                <div className="bg-mystery-800 p-6 rounded-xl border border-mystery-700 relative overflow-hidden">
                  <div className="flex items-center gap-3 mb-2">
                    <Users className="w-5 h-5 text-green-400" />
                    <p className="text-sm text-gray-400">Unique Visitors</p>
                  </div>
                  <p className="text-3xl font-bold text-white">
                    <AnimatedMetric value={analyticsData.uniqueVisitors} />
                  </p>
                  {autoRefreshEnabled && (
                    <div className="absolute top-2 right-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    </div>
                  )}
                </div>

                <div className="bg-mystery-800 p-6 rounded-xl border border-mystery-700 relative overflow-hidden">
                  <div className="flex items-center gap-3 mb-2">
                    <Activity className="w-5 h-5 text-purple-400" />
                    <p className="text-sm text-gray-400">Active Now</p>
                  </div>
                  <p className="text-3xl font-bold text-white">
                    <AnimatedMetric value={analyticsData.activeUsersNow} />
                  </p>
                  {autoRefreshEnabled && (
                    <div className="absolute top-2 right-2">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                    </div>
                  )}
                  <p className="text-xs text-purple-300/60 mt-1">Real-time users</p>
                </div>

                <div className="bg-mystery-800 p-6 rounded-xl border border-mystery-700 relative overflow-hidden">
                  <div className="flex items-center gap-3 mb-2">
                    <MousePointer className="w-5 h-5 text-purple-400" />
                    <p className="text-sm text-gray-400">Avg. Session</p>
                  </div>
                  <p className="text-3xl font-bold text-white">{analyticsData.avgSessionDuration}</p>
                  {autoRefreshEnabled && (
                    <div className="absolute top-2 right-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    </div>
                  )}
                </div>

                <div className="bg-mystery-800 p-6 rounded-xl border border-mystery-700 relative overflow-hidden">
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingDown className="w-5 h-5 text-orange-400" />
                    <p className="text-sm text-gray-400">Bounce Rate</p>
                  </div>
                  <p className="text-3xl font-bold text-white">{analyticsData.bounceRate}</p>
                  {autoRefreshEnabled && (
                    <div className="absolute top-2 right-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                {/* Top Pages */}
                <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6">
                  <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-mystery-400" />
                    Top Pages
                  </h3>
                  <div className="space-y-3">
                    {analyticsData.topPages.map((page, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-mystery-900/50 rounded">
                        <span className="text-sm text-gray-300">{page.page}</span>
                        <span className="text-sm font-bold text-mystery-400">{page.views} views</span>
                      </div>
                    ))}
                    {analyticsData.topPages.length === 0 && (
                      <p className="text-gray-500 text-center py-4">No data available</p>
                    )}
                  </div>
                </div>

                {/* Traffic Sources */}
                <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6">
                  <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-mystery-400" />
                    Traffic Sources
                  </h3>
                  <div className="space-y-3">
                    {analyticsData.trafficSources.map((source, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-mystery-900/50 rounded">
                        <span className="text-sm text-gray-300">{source.source}</span>
                        <span className="text-sm font-bold text-mystery-400">{source.visits} visits</span>
                      </div>
                    ))}
                    {analyticsData.trafficSources.length === 0 && (
                      <p className="text-gray-500 text-center py-4">No data available</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Geographic Heatmap */}
              <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6 mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <Globe className="w-5 h-5 text-mystery-400" />
                    Geographic Distribution - World Map
                  </h3>
                  <button
                    onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      autoRefreshEnabled
                        ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                        : 'bg-mystery-700 text-gray-400 hover:bg-mystery-600'
                    }`}
                  >
                    {autoRefreshEnabled ? '● Auto-refresh ON' : '○ Auto-refresh OFF'}
                  </button>
                </div>
                
                {analyticsData.topCountries.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No geographic data available</p>
                ) : (
                  <WorldMapVisualization 
                    countryData={analyticsData.topCountries}
                    autoRefresh={autoRefreshEnabled}
                  />
                )}
              </div>

              {/* Case Category Trends Chart */}
              <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6 mb-8">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-mystery-400" />
                  Case Category Trends (Last 6 Months)
                </h3>
                
                {categoryTrends.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No trend data available</p>
                ) : (
                  <div>
                    <div className="bg-mystery-900/30 rounded-lg p-4 mb-4">
                      <p className="text-sm text-gray-300">
                        Track which mystery categories are gaining popularity over time. Use this data to optimize content strategy and resource allocation.
                      </p>
                    </div>
                    
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={categoryTrends}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis 
                          dataKey="month" 
                          stroke="#9ca3af"
                          style={{ fontSize: '12px' }}
                        />
                        <YAxis 
                          stroke="#9ca3af"
                          style={{ fontSize: '12px' }}
                          label={{ value: 'Cases Submitted', angle: -90, position: 'insideLeft', style: { fill: '#9ca3af' } }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1f2937', 
                            border: '1px solid #374151',
                            borderRadius: '8px',
                            color: '#fff'
                          }}
                        />
                        <Legend 
                          wrapperStyle={{ paddingTop: '20px' }}
                          iconType="line"
                        />
                        <Line 
                          type="monotone" 
                          dataKey="UFO" 
                          stroke="#6366f1" 
                          strokeWidth={2}
                          dot={{ fill: '#6366f1', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="Cryptid" 
                          stroke="#16a34a" 
                          strokeWidth={2}
                          dot={{ fill: '#16a34a', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="Paranormal" 
                          stroke="#9333ea" 
                          strokeWidth={2}
                          dot={{ fill: '#9333ea', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="Supernatural" 
                          stroke="#dc2626" 
                          strokeWidth={2}
                          dot={{ fill: '#dc2626', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="Mystery Location" 
                          stroke="#f59e0b" 
                          strokeWidth={2}
                          dot={{ fill: '#f59e0b', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    
                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
                      {categoryTrends.length > 0 && (() => {
                        const latest = categoryTrends[categoryTrends.length - 1];
                        const categories = ['UFO', 'Cryptid', 'Paranormal', 'Supernatural', 'Mystery Location'];
                        const colors = ['#6366f1', '#16a34a', '#9333ea', '#dc2626', '#f59e0b'];
                        
                        return categories.map((cat, idx) => (
                          <div key={cat} className="bg-mystery-900/50 rounded-lg p-3 text-center">
                            <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ backgroundColor: colors[idx] }}></div>
                            <p className="text-xs text-gray-400 mb-1">{cat}</p>
                            <p className="text-lg font-bold text-white">{latest[cat] || 0}</p>
                            <p className="text-xs text-gray-500">this month</p>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* SEO Rankings Management */}
              <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6 mb-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <Search className="w-5 h-5 text-mystery-400" />
                    SEO Rankings Management
                  </h3>
                  <button
                    onClick={async () => {
                      try {
                        const { data: searchData, error } = await supabase.functions.invoke('google-analytics', {
                          body: { action: 'fetch_search_console' }
                        });

                        if (error) {
                          console.error('Search Console API error:', error);
                          alert('❌ Search Console API error. Please enable Google Search Console API:\n\n1. Visit: https://console.developers.google.com/apis/api/searchconsole.googleapis.com/overview?project=516314287582\n2. Click "Enable API"\n3. Wait 2 minutes and try again');
                          return;
                        }
                        
                        if (!searchData?.success) {
                          console.error('Search Console returned error:', searchData?.error);
                          const errorMsg = searchData?.error || 'Unknown error';
                          
                          if (errorMsg.includes('SERVICE_DISABLED') || errorMsg.includes('not been used')) {
                            alert('❌ Search Console API not enabled!\n\n1. Visit: https://console.developers.google.com/apis/api/searchconsole.googleapis.com/overview?project=516314287582\n2. Click "Enable API"\n3. Wait 2 minutes and try again');
                          } else if (errorMsg.includes('not configured')) {
                            alert('⚠️ Search Console site not verified. Please:\n\n1. Visit https://search.google.com/search-console\n2. Add property: unexplainedarchive.com\n3. Verify ownership\n4. Try again in 24 hours');
                          } else {
                            alert(`❌ Search Console error:\n${errorMsg.substring(0, 200)}`);
                          }
                          return;
                        }

                        if (searchData?.success && searchData.data?.length > 0) {
                          // Auto-import Search Console data to SEO rankings table
                          for (const item of searchData.data.slice(0, 20)) { // Top 20
                            await supabase.from('seo_rankings').upsert({
                              keyword: item.keyword,
                              page_url: item.page_url,
                              search_engine: 'google',
                              ranking_position: item.position,
                              country: item.country,
                              date: item.date,
                              clicks: item.clicks,
                              impressions: item.impressions,
                              ctr: item.ctr,
                            }, {
                              onConflict: 'keyword,page_url,search_engine,country,date'
                            });
                          }
                          await loadSeoRankings();
                          alert(`✅ Imported ${searchData.data.length} rankings from Google Search Console!`);
                        } else {
                          alert('⚠️ No data available yet. Search Console needs 48-72h to collect data after site verification.');
                        }
                      } catch (error) {
                        console.error('Failed to import Search Console data:', error);
                        alert('❌ Failed to import. Check browser console for details.');
                      }
                    }}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
                  >
                    <Globe className="w-4 h-4" />
                    Import from Google Search Console
                  </button>
                </div>

                {/* Add New SEO Ranking */}
                <div className="bg-mystery-900/50 rounded-lg border border-mystery-700 p-4 mb-6">
                  <h4 className="text-sm font-bold text-gray-300 mb-4">Track New Keyword</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                    <input
                      type="text"
                      placeholder="Keyword (e.g., unexplained mysteries)"
                      value={newSeoRanking.keyword}
                      onChange={(e) => setNewSeoRanking({ ...newSeoRanking, keyword: e.target.value })}
                      className="px-3 py-2 bg-mystery-800 border border-mystery-600 rounded-lg text-white text-sm focus:outline-none focus:border-mystery-500"
                    />
                    <input
                      type="text"
                      placeholder="Page URL (e.g., /explore)"
                      value={newSeoRanking.page_url}
                      onChange={(e) => setNewSeoRanking({ ...newSeoRanking, page_url: e.target.value })}
                      className="px-3 py-2 bg-mystery-800 border border-mystery-600 rounded-lg text-white text-sm focus:outline-none focus:border-mystery-500"
                    />
                    <select
                      value={newSeoRanking.search_engine}
                      onChange={(e) => setNewSeoRanking({ ...newSeoRanking, search_engine: e.target.value })}
                      className="px-3 py-2 bg-mystery-800 border border-mystery-600 rounded-lg text-white text-sm focus:outline-none focus:border-mystery-500"
                    >
                      <option value="google">Google</option>
                      <option value="bing">Bing</option>
                      <option value="duckduckgo">DuckDuckGo</option>
                      <option value="yandex">Yandex</option>
                    </select>
                    <input
                      type="number"
                      placeholder="Position"
                      min="1"
                      max="100"
                      value={newSeoRanking.ranking_position}
                      onChange={(e) => setNewSeoRanking({ ...newSeoRanking, ranking_position: parseInt(e.target.value) || 1 })}
                      className="px-3 py-2 bg-mystery-800 border border-mystery-600 rounded-lg text-white text-sm focus:outline-none focus:border-mystery-500"
                    />
                    <button
                      onClick={addSeoRanking}
                      className="px-4 py-2 bg-mystery-500 hover:bg-mystery-400 text-white rounded-lg font-medium text-sm transition-colors"
                    >
                      + Add Ranking
                    </button>
                  </div>
                </div>

                {/* SEO Rankings Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-mystery-700">
                        <th className="pb-3 font-medium text-gray-400">Keyword</th>
                        <th className="pb-3 font-medium text-gray-400">Page</th>
                        <th className="pb-3 font-medium text-gray-400">Engine</th>
                        <th className="pb-3 font-medium text-gray-400">Position</th>
                        <th className="pb-3 font-medium text-gray-400">Country</th>
                        <th className="pb-3 font-medium text-gray-400">Last Updated</th>
                        <th className="pb-3 font-medium text-gray-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-mystery-700">
                      {seoRankings.map((ranking) => (
                        <tr key={ranking.id} className="hover:bg-mystery-700/30">
                          <td className="py-3 text-white font-medium">{ranking.keyword}</td>
                          <td className="py-3 text-gray-300 truncate max-w-xs">{ranking.page_url}</td>
                          <td className="py-3">
                            <span className="px-2 py-1 bg-mystery-700 text-gray-300 rounded text-xs capitalize">
                              {ranking.search_engine}
                            </span>
                          </td>
                          <td className="py-3">
                            {editingSeoId === ranking.id ? (
                              <input
                                type="number"
                                defaultValue={ranking.ranking_position}
                                min="1"
                                max="100"
                                className="w-16 px-2 py-1 bg-mystery-800 border border-mystery-600 rounded text-white text-sm"
                                onBlur={(e) => updateSeoRanking(ranking.id, { ranking_position: parseInt(e.target.value) })}
                              />
                            ) : (
                              <span className={`font-bold ${
                                ranking.ranking_position <= 3 ? 'text-green-400' :
                                ranking.ranking_position <= 10 ? 'text-blue-400' :
                                ranking.ranking_position <= 20 ? 'text-yellow-400' :
                                'text-gray-400'
                              }`}>
                                #{ranking.ranking_position}
                              </span>
                            )}
                          </td>
                          <td className="py-3 text-gray-300">{ranking.country}</td>
                          <td className="py-3 text-gray-400 text-xs">{new Date(ranking.date).toLocaleDateString()}</td>
                          <td className="py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => setEditingSeoId(editingSeoId === ranking.id ? null : ranking.id)}
                                className="text-blue-400 hover:text-blue-300 text-xs"
                              >
                                {editingSeoId === ranking.id ? 'Done' : 'Edit'}
                              </button>
                              <button
                                onClick={() => deleteSeoRanking(ranking.id)}
                                className="text-red-400 hover:text-red-300 text-xs"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {seoRankings.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-gray-500">
                            No SEO rankings tracked yet. Add keywords to monitor your search engine performance.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Content Management Tab */}
          {activeTab === 'content' && (
            <>
              {/* Forum Moderation Section */}
              <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6 mb-8">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-mystery-400" />
                  Forum Post Moderation ({forumPosts.length})
                </h3>
                <p className="text-gray-400 text-sm mb-6">
                  Review and moderate forum posts to maintain community standards
                </p>
                
                {loadingPosts ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mystery-400 mx-auto mb-2"></div>
                    <p className="text-gray-500">Loading forum posts...</p>
                  </div>
                ) : forumPosts.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500">No forum posts to moderate</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {forumPosts.map((post) => (
                      <div key={post.id} className="p-4 bg-mystery-900/50 rounded-lg border border-mystery-700">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h4 className="font-semibold text-white mb-2">{post.title}</h4>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {post.profiles?.username || 'Unknown User'}
                              </span>
                              <span className="px-2 py-0.5 bg-mystery-700 rounded">
                                {post.category || 'General'}
                              </span>
                              <span>
                                {new Date(post.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-3 border-t border-mystery-700">
                          <button
                            onClick={() => moderatePost(post.id, 'approve')}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-sm rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Approve
                          </button>
                          <button
                            onClick={() => moderatePost(post.id, 'reject')}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            <X className="w-4 h-4" />
                            Delete
                          </button>
                          <button
                            onClick={() => moderatePost(post.id, 'flag')}
                            className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white text-sm rounded-lg transition-colors flex items-center gap-1.5"
                          >
                            <AlertCircle className="w-4 h-4" />
                            Flag
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Article Management Info */}
              <div className="mb-6 bg-blue-900/30 border border-blue-700 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Newspaper className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-blue-300 font-medium mb-1">📝 Article Management</p>
                    <p className="text-blue-200/80 text-sm">
                      Create and manage blog articles that will appear on your landing page. Articles help with SEO and engage your audience.
                    </p>
                  </div>
                </div>
              </div>

              {/* New Article Form */}
              <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6 mb-8">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <Newspaper className="w-5 h-5 text-mystery-400" />
                  Create New Article
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Article Title
                    </label>
                    <input
                      type="text"
                      value={newArticle.title}
                      onChange={(e) => setNewArticle({ ...newArticle, title: e.target.value })}
                      placeholder="Enter article title..."
                      className="w-full px-4 py-2 bg-mystery-900 border border-mystery-600 rounded-lg text-white focus:outline-none focus:border-mystery-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      SEO Keywords (comma separated)
                    </label>
                    <input
                      type="text"
                      value={newArticle.seo_keywords}
                      onChange={(e) => setNewArticle({ ...newArticle, seo_keywords: e.target.value })}
                      placeholder="unexplained mysteries, paranormal, ufo sightings..."
                      className="w-full px-4 py-2 bg-mystery-900 border border-mystery-600 rounded-lg text-white focus:outline-none focus:border-mystery-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Article Content
                    </label>
                    <textarea
                      value={newArticle.content}
                      onChange={(e) => setNewArticle({ ...newArticle, content: e.target.value })}
                      placeholder="Write your article content here... (supports Markdown)"
                      rows={12}
                      className="w-full px-4 py-2 bg-mystery-900 border border-mystery-600 rounded-lg text-white focus:outline-none focus:border-mystery-500 font-mono text-sm"
                    />
                  </div>

                  <button
                    onClick={publishArticle}
                    disabled={publishingArticle}
                    className="px-6 py-3 bg-mystery-500 hover:bg-mystery-400 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {publishingArticle ? 'Publishing...' : 'Publish Article'}
                  </button>
                </div>
              </div>

              {/* Published Articles */}
              <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-mystery-400" />
                  Published Articles ({articles.length})
                </h3>
                <div className="space-y-3">
                  {articles.map((article) => (
                    <div key={article.id} className="p-4 bg-mystery-900/50 rounded-lg border border-mystery-700">
                      {editingArticleId === article.id ? (
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={editingArticle?.title || ''}
                            onChange={(e) => setEditingArticle({ ...editingArticle, title: e.target.value })}
                            className="w-full px-3 py-2 bg-mystery-800 border border-mystery-600 rounded-lg text-white focus:outline-none focus:border-mystery-500"
                            placeholder="Article Title"
                          />
                          <input
                            type="text"
                            value={editingArticle?.seo_keywords || ''}
                            onChange={(e) => setEditingArticle({ ...editingArticle, seo_keywords: e.target.value })}
                            className="w-full px-3 py-2 bg-mystery-800 border border-mystery-600 rounded-lg text-white focus:outline-none focus:border-mystery-500"
                            placeholder="SEO Keywords (comma separated)"
                          />
                          <textarea
                            value={editingArticle?.content || ''}
                            onChange={(e) => setEditingArticle({ ...editingArticle, content: e.target.value })}
                            rows={8}
                            className="w-full px-3 py-2 bg-mystery-800 border border-mystery-600 rounded-lg text-white focus:outline-none focus:border-mystery-500 font-mono text-sm"
                            placeholder="Article Content"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateArticle(article.id)}
                              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded transition-colors"
                            >
                              Save Changes
                            </button>
                            <button
                              onClick={() => {
                                setEditingArticleId(null);
                                setEditingArticle(null);
                              }}
                              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-white font-medium mb-1">{article.title}</h4>
                            <p className="text-sm text-gray-400 mb-2">
                              Published: {new Date(article.created_at).toLocaleString()}
                              {article.updated_at && article.updated_at !== article.created_at && (
                                <span className="ml-2 text-yellow-400">
                                  (Updated: {new Date(article.updated_at).toLocaleString()})
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-gray-500 mb-2">Views: {article.views || 0} • Likes: {article.likes || 0}</p>
                            {article.seo_keywords && (
                              <div className="flex flex-wrap gap-2">
                                {article.seo_keywords.split(',').map((keyword: string, idx: number) => (
                                  <span key={idx} className="px-2 py-1 bg-mystery-700 text-xs text-gray-300 rounded">
                                    {keyword.trim()}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <a
                              href={`/articles/${article.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded transition-colors"
                            >
                              View
                            </a>
                            <button
                              onClick={() => {
                                setEditingArticleId(article.id);
                                setEditingArticle({ ...article });
                              }}
                              className="px-3 py-1 bg-mystery-600 hover:bg-mystery-500 text-white text-xs rounded transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => deleteArticle(article.id, article.title)}
                              className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {articles.length === 0 && (
                    <p className="text-gray-500 text-center py-8">No articles published yet</p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* VERIFICATIONS TAB */}
          {activeTab === 'verifications' && (
            <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Shield className="w-6 h-6 text-yellow-400" />
                Pending Background Checks ({backgroundChecks.length})
              </h3>

              {backgroundChecks.length === 0 ? (
                <div className="text-center py-12">
                  <Shield className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No pending verification requests</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {backgroundChecks.map((check) => (
                    <div key={check.id} className="bg-mystery-900/50 rounded-lg border border-mystery-700 p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-mystery-700 flex items-center justify-center overflow-hidden">
                            {check.investigator?.avatar_url ? (
                              <img src={check.investigator.avatar_url} alt={check.investigator.username} className="w-full h-full object-cover rounded-full" />
                            ) : (
                              <Users className="w-6 h-6 text-gray-500" />
                            )}
                          </div>
                          <div>
                            <h4 className="text-lg font-bold text-white">{check.investigator?.username}</h4>
                            <p className="text-sm text-gray-400">{check.investigator?.full_name}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Requested: {new Date(check.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className={`px-3 py-1 text-sm font-medium rounded-full mb-2 ${
                            check.check_type === 'premium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {check.check_type.toUpperCase()} CHECK
                          </span>
                          <span className="text-green-400 font-bold">PAID €{check.price_paid}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div className="bg-mystery-800 p-4 rounded-lg">
                          <h5 className="font-bold text-white mb-3">Verification Checklist</h5>
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-gray-300">
                              <input type="checkbox" className="form-checkbox bg-mystery-700 border-mystery-600 rounded text-blue-500" id={`id_${check.id}`} />
                              Identity Verified
                            </label>
                            <label className="flex items-center gap-2 text-gray-300">
                              <input type="checkbox" className="form-checkbox bg-mystery-700 border-mystery-600 rounded text-blue-500" id={`cred_${check.id}`} />
                              Credentials Verified
                            </label>
                            <label className="flex items-center gap-2 text-gray-300">
                              <input type="checkbox" className="form-checkbox bg-mystery-700 border-mystery-600 rounded text-blue-500" id={`bg_${check.id}`} />
                              Clean Background Check
                            </label>
                          </div>
                        </div>
                        
                        <div className="bg-mystery-800 p-4 rounded-lg">
                          <h5 className="font-bold text-white mb-3">Documents</h5>
                          {check.documents && check.documents.length > 0 ? (
                            <div className="space-y-2">
                              {check.documents.map((doc: any, i: number) => (
                                <a
                                  key={i}
                                  href={doc.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 text-blue-400 hover:text-blue-300"
                                >
                                  <FileText className="w-4 h-4" />
                                  {doc.type} Document
                                </a>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-500 text-sm">No documents uploaded</p>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={async () => {
                            const idVerified = (document.getElementById(`id_${check.id}`) as HTMLInputElement)?.checked;
                            const credVerified = (document.getElementById(`cred_${check.id}`) as HTMLInputElement)?.checked;
                            const bgVerified = (document.getElementById(`bg_${check.id}`) as HTMLInputElement)?.checked;

                            if (!idVerified && !credVerified && !bgVerified) {
                              if (!confirm('No items checked. Are you sure you want to approve?')) return;
                            }
                            
                            try {
                              const { data: user } = await supabase.auth.getUser();
                              const { error } = await supabase.rpc('complete_background_check', {
                                p_check_id: check.id,
                                p_admin_id: user.user?.id,
                                p_verified: true,
                                p_identity_verified: idVerified,
                                p_credentials_verified: credVerified,
                                p_background_clear: bgVerified,
                                p_review_notes: 'Approved via Admin Dashboard'
                              });

                              if (error) throw error;

                              alert('✅ Verification approved!');
                              loadAdminData();
                            } catch (error: any) {
                              console.error('Failed to approve:', error);
                              alert('Error: ' + error.message);
                            }
                          }}
                          className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" /> Approve & Verify
                        </button>
                        <button
                          onClick={async () => {
                            const reason = prompt('Reason for rejection:');
                            if (!reason) return;

                            try {
                              const { data: user } = await supabase.auth.getUser();
                              const { error } = await supabase.rpc('complete_background_check', {
                                p_check_id: check.id,
                                p_admin_id: user.user?.id,
                                p_verified: false,
                                p_identity_verified: false,
                                p_credentials_verified: false,
                                p_background_clear: false,
                                p_review_notes: reason
                              });

                              if (error) throw error;

                              alert('Verification rejected.');
                              loadAdminData();
                            } catch (error: any) {
                              console.error('Failed to reject:', error);
                              alert('Error: ' + error.message);
                            }
                          }}
                          className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <X className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* INVESTIGATORS TAB */}
          {activeTab === 'investigators' && (
            <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6">
              <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Shield className="w-6 h-6 text-mystery-400" />
                Pending Investigator Applications ({investigatorApplications.length})
              </h3>

              {investigatorApplications.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No pending applications</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {investigatorApplications.map((app) => (
                    <div key={app.id} className="bg-mystery-900/50 rounded-lg border border-mystery-700 p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-mystery-700 flex items-center justify-center overflow-hidden">
                            {app.applicant?.avatar_url ? (
                              <img src={app.applicant.avatar_url} alt={app.applicant.username} className="w-full h-full object-cover rounded-full" />
                            ) : (
                              <Users className="w-6 h-6 text-gray-500" />
                            )}
                          </div>
                          <div>
                            <h4 className="text-lg font-bold text-white">{app.applicant?.username}</h4>
                            <p className="text-sm text-gray-400">{app.applicant?.email}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Applied: {new Date(app.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-sm font-medium rounded-full">
                          Pending Review
                        </span>
                      </div>

                      <div className="space-y-3 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">Motivation</label>
                          <p className="text-white bg-mystery-800 p-3 rounded-lg">{app.motivation}</p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-400 mb-1">Areas of Expertise</label>
                          <div className="flex flex-wrap gap-2">
                            {app.expertise && app.expertise.length > 0 ? (
                              app.expertise.map((exp: string, idx: number) => (
                                <span key={idx} className="px-3 py-1 bg-mystery-500/20 text-mystery-300 text-sm rounded-full">
                                  {exp}
                                </span>
                              ))
                            ) : (
                              <span className="text-gray-500 text-sm">None specified</span>
                            )}
                          </div>
                        </div>

                        {app.experience && (
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Experience</label>
                            <p className="text-white bg-mystery-800 p-3 rounded-lg whitespace-pre-wrap">{app.experience}</p>
                          </div>
                        )}

                        {app.certifications && app.certifications.length > 0 && (
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Certifications</label>
                            <div className="space-y-2">
                              {app.certifications.map((cert: any, idx: number) => (
                                <div key={idx} className="bg-mystery-800 p-3 rounded-lg">
                                  <p className="text-white font-medium">{cert.name}</p>
                                  <p className="text-sm text-gray-400">
                                    {cert.issuer} • {cert.year}
                                    {cert.url && (
                                      <a href={cert.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-mystery-400 hover:text-mystery-300">
                                        View Certificate →
                                      </a>
                                    )}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {app.documents && app.documents.length > 0 && (
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Uploaded Documents</label>
                            <div className="space-y-2">
                              {app.documents.map((doc: any, idx: number) => (
                                <a href={doc.url} target="_blank" rel="noopener noreferrer" key={idx} className="flex items-center gap-2 p-2 bg-mystery-800 rounded-lg hover:bg-mystery-700">
                                  <FileText className="w-4 h-4 text-mystery-400" />
                                  <span className="text-sm text-blue-400 hover:underline">{doc.fileName} ({doc.type})</span>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={async () => {
                            if (!confirm(`Approve ${app.applicant?.username} as investigator?`)) return;
                            
                            try {
                              const { error } = await supabase.rpc('approve_investigator_application_wrapper', {
                                action_data: {
                                  application_id: app.id,
                                  admin_id: (await supabase.auth.getUser()).data.user?.id
                                }
                              });

                              if (error) throw error;

                              alert(`✅ ${app.applicant?.username} approved as investigator!`);
                              loadAdminData();
                            } catch (error) {
                              console.error('Failed to approve application:', error);
                              alert('Failed to approve application. Please try again.');
                            }
                          }}
                          className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors"
                        >
                          ✓ Approve Application
                        </button>
                        <button
                          onClick={async () => {
                            const reason = prompt(`Rejection reason for ${app.applicant?.username}:`);
                            if (!reason) return;

                            try {
                              const { error } = await supabase.rpc('reject_investigator_application_wrapper', {
                                action_data: {
                                  application_id: app.id,
                                  admin_id: (await supabase.auth.getUser()).data.user?.id,
                                  reason: reason
                                }
                              });

                              if (error) throw error;

                              alert(`Application rejected.`);
                              loadAdminData();
                            } catch (error) {
                              console.error('Failed to reject application:', error);
                              alert('Failed to reject application. Please try again.');
                            }
                          }}
                          className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg transition-colors"
                        >
                          ✗ Reject Application
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Active Investigators Section */}
              <div className="mt-8">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                  <Shield className="w-6 h-6 text-green-400" />
                  Active Investigators ({activeInvestigators.length})
                </h3>

                {activeInvestigators.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400">No active investigators</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {activeInvestigators.map((inv) => (
                      <div key={inv.id} className="bg-mystery-900/50 rounded-lg border border-mystery-700 p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-mystery-700 flex items-center justify-center overflow-hidden">
                            {inv.avatar_url ? (
                              <img src={inv.avatar_url} alt={inv.username} className="w-full h-full object-cover rounded-full" />
                            ) : (
                              <Users className="w-5 h-5 text-gray-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-white truncate">{inv.username || 'Anonymous'}</h4>
                            <p className="text-xs text-gray-400">{inv.full_name || 'No name'}</p>
                          </div>
                          <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs font-medium rounded-full">
                            Active
                          </span>
                        </div>
                        
                        <div className="text-sm text-gray-400 mb-3 space-y-1">
                          <p>⭐ Reputation: {inv.reputation || 0}</p>
                          <p>📁 Cases: {inv.cases_count || 0}</p>
                          <p>✓ Status: {inv.verification_status || 'unverified'}</p>
                        </div>

                        <button
                          onClick={async () => {
                            const reason = prompt(`Reason for demoting ${inv.username || 'this investigator'}:`);
                            if (reason === null) return;

                            if (!confirm(`Are you sure you want to demote ${inv.username || 'this investigator'} to regular user?`)) return;

                            try {
                              const { data, error } = await supabase.rpc('demote_investigator', {
                                action_data: {
                                  user_id: inv.id,
                                  reason: reason || 'No reason provided'
                                }
                              });

                              if (error) throw error;
                              if (data && !data.success) throw new Error(data.error);

                              alert(`${inv.username || 'Investigator'} has been demoted to user.`);
                              loadAdminData();
                            } catch (error: any) {
                              console.error('Failed to demote investigator:', error);
                              alert('Failed to demote investigator: ' + (error.message || 'Unknown error'));
                            }
                          }}
                          className="w-full px-3 py-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white text-sm font-medium rounded-lg transition-colors"
                        >
                          ↓ Demote to User
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUBSCRIPTIONS TAB */}
          {activeTab === 'subscriptions' && (
            <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6">
              <SubscriptionGroupNotifications />
            </div>
          )}
          
          {/* CAMPAIGNS TAB */}
          {activeTab === 'campaigns' && (
            <CampaignManager />
          )}

          {/* USERS MANAGEMENT TAB */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <Users className="w-7 h-7 text-mystery-400" />
                  Users Management
                </h2>

                {/* Search Bar */}
                <div className="mb-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search users by username, name, or ID..."
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-mystery-900 border border-mystery-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-mystery-400"
                    />
                  </div>
                  <p className="text-sm text-gray-400 mt-2">
                    Found {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Users List */}
                <div className="space-y-4">
                  {filteredUsers.length === 0 ? (
                    <div className="text-center py-12">
                      <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400">No users found</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {filteredUsers.map((user) => (
                        <div key={user.id} className="bg-mystery-900/50 rounded-lg border border-mystery-700 p-4 hover:border-mystery-600 transition-colors">
                          <div className="flex items-start gap-3 mb-4">
                            <div className="w-12 h-12 rounded-full bg-mystery-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {user.avatar_url ? (
                                <img src={user.avatar_url} alt={user.username} className="w-full h-full object-cover" />
                              ) : (
                                <Users className="w-6 h-6 text-gray-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium text-white truncate">{user.username || 'Anonymous'}</h3>
                              <p className="text-xs text-gray-400 truncate">{user.full_name || 'No name'}</p>
                            </div>
                          </div>

                          <div className="space-y-2 mb-4">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-400">Role:</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                user.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                                user.role === 'investigator' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>
                                {user.role || 'user'}
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-400">Credits:</span>
                              <span className="text-mystery-300 font-semibold">{user.credits || 0}</span>
                            </div>
                            
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-400">Reputation:</span>
                              <span className="text-yellow-400">⭐ {user.reputation || 0}</span>
                            </div>
                            
                            {user.is_pro_member && (
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-1 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 text-xs font-bold rounded-full">
                                  ✨ PRO Member
                                </span>
                              </div>
                            )}

                            <div className="text-xs text-gray-500 pt-2 border-t border-mystery-700">
                              Joined: {new Date(user.created_at).toLocaleDateString()}
                            </div>
                          </div>

                          <button
                            onClick={() => setSelectedUserForCredits(user)}
                            className="w-full px-4 py-2 bg-mystery-600 hover:bg-mystery-500 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                            <DollarSign className="w-4 h-4" />
                            Award Credits
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Credit Award Modal */}
      {selectedUserForCredits && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6 sm:p-8 w-full max-w-md text-white">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-mystery-400" />
                Award Credits
              </h3>
              <button
                onClick={() => {
                  setSelectedUserForCredits(null);
                  setCreditAmount('');
                  setCreditReason('');
                }}
                className="text-gray-400 hover:text-white text-3xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-mystery-900/50 rounded-lg p-4 border border-mystery-700">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-mystery-700 flex items-center justify-center overflow-hidden">
                    {selectedUserForCredits.avatar_url ? (
                      <img src={selectedUserForCredits.avatar_url} alt={selectedUserForCredits.username} className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-5 h-5 text-gray-500" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium text-white">{selectedUserForCredits.username || 'Anonymous'}</h4>
                    <p className="text-sm text-gray-400">{selectedUserForCredits.full_name || 'No name'}</p>
                  </div>
                </div>
                <div className="text-sm text-gray-400">
                  Current credits: <span className="text-mystery-300 font-semibold">{selectedUserForCredits.credits || 0}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Credit Amount *
                </label>
                <input
                  type="number"
                  min="1"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="Enter amount (e.g., 50)"
                  className="w-full px-4 py-2 bg-mystery-900 border border-mystery-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-mystery-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Reason for Award *
                </label>
                <textarea
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  placeholder="Why are you awarding credits? (e.g., Outstanding investigation work, Platform issue compensation, Community contribution)"
                  rows={4}
                  className="w-full px-4 py-2 bg-mystery-900 border border-mystery-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-mystery-400 resize-none"
                />
              </div>

              {creditAmount && !isNaN(parseInt(creditAmount)) && parseInt(creditAmount) > 0 && (
                <div className="bg-mystery-500/10 border border-mystery-500/30 rounded-lg p-3">
                  <p className="text-sm text-mystery-300">
                    New balance will be: <span className="font-bold">{(selectedUserForCredits.credits || 0) + parseInt(creditAmount)}</span> credits
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedUserForCredits(null);
                  setCreditAmount('');
                  setCreditReason('');
                }}
                className="flex-1 px-4 py-2 bg-mystery-700 hover:bg-mystery-600 text-white font-medium rounded-lg transition-colors"
                disabled={awardingCredits}
              >
                Cancel
              </button>
              <button
                onClick={handleAwardCredits}
                disabled={awardingCredits || !creditAmount || !creditReason.trim()}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {awardingCredits ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Awarding...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Award Credits
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTx && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-mystery-800 rounded-xl border border-mystery-700 p-6 sm:p-8 w-full max-w-2xl text-white">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Transaction Details</h3>
              <button
                onClick={() => setSelectedTx(null)}
                className="text-gray-400 hover:text-white text-3xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-mystery-700 pb-2">
                <span className="text-gray-400">Transaction ID:</span>
                <span className="font-mono text-xs">{selectedTx.id}</span>
              </div>
              <div className="flex justify-between border-b border-mystery-700 pb-2">
                <span className="text-gray-400">Date:</span>
                <span>{new Date(selectedTx.created_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b border-mystery-700 pb-2">
                <span className="text-gray-400">From:</span>
                <span className="font-bold">{selectedTx.from_wallet?.user?.username || 'System'}</span>
              </div>
              <div className="flex justify-between border-b border-mystery-700 pb-2">
                <span className="text-gray-400">To:</span>
                <span className="font-bold">{selectedTx.to_wallet?.user?.username || 'System'}</span>
              </div>
              <div className="flex justify-between border-b border-mystery-700 pb-2">
                <span className="text-gray-400">Type:</span>
                <span className="capitalize">{selectedTx.transaction_type.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between border-b border-mystery-700 pb-2">
                <span className="text-gray-400">Amount:</span>
                <span className={`font-bold text-lg ${
                  ['deposit', 'reward', 'donation_received'].includes(selectedTx.transaction_type) 
                    ? 'text-green-400' 
                    : 'text-red-400'
                }`}>
                  {['deposit', 'reward', 'donation_received'].includes(selectedTx.transaction_type) ? '+' : '-'}
                  €{selectedTx.amount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between border-b border-mystery-700 pb-2">
                <span className="text-gray-400">Status:</span>
                <span className={`font-medium px-2 py-1 rounded text-xs ${
                  selectedTx.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                  selectedTx.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                  selectedTx.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {selectedTx.status}
                </span>
              </div>
              {selectedTx.metadata && Object.keys(selectedTx.metadata).length > 0 && (
                <div className="pt-2">
                  <span className="text-gray-400">Metadata:</span>
                  <pre className="text-white bg-mystery-900 p-3 rounded-lg mt-2 text-xs overflow-auto">
                    {JSON.stringify(selectedTx.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="mt-8 text-right">
              <button
                onClick={() => setSelectedTx(null)}
                className="px-6 py-2 bg-mystery-600 hover:bg-mystery-500 text-white rounded-lg font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT MONITORING TAB */}
      {activeTab === 'payments' && (
        <AdminPaymentDashboard />
      )}
    </div>
  );
};
