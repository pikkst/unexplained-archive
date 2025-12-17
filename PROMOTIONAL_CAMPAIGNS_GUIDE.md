# Promotional Campaign System

## Overview

A comprehensive promotional campaign management system with AI-powered content generation, enabling admins to create, manage, and track various types of marketing campaigns including free trials, discount codes, free credits, and promotional tickets.

## Features

### 🎯 Campaign Types

1. **Free Credits** - Give users free investigation credits
2. **Free Trial** - Offer time-limited free access to premium features
3. **Discount Codes** - Percentage or fixed amount discounts
4. **Free Tickets** - Complimentary investigation tickets

### 🤖 AI Content Generation

- **Gemini AI Integration** - Generate marketing copy and banner text
- **Content Types**:
  - Banner text for landing page
  - Landing page promotional text
  - Ad copy for external campaigns
  - Banner images (coming soon)

### 📊 Analytics & Tracking

- **Real-time metrics**:
  - Impressions (views)
  - Clicks (interactions)
  - Redemptions (uses)
  - Conversions (purchases)
  - Conversion rate
  - Revenue generated
  - Discount given

### 🎫 Promo Code System

- Generate unique promo codes
- Set usage limits (total and per-user)
- Configure validity periods
- Track redemptions
- Easy copy-to-clipboard functionality

### 🎯 Targeting Options

- **New Users Only** - First 7 days after registration
- **All Users** - Platform-wide campaigns
- **Investigators Only** - Verified investigators
- **First N Users** - Limited quantity (e.g., "First 100")

## Database Schema

### Tables

#### `promotional_campaigns`
Main table for campaign information:
- Campaign details (name, description, type)
- Status (draft, active, paused, completed, expired)
- Redemption limits
- Date ranges
- Benefits (credits, trials, discounts)
- Marketing content
- AI-generated content

#### `promo_codes`
Promo code management:
- Unique codes
- Usage limits (total and per-user)
- Validity periods
- Active/inactive status

#### `campaign_redemptions`
Track user redemptions:
- User who redeemed
- Campaign and promo code used
- Benefit received
- Redemption timestamp
- Expiration date
- Status

#### `campaign_analytics`
Daily analytics per campaign:
- Impressions, clicks, redemptions, conversions
- Revenue and discount metrics
- User segment breakdown

#### `campaign_ai_content`
AI-generated content log:
- Content type
- Prompt used
- Generated content
- Model used
- Quality rating
- Approval status

## Admin Interface

### Campaign Manager (`/admin` → Campaigns Tab)

#### Create Campaign
1. Click "Create Campaign"
2. Fill in basic information:
   - Name (e.g., "First 100 Users Special")
   - Description
   - Campaign type
   - Benefit amount (credits, days, discount)
   - Max redemptions
   - Start/end dates
   - Target audience
3. Add marketing content:
   - Banner text
   - Landing page text
   - CTA button text
   - Or use AI to generate content
4. Configure promo code requirement
5. Click "Create Campaign"

#### Generate AI Content
1. In campaign creation, click "Generate with AI"
2. Select content type (Banner Text, Landing Text, Ad Copy)
3. Enter prompt describing what you want
4. Click "Generate"
5. Review generated content
6. Click "Apply to Campaign" to use it

#### Manage Promo Codes
1. Click "Codes" on any campaign card
2. Enter code details:
   - Code name (e.g., "WELCOME100")
   - Max total uses
   - Max uses per user
3. Click "Create Promo Code"
4. Copy code to share with users

#### Campaign Actions
- **Launch** - Activate draft campaign
- **Pause** - Temporarily stop active campaign
- **Resume** - Reactivate paused campaign
- **Delete** - Remove campaign (also deletes codes and redemptions)

### Campaign Dashboard

View real-time statistics:
- Total impressions/views
- Click-through rate
- Redemption count
- Conversion rate
- Revenue impact

## User Experience

### Landing Page Banner

When users visit the site, they automatically see:
- Active promotional banners at top of page
- Campaign details (benefit, time remaining)
- Quick redemption option
- Or promo code input for code-required campaigns

### Redemption Flow

#### Without Promo Code:
1. User sees banner on landing page
2. Clicks "Claim Now" button
3. Benefit is instantly applied to their account
4. Success message shown
5. Page reloads to show new benefits

#### With Promo Code:
1. User sees banner "Enter Code"
2. Clicks to show code input
3. Enters promo code
4. Clicks "Apply"
5. System validates code
6. Benefit applied if valid
7. Success or error message shown

