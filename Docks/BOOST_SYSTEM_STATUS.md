# Boost System - Current Status & Implementation Plan

## Current Status: ⚠️ PARTIALLY IMPLEMENTED

### ✅ What Works
- **Purchase flow**: Users can buy boosts via wallet or Stripe
- **Database**: Tables exist (`featured_cases`, `boost_pricing`)
- **Backend**: RPC function `purchase_case_boost` works
- **Analytics tracking**: `impressions` and `clicks` columns exist
- **Pricing tiers**: Three tiers available (24h €5, 7d €15, 30d €50)

### ❌ What's Missing (NOT IMPLEMENTED)
1. **No visual display of boosted cases** - ExploreCases.tsx doesn't show boosted cases differently
2. **No homepage featuring** - LandingPage.tsx shows regular cases, not boosted ones
3. **No "pin to top" functionality** - Boosted cases don't appear first in listings
4. **No badge/highlight** - No visual indicator that a case is boosted
5. **No analytics tracking** - `trackImpression()` and `trackClick()` are never called
6. **No newsletter integration** - Feature mentioned but not built
7. **No social media promotion** - Feature mentioned but not built

## Problem: Duplicate Pricing Systems

You currently have TWO conflicting boost pricing systems:

### System A (Old - setup-premium-services.sql)
```
€5.00  - 24h   - Pin to top, Homepage highlight
€15.00 - 7d    - Pin to top, Homepage highlight, Newsletter
€50.00 - 30d   - Pin to top, Homepage banner, Newsletter, Social media
```

### System B (New - fix-featured-cases-schema.sql)  
```
€4.99  - basic_24h    - Featured 24h, 3x visibility, Priority search
€12.99 - premium_72h  - Featured 72h, 5x visibility, Priority search, Border
€24.99 - ultra_168h   - Featured 1 week, 10x visibility, Top priority, Badge
```

**Recommendation**: Use **System A** (simpler, clearer durations: 24h/7d/30d)

## Immediate Fixes Needed

### 1. Run Database Migrations (IN ORDER)
```bash
# Step 1: Fix table schema
fix-featured-cases-schema.sql

# Step 2: Unify pricing (removes duplicates)
fix-boost-pricing-unified.sql
```

### 2. Implement Frontend Display

The boost system is **useless** until the UI actually shows boosted cases! Need to add:

#### A. ExploreCases.tsx - Show boosted cases at top
```tsx
// Fetch boosted cases separately
const { data: boostedCases } = await boostService.getActiveBoostedCases();

// Sort: boosted first, then regular
const sortedCases = [
  ...boostedCases,
  ...regularCases.filter(c => !boostedIds.includes(c.id))
];

// Add boost badge visual
{case.is_boosted && (
  <div className="absolute top-2 right-2 bg-yellow-500 text-black px-2 py-1 rounded text-xs font-bold">
    ⚡ BOOSTED
  </div>
)}
```

#### B. LandingPage.tsx - Show only boosted in "Featured"
```tsx
// Instead of showing random cases, show boosted ones
const featuredCases = await boostService.getActiveBoostedCases();
```

#### C. CaseCard.tsx - Visual highlight for boosted
```tsx
<div className={`case-card ${isBoosted ? 'ring-2 ring-yellow-500 shadow-yellow-500/20' : ''}`}>
  {isBoosted && <Badge>⚡ Featured</Badge>}
</div>
```

### 3. Implement Analytics Tracking

#### A. Track impressions when case shown
```tsx
// In ExploreCases.tsx - when case enters viewport
useEffect(() => {
  if (isInViewport && case.is_boosted) {
    boostService.trackImpression(case.id);
  }
}, [isInViewport]);
```

#### B. Track clicks when case opened
```tsx
// In handleCaseClick
if (case.is_boosted) {
  await boostService.trackClick(caseId);
}
navigate(`/cases/${caseId}`);
```

### 4. Add Boost Analytics Dashboard

Create a page for case owners to see:
- Total impressions
- Total clicks
- Click-through rate (CTR)
- Money spent vs. engagement
- Time remaining on boost

## Features Listed But NOT Built

### High Priority (Should build)
1. ✅ Pin to top - Easy, just sort boosted cases first
2. ✅ Homepage highlight - Easy, show boosted in featured section
3. ✅ Analytics - Medium, need tracking + dashboard

### Low Priority (Can wait)
4. ❌ Newsletter feature - Needs email system built first
5. ❌ Social media promotion - Manual process, not automated
6. ❌ Homepage banner - Need banner UI component

## Realistic Feature List

Here's what boosted cases **should actually get** with current infrastructure:

### 24 Hour Boost (€5)
- ✅ Pin to top of all case listings
- ✅ Yellow "⚡ Boosted" badge
- ✅ Shown in "Featured Cases" on homepage
- ✅ Basic analytics (impressions, clicks)

### 7 Day Boost (€15)
- ✅ Everything from 24h
- ✅ Highlighted border (yellow glow)
- ✅ "🔥 Hot Case" badge
- ✅ Priority in search results
- ✅ Enhanced analytics dashboard

### 30 Day Boost (€50)
- ✅ Everything from 7d
- ✅ Larger card size (2x width on grid)
- ✅ "⭐ Premium" badge
- ✅ Detailed analytics with charts
- ✅ Priority support for case owner

## Next Steps

1. **Database**: Run `fix-boost-pricing-unified.sql`
2. **Frontend**: Implement boosted case display in ExploreCases
3. **Frontend**: Show boosted cases in LandingPage "Featured" section
4. **Frontend**: Add visual badges/highlights for boosted cases
5. **Analytics**: Add impression/click tracking
6. **Dashboard**: Create boost analytics page for case owners

## Estimated Implementation Time
- Database fixes: 5 minutes (just run SQL)
- Frontend display: 2-3 hours
- Analytics tracking: 1 hour
- Analytics dashboard: 3-4 hours
- **Total: ~7-8 hours of development**

## Current State Summary

❌ **Users can BUY boosts, but get ZERO benefit** because:
- Boosted cases don't appear differently
- Boosted cases don't rank higher
- No visual indicators exist
- No analytics are tracked

This needs to be fixed ASAP or remove the boost feature entirely until properly implemented.
