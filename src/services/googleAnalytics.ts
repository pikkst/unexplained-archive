/**
 * Google Analytics 4 (GA4) API Service
 * Provides real-time analytics data from Google Analytics
 */

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-XYPKB6D84C';
const GA_PROPERTY_ID = ''; // Format: properties/123456789

interface AnalyticsData {
  pageViews: number;
  uniqueVisitors: number;
  avgSessionDuration: string;
  bounceRate: string;
  topPages: { page: string; views: number }[];
  trafficSources: { source: string; visits: number }[];
  topCountries: { country: string; visits: number }[];
}

/**
 * Fetch real-time analytics data from Google Analytics 4
 */
export const fetchGoogleAnalytics = async (): Promise<AnalyticsData | null> => {
  if (!GOOGLE_API_KEY) {
    console.warn('Google API key not configured. Using fallback analytics.');
    return null;
  }

  try {
    // Note: Google Analytics Data API requires OAuth2, not just API key
    // For production, you need to set up OAuth2 authentication
    // This is a placeholder for the structure
    
    // Using Google Analytics Data API v1
    // https://developers.google.com/analytics/devguides/reporting/data/v1
    
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/${GA_PROPERTY_ID}:runReport?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [
            {
              startDate: '30daysAgo',
              endDate: 'today',
            },
          ],
          dimensions: [
            { name: 'pagePath' },
            { name: 'country' },
            { name: 'sessionSource' },
          ],
          metrics: [
            { name: 'screenPageViews' },
            { name: 'totalUsers' },
            { name: 'averageSessionDuration' },
            { name: 'bounceRate' },
          ],
        }),
      }
    );

    if (!response.ok) {
      console.error('Google Analytics API error:', await response.text());
      return null;
    }

    const data = await response.json();
    
    // Parse the response
    return parseGoogleAnalyticsData(data);
  } catch (error) {
    console.error('Failed to fetch Google Analytics:', error);
    return null;
  }
};

/**
 * Parse Google Analytics API response
 */
const parseGoogleAnalyticsData = (data: any): AnalyticsData => {
  const rows = data.rows || [];
  
  // Aggregate data
  const pageViews = rows.reduce((sum: number, row: any) => 
    sum + parseInt(row.metricValues[0].value || '0'), 0
  );
  
  const uniqueVisitors = new Set(rows.map((row: any) => row.dimensionValues[1]?.value)).size;
  
  // Calculate average session duration
  const avgDurationSeconds = rows.reduce((sum: number, row: any) => 
    sum + parseFloat(row.metricValues[2].value || '0'), 0
  ) / (rows.length || 1);
  
  const avgSessionDuration = `${Math.floor(avgDurationSeconds / 60)}m ${Math.floor(avgDurationSeconds % 60)}s`;
  
  // Calculate bounce rate
  const avgBounceRate = rows.reduce((sum: number, row: any) => 
    sum + parseFloat(row.metricValues[3].value || '0'), 0
  ) / (rows.length || 1);
  
  const bounceRate = `${Math.round(avgBounceRate * 100)}%`;
  
  // Top pages
  const pageMap = new Map<string, number>();
  rows.forEach((row: any) => {
    const page = row.dimensionValues[0].value;
    const views = parseInt(row.metricValues[0].value || '0');
    pageMap.set(page, (pageMap.get(page) || 0) + views);
  });
  
  const topPages = Array.from(pageMap.entries())
    .map(([page, views]) => ({ page, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);
  
  // Top countries
  const countryMap = new Map<string, number>();
  rows.forEach((row: any) => {
    const country = row.dimensionValues[1].value;
    const visits = parseInt(row.metricValues[0].value || '0');
    countryMap.set(country, (countryMap.get(country) || 0) + visits);
  });
  
  const topCountries = Array.from(countryMap.entries())
    .map(([country, visits]) => ({ country, visits }))
    .sort((a, b) => b.visits - a.visits);
  
  // Traffic sources
  const sourceMap = new Map<string, number>();
  rows.forEach((row: any) => {
    const source = row.dimensionValues[2].value || 'Direct';
    const visits = parseInt(row.metricValues[0].value || '0');
    sourceMap.set(source, (sourceMap.get(source) || 0) + visits);
  });
  
  const trafficSources = Array.from(sourceMap.entries())
    .map(([source, visits]) => ({ source, visits }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 10);
  
  return {
    pageViews,
    uniqueVisitors,
    avgSessionDuration,
    bounceRate,
    topPages,
    trafficSources,
    topCountries,
  };
};

/**
 * Fetch SEO data from Google Search Console
 */
export const fetchSearchConsoleData = async () => {
  if (!GOOGLE_API_KEY) {
    console.warn('Google API key not configured. Using fallback SEO data.');
    return null;
  }

  try {
    // Google Search Console API
    // https://developers.google.com/webmaster-tools/search-console-api-original/v3/searchanalytics/query
    
    const siteUrl = 'https://unexplainedarchive.com'; // Your site URL
    
    const response = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: '2024-11-14', // 30 days ago
          endDate: '2024-12-14', // today
          dimensions: ['query', 'page', 'country'],
          rowLimit: 100,
        }),
      }
    );

    if (!response.ok) {
      console.error('Search Console API error:', await response.text());
      return null;
    }

    const data = await response.json();
    
    return data.rows?.map((row: any) => ({
      keyword: row.keys[0],
      page_url: row.keys[1],
      country: row.keys[2],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: Math.round(row.position),
    })) || [];
  } catch (error) {
    console.error('Failed to fetch Search Console data:', error);
    return null;
  }
};

/**
 * Get real-time active users (last 5 minutes)
 */
export const fetchRealtimeUsers = async (): Promise<number> => {
  if (!GOOGLE_API_KEY || !GA_PROPERTY_ID) {
    return 0;
  }

  try {
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/${GA_PROPERTY_ID}:runRealtimeReport?key=${GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metrics: [{ name: 'activeUsers' }],
        }),
      }
    );

    if (!response.ok) {
      return 0;
    }

    const data = await response.json();
    return parseInt(data.rows?.[0]?.metricValues?.[0]?.value || '0');
  } catch (error) {
    console.error('Failed to fetch realtime users:', error);
    return 0;
  }
};

/**
 * Helper function to test if Google Analytics API is configured
 */
export const isGoogleAnalyticsConfigured = (): boolean => {
  return !!GOOGLE_API_KEY && !!GA_PROPERTY_ID;
};
