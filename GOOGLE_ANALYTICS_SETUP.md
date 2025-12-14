# Google Analytics & Search Console Integration Setup

## Overview
This integration allows your Admin Dashboard to display **real-time analytics** from Google Analytics 4 (GA4) and **SEO data** from Google Search Console.

## Features
✅ Real-time visitor analytics (page views, sessions, bounce rate)
✅ Geographic distribution on world map
✅ Traffic sources and device types
✅ Automatic SEO ranking imports from Google Search Console
✅ Keyword performance tracking (clicks, impressions, CTR, position)

---

## Setup Instructions

### 1. Enable Google Analytics Data API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Google Analytics Data API**:
   - Navigate to **APIs & Services** → **Library**
   - Search for "Google Analytics Data API"
   - Click **Enable**
4. Enable **Google Search Console API**:
   - Search for "Google Search Console API"
   - Click **Enable**

### 2. Create API Key

1. Go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **API key**
3. Copy the API key (e.g., `AIzaSyAb8RN6INGlFVpWibAob5Ur_GnYqECngf4suGF6WPqu1yOjAu_w`)
4. (Optional) Restrict the key:
   - Click **Restrict Key**
   - Under **API restrictions**, select:
     - Google Analytics Data API
     - Google Search Console API
   - Under **Application restrictions**, add your domain

### 3. Get GA4 Property ID

1. Open [Google Analytics](https://analytics.google.com/)
2. Go to **Admin** (bottom left)
3. Under **Property**, click **Property Settings**
4. Copy your **Property ID** (format: `properties/123456789`)

### 4. Configure Supabase Edge Function Secrets

Run these commands in your terminal:

```bash
# Set Google API Key
supabase secrets set GOOGLE_API_KEY=YOUR_API_KEY_HERE

# Set GA4 Property ID
supabase secrets set GA_PROPERTY_ID=properties/YOUR_PROPERTY_ID

# Example:
# supabase secrets set GOOGLE_API_KEY=AIzaSyAb8RN6INGlFVpWibAob5Ur_GnYqECngf4suGF6WPqu1yOjAu_w
# supabase secrets set GA_PROPERTY_ID=properties/123456789
```

### 5. Deploy Edge Function

```bash
# Deploy the Google Analytics function
supabase functions deploy google-analytics

# Verify deployment
supabase functions list
```

### 6. Add SEO Metrics Columns to Database

Run this SQL in Supabase SQL Editor:

```sql
-- Run the SQL from: supabase/add-seo-metrics-columns.sql
```

Or use command line:
```bash
supabase db push
```

### 7. Verify Search Console Access

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add your property: `sc-domain:unexplainedarchive.com`
3. Verify ownership (DNS, HTML tag, or Google Analytics)
4. Wait 24-48 hours for data to accumulate

---

## Usage in Admin Dashboard

### Automatic Analytics Refresh
- Analytics data auto-refreshes every **30 seconds**
- Toggle auto-refresh with the button in the Geographic Distribution section

### Import SEO Rankings
1. Go to **Admin Dashboard** → **Analytics & SEO** tab
2. Scroll to **SEO Rankings Management**
3. Click **"Import from Google Search Console"**
4. Top 20 keywords with their positions, clicks, and CTR will be imported

### Manual Tracking
You can still manually add keywords:
1. Enter keyword, page URL, search engine, and position
2. Click **+ Add Ranking**

---

## Troubleshooting

### "GOOGLE_API_KEY not configured" Error

**Solution**: Set the secret in Supabase:
```bash
supabase secrets set GOOGLE_API_KEY=YOUR_KEY_HERE
```

### "GA_PROPERTY_ID not configured" Error

**Solution**: Set your GA4 property ID:
```bash
supabase secrets set GA_PROPERTY_ID=properties/123456789
```

Find your property ID:
1. Google Analytics → Admin → Property Settings
2. Copy the Property ID

### No Search Console Data

**Possible causes:**
- Property not verified in Search Console
- No search traffic yet (need 24-48 hours of data)
- API not enabled in Google Cloud Console

**Solution:**
1. Verify property ownership in Search Console
2. Wait for data accumulation (1-2 days)
3. Check API is enabled in Google Cloud Console

### API Quota Exceeded

Google Analytics Data API has quotas:
- **25,000 requests per day** (free tier)
- **10 queries per second**

**Solution:**
- Reduce auto-refresh frequency
- Use caching for frequently accessed data
- Upgrade to paid tier if needed

---

## Data Privacy & Security

✅ **API Key is stored securely** in Supabase Edge Function secrets
✅ **Not exposed** to frontend/browser
✅ **Admin-only access** - requires admin role verification
✅ **CORS headers** properly configured
✅ **IP anonymization** enabled in Google Analytics tracking code

---

## API Reference

### Edge Function Endpoints

**Fetch Analytics Data**
```typescript
supabase.functions.invoke('google-analytics', {
  body: { 
    action: 'fetch_analytics',
    dateRange: {
      startDate: '30daysAgo', // or YYYY-MM-DD
      endDate: 'today'
    }
  }
})
```

**Fetch Search Console Data**
```typescript
supabase.functions.invoke('google-analytics', {
  body: { action: 'fetch_search_console' }
})
```

**Fetch Real-time Users**
```typescript
supabase.functions.invoke('google-analytics', {
  body: { action: 'fetch_realtime' }
})
```

---

## Cost Estimate

**Google Cloud Costs:**
- API Key: **FREE**
- Google Analytics Data API: **FREE** (up to 25k requests/day)
- Google Search Console API: **FREE**

**Supabase Costs:**
- Edge Functions: **FREE** tier includes 500k invocations/month
- Estimated usage: ~8,640 calls/month (1 every 5 min)

**Total estimated cost: $0/month** 🎉

---

## Next Steps

After setup:
1. ✅ Monitor analytics in Admin Dashboard
2. ✅ Track SEO performance with automated imports
3. ✅ Use real-time user count for engagement monitoring
4. ✅ Analyze traffic sources and optimize marketing

---

## Support

**Documentation:**
- [Google Analytics Data API Docs](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [Google Search Console API Docs](https://developers.google.com/webmaster-tools/search-console-api-original/v3)
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)

**Need Help?**
- Check the browser console for error messages
- Verify all environment variables are set correctly
- Test API key in Google Cloud Console API Explorer
