# Social Media Share Tracking System

## Overview
Automatic tracking system for Facebook shares and referred visitors to measure social media impact.

## How It Works

### 1. **Share Tracking**
When a user clicks "Share on Facebook":
- A unique `share_id` is generated
- Event is logged to `analytics_events` table
- Facebook share URL includes tracking parameters: `?share_id=xxx&share_source=facebook`

### 2. **Visitor Tracking**  
When someone visits via shared link:
- System detects `share_id` and `share_source` in URL
- Logs a `case_view` event with referral information
- Links the view back to original share

### 3. **Data Structure**
All tracking data is stored in `analytics_events` table:
```sql
- id: uuid
- visitor_id: text (anonymous visitor tracking)
- user_id: uuid (if logged in)
- event_type: 'share_initiated' | 'case_view' | 'page_view'
- metadata: jsonb {
    share_id: string,
    case_id: string,
    share_source: 'facebook' | 'twitter' | 'linkedin',
    is_referred: boolean
  }
- created_at: timestamp
```

## Available Statistics

### Per-Case Stats
```typescript
const stats = await analyticsService.getShareStatistics(caseId);
// Returns:
{
  total_shares: number,
  total_views_from_shares: number,
  shares_by_platform: { facebook: 5, twitter: 3 },
  views_by_platform: { facebook: 15, twitter: 8 }
}
```

### Platform-Wide Stats (Admin)
```typescript
const stats = await analyticsService.getPlatformShareStats(30); // Last 30 days
// Returns:
{
  total_shares: number,
  total_referred_views: number,
  conversion_rate: number, // % of shares that led to views
  top_shared_cases: [
    { case_id, case_title, share_count, view_count }
  ],
  platform_breakdown: {
    facebook: { shares: 50, views: 150 },
    twitter: { shares: 30, views: 90 }
  }
}
```

## Viewing Statistics

### Admin Dashboard
Admin dashboard will display:
1. **Total Shares** - How many times cases were shared
2. **Referred Visitors** - How many people clicked shared links
3. **Conversion Rate** - % of shares that generated visits
4. **Top Shared Cases** - Which cases get shared most
5. **Platform Performance** - Facebook vs Twitter effectiveness

### SQL Queries

**Most shared cases:**
```sql
SELECT 
  metadata->>'case_id' as case_id,
  COUNT(*) as share_count
FROM analytics_events
WHERE event_type = 'share_initiated'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY metadata->>'case_id'
ORDER BY share_count DESC
LIMIT 10;
```

**Referred visitors by share source:**
```sql
SELECT 
  metadata->>'share_source' as platform,
  COUNT(*) as visitor_count
FROM analytics_events
WHERE event_type = 'case_view'
  AND metadata->>'is_referred' = 'true'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY metadata->>'share_source';
```

**Conversion rate (views per share):**
```sql
SELECT 
  metadata->>'share_source' as platform,
  COUNT(DISTINCT CASE WHEN event_type = 'share_initiated' THEN id END) as shares,
  COUNT(DISTINCT CASE WHEN event_type = 'case_view' AND metadata->>'is_referred' = 'true' THEN id END) as views,
  ROUND(
    100.0 * COUNT(DISTINCT CASE WHEN event_type = 'case_view' AND metadata->>'is_referred' = 'true' THEN id END) / 
    NULLIF(COUNT(DISTINCT CASE WHEN event_type = 'share_initiated' THEN id END), 0),
    2
  ) as conversion_rate
FROM analytics_events
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY metadata->>'share_source';
```

## Features

✅ **Automatic Tracking** - No manual work required  
✅ **Privacy-Friendly** - Uses anonymous visitor IDs  
✅ **Multi-Platform** - Facebook, Twitter, LinkedIn support  
✅ **Real-Time** - Data available immediately  
✅ **Conversion Tracking** - Measure share effectiveness  
✅ **Case-Level Insights** - See which cases perform best  

## Usage Example

```typescript
import { analyticsService } from './services/analyticsService';

// Track a share
const shareId = await analyticsService.trackShare({
  case_id: 'abc-123',
  share_source: 'facebook',
  sharer_id: user.id
});

// Track a page view (with auto-detection of referral)
await analyticsService.trackPageView();

// Get stats for a case
const stats = await analyticsService.getShareStatistics('abc-123');
console.log(`This case was shared ${stats.total_shares} times`);
console.log(`Generated ${stats.total_views_from_shares} referred visits`);
```

## Next Steps

To view stats in Admin Dashboard:
1. Navigate to Admin Dashboard → Analytics tab
2. New "Share Statistics" section will show:
   - Total shares and referred visitors
   - Conversion rates by platform
   - Top performing cases
   - Time-based trends

## Data Retention

Analytics data is stored indefinitely in PostgreSQL. Consider:
- Adding data archiving after 1 year
- Aggregating old data into summary tables
- Implementing GDPR-compliant data deletion

## Performance

- Uses database indexes on `created_at` and `visitor_id`
- Metadata queries use JSONB GIN indexes
- Efficient for datasets up to millions of events
