import { supabase } from '../lib/supabase';

export interface AnalyticsEvent {
  visitor_id?: string;
  user_id?: string;
  event_type: string;
  page_path?: string;
  referrer?: string;
  country?: string;
  device_type?: string;
  session_duration?: number;
  metadata?: Record<string, any>;
}

export interface ShareTrackingParams {
  case_id?: string;
  article_id?: string;
  share_source: 'facebook' | 'twitter' | 'linkedin' | 'copy_link';
  sharer_id?: string;
}

class AnalyticsService {
  private visitorId: string;

  constructor() {
    // Get or create visitor ID
    this.visitorId = this.getOrCreateVisitorId();
  }

  private getOrCreateVisitorId(): string {
    let visitorId = localStorage.getItem('visitor_id');
    if (!visitorId) {
      visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      localStorage.setItem('visitor_id', visitorId);
    }
    return visitorId;
  }

  /**
   * Track a general analytics event
   */
  async trackEvent(event: AnalyticsEvent): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      await supabase.from('analytics_events').insert({
        visitor_id: event.visitor_id || this.visitorId,
        user_id: event.user_id || user?.id || null,
        event_type: event.event_type,
        page_path: event.page_path || window.location.pathname,
        referrer: event.referrer || document.referrer,
        country: null, // Can be populated by server-side geolocation
        device_type: this.getDeviceType(),
        session_duration: event.session_duration || null,
        metadata: event.metadata || {}
      });
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }

  /**
   * Track page view with referral tracking
   */
  async trackPageView(additionalMetadata?: Record<string, any>): Promise<void> {
    const urlParams = new URLSearchParams(window.location.search);
    const metadata: Record<string, any> = {
      ...additionalMetadata
    };

    // Track referral parameters
    const shareId = urlParams.get('share_id');
    const shareSource = urlParams.get('share_source');
    const caseId = urlParams.get('case_id');
    
    if (shareId) {
      metadata.share_id = shareId;
      metadata.is_referred_visit = true;
    }
    
    if (shareSource) {
      metadata.share_source = shareSource;
    }
    
    if (caseId) {
      metadata.referred_case_id = caseId;
    }

    // Extract UTM parameters
    const utmSource = urlParams.get('utm_source');
    const utmMedium = urlParams.get('utm_medium');
    const utmCampaign = urlParams.get('utm_campaign');
    
    if (utmSource) metadata.utm_source = utmSource;
    if (utmMedium) metadata.utm_medium = utmMedium;
    if (utmCampaign) metadata.utm_campaign = utmCampaign;

    await this.trackEvent({
      event_type: 'page_view',
      metadata
    });
  }

  /**
   * Track when a user clicks share button
   */
  async trackShare(params: ShareTrackingParams): Promise<string> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Generate unique share ID
      const shareId = `share_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      await this.trackEvent({
        event_type: 'share_initiated',
        metadata: {
          share_id: shareId,
          case_id: params.case_id,
          article_id: params.article_id,
          share_source: params.share_source,
          sharer_id: params.sharer_id || user?.id
        }
      });

      return shareId;
    } catch (error) {
      console.error('Failed to track share:', error);
      return '';
    }
  }

  /**
   * Track when someone views a case (with share tracking)
   */
  async trackCaseView(caseId: string): Promise<void> {
    const urlParams = new URLSearchParams(window.location.search);
    const shareId = urlParams.get('share_id');
    const shareSource = urlParams.get('share_source');

    await this.trackEvent({
      event_type: 'case_view',
      metadata: {
        case_id: caseId,
        ...(shareId && { 
          share_id: shareId,
          is_referred: true,
          share_source: shareSource || 'unknown'
        })
      }
    });
  }

  /**
   * Get share statistics for a case (admin view)
   */
  async getShareStatistics(caseId: string): Promise<{
    total_shares: number;
    total_views_from_shares: number;
    shares_by_platform: Record<string, number>;
    views_by_platform: Record<string, number>;
  }> {
    try {
      // Get total shares
      const { data: shareData } = await supabase
        .from('analytics_events')
        .select('metadata')
        .eq('event_type', 'share_initiated')
        .contains('metadata', { case_id: caseId });

      // Get views from shares
      const { data: viewData } = await supabase
        .from('analytics_events')
        .select('metadata')
        .eq('event_type', 'case_view')
        .contains('metadata', { case_id: caseId, is_referred: true });

      const sharesByPlatform: Record<string, number> = {};
      const viewsByPlatform: Record<string, number> = {};

      shareData?.forEach(event => {
        const platform = event.metadata?.share_source || 'unknown';
        sharesByPlatform[platform] = (sharesByPlatform[platform] || 0) + 1;
      });

      viewData?.forEach(event => {
        const platform = event.metadata?.share_source || 'unknown';
        viewsByPlatform[platform] = (viewsByPlatform[platform] || 0) + 1;
      });

      return {
        total_shares: shareData?.length || 0,
        total_views_from_shares: viewData?.length || 0,
        shares_by_platform: sharesByPlatform,
        views_by_platform: viewsByPlatform
      };
    } catch (error) {
      console.error('Failed to get share statistics:', error);
      return {
        total_shares: 0,
        total_views_from_shares: 0,
        shares_by_platform: {},
        views_by_platform: {}
      };
    }
  }

  /**
   * Get overall platform share statistics (admin dashboard)
   */
  async getPlatformShareStats(days: number = 30): Promise<{
    total_shares: number;
    total_referred_views: number;
    conversion_rate: number;
    top_shared_cases: Array<{
      case_id: string;
      case_title: string;
      share_count: number;
      view_count: number;
    }>;
    platform_breakdown: Record<string, { shares: number; views: number }>;
  }> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      // Get all shares in period
      const { data: shares } = await supabase
        .from('analytics_events')
        .select('metadata, created_at')
        .eq('event_type', 'share_initiated')
        .gte('created_at', since.toISOString());

      // Get all referred views in period
      const { data: views } = await supabase
        .from('analytics_events')
        .select('metadata, created_at')
        .eq('event_type', 'case_view')
        .contains('metadata', { is_referred: true })
        .gte('created_at', since.toISOString());

      const caseStats: Record<string, { share_count: number; view_count: number }> = {};
      const platformBreakdown: Record<string, { shares: number; views: number }> = {};

      // Process shares
      shares?.forEach(event => {
        const caseId = event.metadata?.case_id;
        const platform = event.metadata?.share_source || 'unknown';
        
        if (caseId) {
          if (!caseStats[caseId]) {
            caseStats[caseId] = { share_count: 0, view_count: 0 };
          }
          caseStats[caseId].share_count++;
        }

        if (!platformBreakdown[platform]) {
          platformBreakdown[platform] = { shares: 0, views: 0 };
        }
        platformBreakdown[platform].shares++;
      });

      // Process views
      views?.forEach(event => {
        const caseId = event.metadata?.case_id;
        const platform = event.metadata?.share_source || 'unknown';
        
        if (caseId && caseStats[caseId]) {
          caseStats[caseId].view_count++;
        }

        if (platformBreakdown[platform]) {
          platformBreakdown[platform].views++;
        }
      });

      // Get case titles for top shared cases
      const topCaseIds = Object.entries(caseStats)
        .sort((a, b) => b[1].share_count - a[1].share_count)
        .slice(0, 10)
        .map(([id]) => id);

      const { data: cases } = await supabase
        .from('cases')
        .select('id, title')
        .in('id', topCaseIds);

      const topSharedCases = topCaseIds
        .map(id => {
          const caseData = cases?.find(c => c.id === id);
          return {
            case_id: id,
            case_title: caseData?.title || 'Unknown',
            share_count: caseStats[id].share_count,
            view_count: caseStats[id].view_count
          };
        });

      const totalShares = shares?.length || 0;
      const totalViews = views?.length || 0;

      return {
        total_shares: totalShares,
        total_referred_views: totalViews,
        conversion_rate: totalShares > 0 ? (totalViews / totalShares) * 100 : 0,
        top_shared_cases: topSharedCases,
        platform_breakdown: platformBreakdown
      };
    } catch (error) {
      console.error('Failed to get platform share stats:', error);
      return {
        total_shares: 0,
        total_referred_views: 0,
        conversion_rate: 0,
        top_shared_cases: [],
        platform_breakdown: {}
      };
    }
  }

  private getDeviceType(): string {
    const ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return 'tablet';
    }
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
      return 'mobile';
    }
    return 'desktop';
  }
}

export const analyticsService = new AnalyticsService();