### User Eligibility

System automatically checks:
- User hasn't already redeemed this campaign
- Campaign is active and within date range
- User meets target segment criteria
- Campaign hasn't reached max redemptions
- For promo codes: code is valid and hasn't exceeded usage limits

## API Functions

### Backend Functions

#### `redeem_promo_code(p_code, p_user_id)`
Validates and redeems a promo code:
- Checks code validity and expiration
- Verifies usage limits
- Creates redemption record
- Returns benefit details or error

#### `get_user_active_benefits(p_user_id)`
Returns all active benefits for a user:
- Active redemptions
- Benefit details
- Expiration dates

#### `track_campaign_impression(p_campaign_id)`
Records when a user views a campaign banner

#### `track_campaign_click(p_campaign_id)`
Records when a user clicks on a campaign

#### `track_campaign_conversion(p_campaign_id, p_revenue, p_discount)`
Records when a campaign leads to a purchase

#### `get_campaign_dashboard_stats()`
Returns comprehensive campaign statistics for admin dashboard

## Edge Function

### `generate-campaign-content`

Gemini AI integration for content generation.

**Endpoint**: `/functions/v1/generate-campaign-content`

**Request**:
```json
{
  "prompt": "Create exciting banner text for first 100 users",
  "contentType": "banner_text",
  "campaignData": {
    "name": "First 100 Users",
    "type": "free_credits",
    "description": "Promotional offer"
  }
}
```

**Response**:
```json
{
  "content": "Generated marketing text...",
  "imageUrl": null,
  "model": "gemini-2.0-flash-exp",
  "timestamp": "2025-12-17T..."
}
```

## Setup Instructions

### 1. Database Migration

Run the migration files:
```bash
# Apply campaign tables and functions
psql -f supabase/migrations/20251217_promotional_campaigns.sql

# Apply tracking functions
psql -f supabase/migrations/20251217_campaign_tracking_functions.sql
```

Or via Supabase CLI:
```bash
supabase db push
```

### 2. Configure Gemini API

Add to your `.env` file or Supabase secrets:
```
GEMINI_API_KEY=your_gemini_api_key_here
```

Get your API key from: https://makersuite.google.com/app/apikey

### 3. Deploy Edge Function

```bash
supabase functions deploy generate-campaign-content
```

### 4. Set Function Secrets

```bash
supabase secrets set GEMINI_API_KEY=your_key_here
```

## Usage Examples

### Example 1: First 100 Users Campaign

```sql
-- Create campaign
INSERT INTO promotional_campaigns (
  name,
  description,
  campaign_type,
  status,
  max_redemptions,
  free_credits,
  target_user_segment,
  requires_code,
  banner_text,
  cta_button_text,
  start_date,
  end_date
) VALUES (
  'First 100 Users Special',
  'Be among the first 100 users and get 10 free credits!',
  'free_credits',
  'active',
  100,
  10,
  'first_100',
  false,
  '🎉 Join the first 100 users and get 10 FREE investigation credits!',
  'Claim Your Credits',
  NOW(),
  NOW() + INTERVAL '30 days'
);
```

### Example 2: New User Trial with Promo Code

1. Create campaign via admin UI:
   - Name: "New User 7-Day Trial"
   - Type: Free Trial
   - Days: 7
   - Target: New Users Only
   - Requires Code: Yes

2. Generate promo codes:
   - Code: NEWTRIAL7
   - Max uses: 1000
   - Per user: 1

3. Share code in:
   - Email campaigns
   - Social media
   - Partner websites

### Example 3: Holiday Discount

1. Create campaign:
   - Name: "Holiday Sale 2025"
   - Type: Discount
   - Discount: 25%
   - Target: All Users
   - Dates: Dec 20 - Jan 5

2. Generate AI banner:
   - Prompt: "Create festive holiday promotion banner for 25% off all services"
   - Use generated text in campaign

3. Track performance via analytics dashboard

## Marketing Strategy

### Launch Campaigns

1. **Early Adopter Program** (First 100 Users)
   - 10-20 free credits
   - No code required
   - Creates urgency

2. **New User Welcome**
   - 7-day free trial
   - Targeted to new signups
   - Helps conversion

3. **Referral Bonuses**
   - Free credits for referrals
   - Unique codes per user
   - Viral growth

### Seasonal Campaigns

- Holiday sales (25-30% off)
- New Year promotions
- Halloween mystery specials
- Summer investigation events

