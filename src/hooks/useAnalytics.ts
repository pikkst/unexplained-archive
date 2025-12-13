import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

function getOrCreateId(key: string): string {
  if (typeof window === 'undefined') return '';
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(key, id);
  return id;
}

function detectDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  if (/tablet|ipad/.test(ua)) return 'tablet';
  if (/mobi|android/.test(ua)) return 'mobile';
  return 'desktop';
}

function parseUtmParams(search: string) {
  const params = new URLSearchParams(search || '');
  return {
    utm_source: params.get('utm_source') || null,
    utm_medium: params.get('utm_medium') || null,
    utm_campaign: params.get('utm_campaign') || null,
  };
}

async function getCountry(): Promise<string | null> {
  try {
    // Use ip-api.com free tier (45 requests/minute)
    // or ipapi.co which has no rate limit for basic data
    const response = await fetch('https://ipapi.co/json/');
    if (!response.ok) return null;
    const data = await response.json();
    return data.country_name || data.country || null;
  } catch (error) {
    console.error('Failed to get country:', error);
    return null;
  }
}

export function useAnalyticsTracking() {
  const location = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const visitorId = getOrCreateId('ua_visitor_id');
    const sessionId = getOrCreateId('ua_session_id');

    const { pathname, search } = location;
    const page_path = pathname + (search || '');
    const page_title = document.title || 'Unexplained Archive';
    const referrer = document.referrer || 'direct';
    const language = navigator.language || navigator.languages?.[0] || 'en';
    const device_type = detectDeviceType();
    const screen_resolution = typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : undefined;
    const { utm_source, utm_medium, utm_campaign } = parseUtmParams(search);

    // Fire and forget; we don't block navigation on analytics errors
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const country = await getCountry();
        
        await (supabase as any).from('analytics_events').insert({
          visitor_id: visitorId,
          session_id: sessionId,
          event_type: 'page_view',
          page_path,
          page_title,
          referrer,
          utm_source,
          utm_medium,
          utm_campaign,
          language,
          device_type,
          screen_resolution,
          browser: navigator.userAgent,
          os: undefined,
          country,
          user_id: userData?.user?.id ?? null,
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to record analytics event', error);
      }
    })();
  }, [location]);
}
