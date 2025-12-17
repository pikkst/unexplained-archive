# Facebook Sharing Feature Documentation

## Overview
This document describes the Facebook sharing functionality added to the Unexplained Archive platform, allowing users to share cases and articles on Facebook.

## Features Added

### 1. Case Sharing (CaseDetail Component)
- **Location**: `src/components/CaseDetail.tsx`
- **Feature**: Share button added to case detail pages
- **Functionality**: 
  - Users can click the "Share" button to share the case on Facebook
  - Opens Facebook's share dialog in a new window
  - Shares the direct URL to the case: `/cases/:id`

#### Implementation Details:
```typescript
const handleShareOnFacebook = () => {
  const caseUrl = `${window.location.origin}/cases/${caseData.id}`;
  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(caseUrl)}`;
  window.open(facebookShareUrl, '_blank', 'width=600,height=400');
};
```

#### UI Placement:
The Share button is added alongside other case actions (Follow, Save, Export) in a responsive grid layout:
- Desktop: 4-column grid showing all actions
- Tablet: 2-column grid
- Mobile: Single column layout

### 2. Article Detail Page & Sharing
- **New Component**: `src/components/ArticleDetail.tsx`
- **Route**: `/articles/:slug`
- **Features**:
  - View published blog articles
  - Like articles
  - Share articles on Facebook
  - Track article views
  - Display article metadata (views, likes, publish date, keywords)

#### Article Sharing Implementation:
```typescript
const handleShareOnFacebook = () => {
  const articleUrl = `${window.location.origin}/articles/${article.slug}`;
  const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}`;
  window.open(facebookShareUrl, '_blank', 'width=600,height=400');
};
```

### 3. Admin Dashboard Enhancement
- **Location**: `src/components/AdminDashboard.tsx`
- **Feature**: "View" button added to article management
- **Functionality**: Admins can now view published articles in the new ArticleDetail page

### 4. Open Graph Meta Tags
- **Location**: `index.html`
- **Purpose**: Proper Facebook preview when sharing links
- **Tags Added**:
  - `og:type` - Website type
  - `og:url` - Site URL
  - `og:title` - Site title
  - `og:description` - Site description
  - `og:image` - Preview image
  - Twitter card metadata for cross-platform sharing

## User Experience

### Sharing a Case:
1. Navigate to any case detail page (`/cases/:id`)
2. Scroll to the action buttons section
3. Click the "Share" button with the Share2 icon
4. Facebook share dialog opens in a popup window
5. User can add a comment and post to their Facebook feed

### Sharing an Article:
1. Navigate to an article page (`/articles/:slug`)
2. Read the article content
3. Click the "Share on Facebook" button at the bottom
4. Facebook share dialog opens in a popup window
5. User can add a comment and post to their Facebook feed

### Admin Workflow:
1. Admin creates/publishes articles in Admin Dashboard
2. Click "View" button to preview the article
3. Article opens in new tab with full detail view
4. Share button available for testing/verification

## Technical Details

### Dependencies:
- No new external libraries required
- Uses existing `lucide-react` for Share2 icon
- Facebook's native sharing API via URL parameters

### Browser Compatibility:
- Works in all modern browsers
- Opens in popup window (600x400px)
- Falls back to new tab if popup is blocked

### Security Considerations:
- URL encoding prevents injection attacks
- Uses Facebook's official sharing endpoint
- No API keys or tokens required
- Client-side only implementation

## Testing Checklist

- [x] Code compiles successfully
- [x] Build process completes without errors
- [x] Share button appears on case detail pages
- [x] Share button appears on article detail pages
- [x] Facebook share URL is correctly formatted
- [ ] Manual test: Click share button on a case
- [ ] Manual test: Click share button on an article
- [ ] Verify Open Graph tags render correctly on Facebook
- [ ] Test on mobile devices
- [ ] Test with different browsers

## Future Enhancements

Potential improvements for future iterations:
1. Add share buttons for other platforms (Twitter, LinkedIn, WhatsApp)
2. Add native share API for mobile devices
3. Track share analytics
4. Add custom Facebook App ID for better analytics
5. Implement server-side rendering for dynamic OG tags per case/article
6. Add copy-to-clipboard functionality for sharing links

## Files Modified

1. `src/components/CaseDetail.tsx` - Added Share2 icon import and share functionality
2. `src/components/ArticleDetail.tsx` - New component for article detail pages
3. `src/App.tsx` - Added article route and import
4. `src/components/AdminDashboard.tsx` - Added "View" button for articles
5. `index.html` - Added Open Graph and Twitter meta tags

## Rollback Instructions

To remove this feature:
1. Revert changes to `CaseDetail.tsx` (remove Share2 import and share button)
2. Delete `src/components/ArticleDetail.tsx`
3. Remove article route from `src/App.tsx`
4. Revert changes to `AdminDashboard.tsx`
5. Remove Open Graph meta tags from `index.html` (optional)
