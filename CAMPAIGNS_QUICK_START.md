# Quick Start: Promotional Campaigns

## 🚀 5-Minute Setup

### Step 1: Apply Database Migrations

```bash
cd /workspaces/unexplained-archive

# Option A: Using Supabase CLI
supabase db push

# Option B: Manual SQL execution
psql $DATABASE_URL -f supabase/migrations/20251217_promotional_campaigns.sql
psql $DATABASE_URL -f supabase/migrations/20251217_campaign_tracking_functions.sql
```

### Step 2: Configure Gemini API

1. Get your API key: https://makersuite.google.com/app/apikey
2. Add to Supabase secrets:

```bash
supabase secrets set GEMINI_API_KEY=your_key_here
```

Or add to your `.env`:
```
GEMINI_API_KEY=your_gemini_api_key
```

### Step 3: Deploy Edge Function

```bash
cd supabase/functions
supabase functions deploy generate-campaign-content
```

### Step 4: Test the System

1. Log in as admin
2. Navigate to Admin Dashboard → Campaigns tab
3. Click "Create Campaign"
4. Fill in:
   - Name: "Test Campaign"
   - Type: Free Credits
   - Credits: 5
   - Target: All Users
   - Banner Text: "🎉 Test Promotion!"
5. Click "Create Campaign"
6. Click "Launch" to activate

### Step 5: Verify on Landing Page

1. Log out
2. Visit landing page
3. You should see the promotional banner at the top
4. Click "Claim Now"
5. Check that credits are added to your account

## 🎯 Create Your First Real Campaign

### Example: "First 100 Users" Campaign

1. **Create Campaign**:
   ```
   Name: First 100 Users Special
   Type: Free Credits
   Free Credits: 10
   Max Redemptions: 100
   Target: First 100
   Banner Text: 🎉 Be one of the first 100 users - Get 10 FREE investigation credits!
   CTA: Claim Your Free Credits
   Start Date: Now
   End Date: +30 days
   Requires Code: No
   ```

2. **Launch Campaign**:
   - Click "Launch" button
   - Campaign goes live immediately

3. **Monitor Performance**:
   - Watch redemption counter
   - Track conversion rate
   - View analytics dashboard

### Example: "New User Trial" with Promo Code

1. **Create Campaign**:
   ```
   Name: New User 7-Day Trial
   Type: Free Trial
   Trial Days: 7
   Target: New Users Only
   Requires Code: Yes
   Banner Text: 🚀 Start your free 7-day trial - No credit card required!
   CTA: Enter Code
   ```

2. **Create Promo Codes**:
   - Click "Codes" button
   - Code: NEWTRIAL7
   - Max Uses: 1000
   - Per User: 1
   - Click "Create Promo Code"

3. **Share Code**:
   - Copy code
   - Share via email, social media, partners
   - Track redemptions in dashboard

## 🤖 Using AI Content Generation

1. During campaign creation, click "Generate with AI"
2. Select content type (Banner Text, Landing Text, Ad Copy)
3. Enter prompt:
   ```
   Create an exciting promotional banner for first-time users 
   offering 10 free investigation credits. Make it urgent and 
   compelling, highlighting the mystery-solving aspect of our 
   platform.
   ```
4. Click "Generate"
5. Review output
6. Click "Apply to Campaign"

## 📊 View Campaign Analytics

Go to Campaign Manager to see:
- Real-time redemption counts
- Impression/click statistics
- Conversion rates
- Revenue impact
- Per-campaign performance

## 🎫 Managing Promo Codes

### Create Code:
1. Open campaign
2. Click "Codes"
3. Enter code details
4. Set usage limits
5. Click "Create"

### Share Code:
- Click copy icon to copy to clipboard
- Share via your marketing channels
- Users enter at checkout or on landing page

### Monitor Usage:
- See current uses vs. max uses
- Track per-user redemption limits
- View active/inactive status

## ⚙️ Common Campaign Types

### 1. Welcome Bonus
```
Type: Free Credits
Amount: 5-10 credits
Target: New Users
Duration: First 7 days after signup
Code Required: No
```

### 2. Limited Time Offer
```
Type: Discount
Amount: 20% off
Target: All Users
Duration: 3 days
Code Required: Yes (urgency)
```

### 3. Referral Reward
```
Type: Free Credits
Amount: 5 credits per referral
Target: All Users
Code Required: Yes (unique per user)
```

### 4. Seasonal Sale
```
Type: Discount
Amount: 25% off
Target: All Users
Duration: Holiday period
Code Required: No
```

## 🔧 Troubleshooting

### Campaign Not Showing?
- Check status is "active"
- Verify dates are correct
- Confirm user meets target criteria
- Clear browser cache

### Promo Code Not Working?
- Verify code is active
- Check usage limits not exceeded
- Confirm validity dates
- Check user hasn't already used it

### AI Generation Failing?
- Verify GEMINI_API_KEY is set
- Check edge function is deployed
- Test API key has quota
- Review edge function logs

## 📈 Marketing Tips

### Create Urgency:
- Set limited redemptions (First 100!)
- Use short time periods (24-48 hours)
- Show remaining slots in banner

### Target Effectively:
- New users: Onboarding offers
- All users: Re-engagement campaigns
- Investigators: Professional upgrades
- First N: Viral launch campaigns

### Test and Iterate:
- Start with small campaigns
- Monitor conversion rates
- A/B test different messages
- Adjust based on analytics

## 🎉 You're Ready!

Your promotional campaign system is now live and ready to drive user acquisition and engagement. Start with small test campaigns and scale up as you learn what works best for your audience.

## 📚 Need More Help?

See full documentation: [PROMOTIONAL_CAMPAIGNS_GUIDE.md](./PROMOTIONAL_CAMPAIGNS_GUIDE.md)