### Retention Campaigns

- Re-engagement for inactive users
- Upgrade discounts for free users
- Loyalty rewards for active users

## Best Practices

### Campaign Design

✅ **DO**:
- Set clear end dates to create urgency
- Use specific numbers (100, not "many")
- Test AI-generated content before using
- Monitor analytics regularly
- Set reasonable redemption limits
- Target specific user segments

❌ **DON'T**:
- Create overlapping campaigns for same segment
- Set unlimited redemptions for high-value offers
- Use vague benefit descriptions
- Forget to set end dates
- Ignore analytics data

### Promo Code Management

✅ **DO**:
- Use memorable, easy-to-type codes
- Set per-user limits to prevent abuse
- Track which codes perform best
- Retire expired codes
- Use descriptive code names (WELCOME100, HOLIDAY25)

❌ **DON'T**:
- Reuse codes from expired campaigns
- Create codes that are too complex
- Set unlimited per-user uses
- Forget to communicate expiration dates

### AI Content Generation

✅ **DO**:
- Provide detailed prompts with context
- Review and edit generated content
- Save good prompts for reuse
- Rate content quality for learning
- Include campaign details in prompt

❌ **DON'T**:
- Use AI content without review
- Rely solely on AI for all content
- Use vague prompts
- Ignore brand voice guidelines

## Troubleshooting

### Users Can't Redeem Campaign

**Check**:
1. Campaign status is "active"
2. Current date is within start/end dates
3. Max redemptions not reached
4. User meets target segment criteria
5. User hasn't already redeemed
6. For codes: code is active and valid

### AI Content Generation Fails

**Check**:
1. GEMINI_API_KEY is set correctly
2. Edge function is deployed
3. API key has sufficient quota
4. Network connectivity to Google AI

### Campaign Not Showing on Landing Page

**Check**:
1. Campaign status is "active"
2. Start date is in the past
3. End date is in the future
4. User is logged in (if required)
5. User meets target criteria
6. Campaign hasn't been dismissed by user

## ROI Tracking

Monitor campaign effectiveness:

### Key Metrics

1. **Conversion Rate** = (Conversions / Clicks) × 100
2. **Cost Per Acquisition** = Discount Given / New Users
3. **Revenue Impact** = Revenue Generated - Discount Given
4. **Engagement Rate** = Clicks / Impressions

### SQL Query for Campaign ROI

```sql
SELECT 
  pc.name,
  pc.campaign_type,
  SUM(ca.impressions) as total_impressions,
  SUM(ca.clicks) as total_clicks,
  SUM(ca.redemptions) as total_redemptions,
  SUM(ca.conversions) as total_conversions,
  SUM(ca.revenue_generated) as revenue,
  SUM(ca.discount_given) as cost,
  SUM(ca.revenue_generated) - SUM(ca.discount_given) as net_revenue,
  CASE 
    WHEN SUM(ca.clicks) > 0 
    THEN ROUND((SUM(ca.conversions)::NUMERIC / SUM(ca.clicks) * 100), 2)
    ELSE 0 
  END as conversion_rate
FROM promotional_campaigns pc
LEFT JOIN campaign_analytics ca ON ca.campaign_id = pc.id
GROUP BY pc.id, pc.name, pc.campaign_type
ORDER BY net_revenue DESC;
```

## Future Enhancements

### Planned Features

- [ ] Email campaign integration
- [ ] A/B testing for campaigns
- [ ] Advanced user segmentation
- [ ] Campaign templates
- [ ] Automated campaign scheduling
- [ ] Multi-language support
- [ ] Push notification campaigns
- [ ] Social media integration
- [ ] Referral tracking system
- [ ] Campaign performance predictions (ML)

### Image Generation

- [ ] Gemini image generation integration
- [ ] Banner design templates
- [ ] Custom brand assets
- [ ] Automated social media graphics

## Support

For issues or questions:
1. Check troubleshooting section
2. Review database logs
3. Check Supabase edge function logs
4. Verify RLS policies
5. Test with admin account first

## Security

### Row Level Security (RLS)

All tables have RLS enabled:
- Admins can manage all campaigns
- Users can view active campaigns only
- Users can view/redeem their own redemptions
- Analytics visible to admins only

### API Security

- Edge functions require authentication
- Promo code validation includes rate limiting
- User eligibility checked server-side
- No direct database access from client

## License

Part of the Unexplained Archive platform.
All rights reserved.
