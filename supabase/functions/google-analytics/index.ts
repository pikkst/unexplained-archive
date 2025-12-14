import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyticsRequest {
  action: 'fetch_analytics' | 'fetch_search_console' | 'fetch_realtime';
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get Google API credentials from environment
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY');
    const GA_PROPERTY_ID = Deno.env.get('GA_PROPERTY_ID'); // Format: properties/123456789
    
    if (!GOOGLE_API_KEY) {
      throw new Error('GOOGLE_API_KEY not configured');
    }

    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      throw new Error('Unauthorized');
    }

    // Check if user is admin
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      throw new Error('Admin access required');
    }

    // Parse request
    const body: AnalyticsRequest = await req.json();
    const { action, dateRange } = body;

    let result;

    switch (action) {
      case 'fetch_analytics':
        result = await fetchGoogleAnalytics(GOOGLE_API_KEY, GA_PROPERTY_ID, dateRange);
        break;
      
      case 'fetch_search_console':
        result = await fetchSearchConsole(GOOGLE_API_KEY);
        break;
      
      case 'fetch_realtime':
        result = await fetchRealtimeUsers(GOOGLE_API_KEY, GA_PROPERTY_ID);
        break;
      
      default:
        throw new Error('Invalid action');
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Google Analytics API error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

/**
 * Fetch Google Analytics 4 data
 */
async function fetchGoogleAnalytics(
  apiKey: string, 
  propertyId: string | undefined,
  dateRange?: { startDate: string; endDate: string }
) {
  if (!propertyId) {
    throw new Error('GA_PROPERTY_ID not configured');
  }

  const startDate = dateRange?.startDate || '30daysAgo';
  const endDate = dateRange?.endDate || 'today';

  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/${propertyId}:runReport?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        dimensions: [
          { name: 'pagePath' },
          { name: 'country' },
          { name: 'sessionSource' },
          { name: 'deviceCategory' },
        ],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'totalUsers' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
          { name: 'sessions' },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Analytics API error: ${errorText}`);
  }

  const data = await response.json();
  return parseAnalyticsData(data);
}

/**
 * Parse Google Analytics response
 */
function parseAnalyticsData(data: any) {
  const rows = data.rows || [];
  
  if (rows.length === 0) {
    return {
      pageViews: 0,
      uniqueVisitors: 0,
      sessions: 0,
      avgSessionDuration: '0m 0s',
      bounceRate: '0%',
      topPages: [],
      trafficSources: [],
      topCountries: [],
      deviceTypes: [],
    };
  }

  // Aggregate metrics
  let totalPageViews = 0;
  let totalUsers = 0;
  let totalDuration = 0;
  let totalBounceRate = 0;
  let totalSessions = 0;
  let count = 0;

  const pageMap = new Map<string, number>();
  const countryMap = new Map<string, number>();
  const sourceMap = new Map<string, number>();
  const deviceMap = new Map<string, number>();

  rows.forEach((row: any) => {
    const pageViews = parseInt(row.metricValues[0]?.value || '0');
    const users = parseInt(row.metricValues[1]?.value || '0');
    const duration = parseFloat(row.metricValues[2]?.value || '0');
    const bounce = parseFloat(row.metricValues[3]?.value || '0');
    const sessions = parseInt(row.metricValues[4]?.value || '0');

    totalPageViews += pageViews;
    totalUsers += users;
    totalDuration += duration;
    totalBounceRate += bounce;
    totalSessions += sessions;
    count++;

    // Aggregate dimensions
    const page = row.dimensionValues[0]?.value || '/';
    const country = row.dimensionValues[1]?.value || 'Unknown';
    const source = row.dimensionValues[2]?.value || 'Direct';
    const device = row.dimensionValues[3]?.value || 'desktop';

    pageMap.set(page, (pageMap.get(page) || 0) + pageViews);
    countryMap.set(country, (countryMap.get(country) || 0) + sessions);
    sourceMap.set(source, (sourceMap.get(source) || 0) + sessions);
    deviceMap.set(device, (deviceMap.get(device) || 0) + sessions);
  });

  const avgDuration = count > 0 ? totalDuration / count : 0;
  const avgBounce = count > 0 ? totalBounceRate / count : 0;

  return {
    pageViews: totalPageViews,
    uniqueVisitors: totalUsers,
    sessions: totalSessions,
    avgSessionDuration: `${Math.floor(avgDuration / 60)}m ${Math.floor(avgDuration % 60)}s`,
    bounceRate: `${Math.round(avgBounce * 100)}%`,
    topPages: Array.from(pageMap.entries())
      .map(([page, views]) => ({ page, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10),
    trafficSources: Array.from(sourceMap.entries())
      .map(([source, visits]) => ({ source, visits }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10),
    topCountries: Array.from(countryMap.entries())
      .map(([country, visits]) => ({ country, visits }))
      .sort((a, b) => b.visits - a.visits),
    deviceTypes: Array.from(deviceMap.entries())
      .map(([device, sessions]) => ({ device, sessions }))
      .sort((a, b) => b.sessions - a.sessions),
  };
}

/**
 * Fetch Google Search Console data
 */
async function fetchSearchConsole(apiKey: string) {
  const siteUrl = 'sc-domain:unexplainedarchive.com'; // Adjust to your domain
  
  // Calculate dates
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  
  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  const response = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        dimensions: ['query', 'page', 'country'],
        rowLimit: 100,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.warn('Search Console API error:', errorText);
    return [];
  }

  const data = await response.json();
  
  return data.rows?.map((row: any) => ({
    keyword: row.keys[0],
    page_url: row.keys[1],
    country: row.keys[2],
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: Math.round(row.ctr * 10000) / 100, // Convert to percentage
    position: Math.round(row.position * 10) / 10,
    date: formatDate(endDate),
  })) || [];
}

/**
 * Fetch real-time active users
 */
async function fetchRealtimeUsers(apiKey: string, propertyId: string | undefined) {
  if (!propertyId) {
    return { activeUsers: 0 };
  }

  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/${propertyId}:runRealtimeReport?key=${apiKey}`,
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
    return { activeUsers: 0 };
  }

  const data = await response.json();
  return {
    activeUsers: parseInt(data.rows?.[0]?.metricValues?.[0]?.value || '0'),
  };
}
