# 🔍 UNEXPLAINED ARCHIVE - Kriitilise Analüüs ja Täiustused

## ⚠️ KRIITILISED PROBLEEMID JA PUUDUSED

### 🚨 1. RAHAKOTI JA MAKSETE SÜSTEEMI PUUDUMINE

**Praegune olukord:** 
- ❌ Donation page kasutab MOCK andmeid
- ❌ Pole reaalset maksete integratsiooni
- ❌ Pole rahakotti (wallet) kasutajatele
- ❌ Pole escrow süsteemi uurijate tasude haldamiseks

**Lahendused:**

#### A. Stripe Integration (KOHUSTUSLIK)
```typescript
// Uus tabel: wallets
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) UNIQUE NOT NULL,
  balance DECIMAL(10, 2) DEFAULT 0.00 NOT NULL,
  currency TEXT DEFAULT 'EUR' NOT NULL,
  stripe_customer_id TEXT UNIQUE,
  stripe_account_id TEXT, -- For investigators receiving payouts
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT positive_balance CHECK (balance >= 0)
);

-- Uus tabel: transactions
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_wallet_id UUID REFERENCES wallets(id),
  to_wallet_id UUID REFERENCES wallets(id),
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'EUR' NOT NULL,
  type TEXT NOT NULL, -- 'deposit', 'donation', 'reward', 'subscription', 'withdrawal', 'platform_fee'
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
  case_id UUID REFERENCES cases(id),
  stripe_payment_intent_id TEXT,
  stripe_transfer_id TEXT,
  metadata JSONB, -- For storing additional data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT positive_amount CHECK (amount > 0)
);

-- Escrow for case rewards
CREATE TABLE case_escrow (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID REFERENCES cases(id) UNIQUE NOT NULL,
  total_amount DECIMAL(10, 2) DEFAULT 0.00 NOT NULL,
  locked_amount DECIMAL(10, 2) DEFAULT 0.00 NOT NULL,
  available_amount DECIMAL(10, 2) GENERATED ALWAYS AS (total_amount - locked_amount) STORED,
  currency TEXT DEFAULT 'EUR' NOT NULL,
  release_conditions JSONB, -- Terms for releasing funds
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT positive_amounts CHECK (total_amount >= 0 AND locked_amount >= 0)
);
```

#### B. Payment Flow
1. **Deposit** → User adds money via Stripe
2. **Donation to Case** → Money goes to case_escrow
3. **Investigator Assignment** → Escrow locked
4. **Solution Submitted** → User reviews
5. **Release/Dispute** → Money released or admin intervention
6. **Platform Fee** → 10-15% taken automatically

---

### 🚨 2. SUBSCRIPTION SÜSTEEM PUUDUB

**AI Tools Access for Investigators:**

```typescript
// Uus tabel: subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  plan_type TEXT NOT NULL, -- 'investigator_basic', 'investigator_pro', 'user_premium'
  status TEXT DEFAULT 'active', -- 'active', 'cancelled', 'expired', 'past_due'
  price DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'EUR' NOT NULL,
  billing_cycle TEXT DEFAULT 'monthly', -- 'monthly', 'yearly'
  stripe_subscription_id TEXT UNIQUE,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  features JSONB, -- AI tools, priority support, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI usage tracking
CREATE TABLE ai_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  feature TEXT NOT NULL, -- 'image_generation', 'analysis', 'enhancement'
  cost DECIMAL(6, 4) NOT NULL, -- API cost
  subscription_id UUID REFERENCES subscriptions(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Subscription Plans:**
- **Investigator Basic** - €10/mo: 50 AI image generations, basic analysis
- **Investigator Pro** - €25/mo: Unlimited AI tools, priority cases, advanced analytics
- **User Premium** - €5/mo: Ad-free, priority support, early access

---

### 🚨 3. TURVALISUSE AUGUD

#### A. RLS Policies Puudulikud
```sql
-- Praegu puudub proper isolation!
-- Lisa järgmised policies:

-- Wallets: Users can only see their own wallet
CREATE POLICY "Users can view own wallet"
ON wallets FOR SELECT
USING (auth.uid() = user_id);

-- Transactions: Users see only their transactions
CREATE POLICY "Users can view own transactions"
ON transactions FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM wallets WHERE id IN (from_wallet_id, to_wallet_id)
  )
);

-- Cases: Restrict sensitive data
CREATE POLICY "Hide personal data in cases"
ON cases FOR SELECT
USING (
  status != 'draft' OR user_id = auth.uid()
);

-- Prevent SQL Injection in comments
CREATE POLICY "Sanitize comment content"
ON comments FOR INSERT
WITH CHECK (
  LENGTH(content) <= 5000 AND
  content !~ '[<>]' -- Basic XSS prevention
);
```

#### B. Rate Limiting (KOHUSTUSLIK)
```typescript
// Kasuta Supabase Edge Functions + Upstash Redis
// rate-limit.ts
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export async function rateLimit(userId: string, action: string): Promise<boolean> {
  const key = `ratelimit:${action}:${userId}`;
  const limit = {
    'case_submit': { max: 10, window: 86400 }, // 10 per day
    'comment': { max: 100, window: 3600 }, // 100 per hour
    'ai_generation': { max: 50, window: 86400 }, // 50 per day (free tier)
  }[action];

  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, limit.window);
  }

  return current <= limit.max;
}
```

#### C. Content Moderation
```typescript
// Automatic spam/abuse detection
CREATE TABLE moderation_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_type TEXT NOT NULL, -- 'case', 'comment', 'profile'
  content_id UUID NOT NULL,
  reason TEXT NOT NULL,
  flagged_by UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'pending', -- 'pending', 'reviewed', 'actioned'
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Automatic flagging for suspicious patterns
CREATE OR REPLACE FUNCTION flag_suspicious_content()
RETURNS TRIGGER AS $$
BEGIN
  -- Check for spam keywords
  IF NEW.content ~* '(viagra|casino|crypto|invest now|click here)' THEN
    INSERT INTO moderation_flags (content_type, content_id, reason)
    VALUES (TG_TABLE_NAME, NEW.id, 'Spam keywords detected');
  END IF;
  
  -- Check for excessive caps
  IF LENGTH(REGEXP_REPLACE(NEW.content, '[^A-Z]', '', 'g')) > LENGTH(NEW.content) * 0.5 THEN
    INSERT INTO moderation_flags (content_type, content_id, reason)
    VALUES (TG_TABLE_NAME, NEW.id, 'Excessive caps lock');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

### 🚨 4. RAHAPESU VÄLTIMINE (AML/KYC)

**KOHUSTUSLIK EU regulatsioonide järgi!**

```typescript
// KYC verification table
CREATE TABLE kyc_verification (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  verification_level INTEGER DEFAULT 0, -- 0: none, 1: basic, 2: advanced
  documents JSONB, -- Encrypted references to ID documents
  stripe_verification_id TEXT,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transaction limits based on verification
CREATE TABLE transaction_limits (
  user_id UUID REFERENCES profiles(id) PRIMARY KEY,
  daily_limit DECIMAL(10, 2) DEFAULT 100.00, -- €100 for unverified
  monthly_limit DECIMAL(10, 2) DEFAULT 500.00, -- €500 for unverified
  daily_spent DECIMAL(10, 2) DEFAULT 0.00,
  monthly_spent DECIMAL(10, 2) DEFAULT 0.00,
  last_reset_daily TIMESTAMPTZ DEFAULT NOW(),
  last_reset_monthly TIMESTAMPTZ DEFAULT NOW()
);

-- Verified users: €5000 daily, €50000 monthly
-- Automatic flagging for suspicious patterns
```

**Stripe Identity Integration:**
```typescript
// Kasuta Stripe Identity API
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function verifyUser(userId: string) {
  const session = await stripe.identity.verificationSessions.create({
    type: 'document',
    metadata: { user_id: userId }
  });
  return session.url; // Redirect user to verify
}
```

---

### 🚨 5. ADMIN KONTROLLI PUUDUSED

```sql
-- Admin audit log (KOHUSTUSLIK)
CREATE TABLE admin_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES profiles(id) NOT NULL,
  action_type TEXT NOT NULL, -- 'ban_user', 'verify_investigator', 'release_escrow'
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT,
  metadata JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin permissions table
CREATE TABLE admin_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES profiles(id) NOT NULL,
  permission TEXT NOT NULL, -- 'moderate_content', 'manage_funds', 'verify_users'
  granted_by UUID REFERENCES profiles(id),
  granted_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 💡 KASUTAJATE MEELITAMINE & KOGUKONNA KASV

### 1. Gamification
```typescript
// Achievements system
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  points INTEGER DEFAULT 0,
  rarity TEXT DEFAULT 'common' -- 'common', 'rare', 'epic', 'legendary'
);

CREATE TABLE user_achievements (
  user_id UUID REFERENCES profiles(id),
  achievement_id UUID REFERENCES achievements(id),
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, achievement_id)
);

-- Examples:
-- "First Case" - Submit your first case (10 points)
-- "Eagle Eye" - Find evidence in 5 cases (50 points)
-- "Truth Seeker" - Solve 10 cases (100 points)
-- "Legend" - Reach 1000 reputation (500 points)
```

### 2. Referral Program
```typescript
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID REFERENCES profiles(id) NOT NULL,
  referee_id UUID REFERENCES profiles(id) NOT NULL,
  reward_amount DECIMAL(10, 2) DEFAULT 5.00, -- €5 for both
  status TEXT DEFAULT 'pending', -- 'pending', 'completed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referrer gets €5 when referee makes first deposit
-- Referee gets €5 welcome bonus
```

### 3. Weekly Challenges
```typescript
CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  challenge_type TEXT NOT NULL, -- 'solve_cases', 'submit_evidence', 'help_community'
  target INTEGER NOT NULL,
  reward_amount DECIMAL(10, 2),
  reward_reputation INTEGER,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL
);

-- "Weekend Detective" - Analyze 3 cases this weekend
-- "Community Helper" - Get 50 upvotes on your comments
```

### 4. Social Features
```typescript
-- User badges/flair
CREATE TABLE user_badges (
  user_id UUID REFERENCES profiles(id),
  badge_text TEXT NOT NULL,
  badge_color TEXT DEFAULT '#6366f1',
  badge_icon TEXT,
  earned_at TIMESTAMPTZ DEFAULT NOW()
);

-- Case collaborations
CREATE TABLE case_collaborators (
  case_id UUID REFERENCES cases(id),
  user_id UUID REFERENCES profiles(id),
  role TEXT, -- 'researcher', 'analyst', 'fact_checker'
  contribution TEXT,
  PRIMARY KEY (case_id, user_id)
);
```

---

## 💰 KASUMI TEENIMISE MUDELID

### 1. Platform Fee (PEAMINE TULU)
- **10-15% from all donations** to case rewards
- **5% from investigator payouts**
- **3% withdrawal fee** (minimum €1)

### 2. Subscription Revenue
- Investigator Basic: €10/mo × 1000 users = **€10,000/mo**
- Investigator Pro: €25/mo × 200 users = **€5,000/mo**
- User Premium: €5/mo × 500 users = **€2,500/mo**
- **Total: €17,500/mo = €210,000/year**

### 3. Featured Cases (Premium Placement)
```typescript
CREATE TABLE featured_cases (
  case_id UUID REFERENCES cases(id) PRIMARY KEY,
  featured_until TIMESTAMPTZ NOT NULL,
  price_paid DECIMAL(10, 2) NOT NULL, -- €50-200 for 7 days
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0
);
```
- €50-200 per week for homepage placement

### 4. Advertising (Ethical)
- **Targeted ads** for paranormal/investigation equipment
- €500-2000/mo from relevant advertisers

### 5. Data/API Access (Future)
- Research institutions: €500/mo for API access
- Documentary makers: €1000 for case data exports

**Estimated Total Revenue:**
- Platform fees: €5,000-10,000/mo
- Subscriptions: €17,500/mo
- Featured cases: €1,000/mo
- Ads: €1,000/mo
- **Total: €24,500-29,500/mo = €294,000-354,000/year**

---

## 🛡️ TURVALISUSE CHECKLIST (LAUNCH READY)

### KOHUSTUSLIK:
- [ ] RLS policies all tables
- [ ] Rate limiting (Upstash Redis)
- [ ] Input sanitization (DOMPurify)
- [ ] CAPTCHA on registration
- [ ] Email verification mandatory
- [ ] 2FA for admin accounts
- [ ] Stripe webhook verification
- [ ] GDPR compliance (data export)
- [ ] Cookie consent banner
- [ ] Terms of Service + Privacy Policy
- [ ] Content moderation system
- [ ] KYC for €500+ monthly transactions
- [ ] Automated backup (daily)
- [ ] Error logging (Sentry)
- [ ] SSL certificate (automatic via GitHub Pages)

### RECOMMENDED:
- [ ] CDN for media (Cloudflare)
- [ ] DDoS protection
- [ ] IP-based geoblocking (high-risk countries)
- [ ] Automated abuse detection (ML)
- [ ] Regular security audits
- [ ] Bug bounty program

---

## 📋 DEPLOYMENT BLOCKERS (FIX BEFORE LAUNCH)

### ❌ CRITICAL ISSUES:
1. **NO PAYMENT SYSTEM** → Integrate Stripe (2-3 days)
2. **NO WALLET SYSTEM** → Create wallet tables + UI (2 days)
3. **NO SUBSCRIPTION SYSTEM** → Implement subscription logic (2 days)
4. **INCOMPLETE RLS** → Add all security policies (1 day)
5. **NO KYC** → Add Stripe Identity (1 day)
6. **NO RATE LIMITING** → Setup Upstash Redis (0.5 days)
7. **NO TERMS/PRIVACY** → Write legal docs (1 day) OR use template
8. **NO ADMIN DASHBOARD** → Complete admin features (2 days)
9. **MOCK DATA IN DONATION PAGE** → Remove + connect real (1 day)
10. **NO EMAIL NOTIFICATIONS** → Setup Supabase Auth emails (0.5 days)

**TOTAL TIME TO LAUNCH: ~13-15 DAYS**

---

## 🎯 PRIORITY ROADMAP

### Phase 1: LAUNCH BLOCKERS (Week 1-2)
1. Stripe integration + Wallets
2. Subscription system
3. Security (RLS + Rate limiting)
4. Legal docs (T&C, Privacy Policy)

### Phase 2: CORE FEATURES (Week 3-4)
1. Admin dashboard completion
2. KYC verification
3. Escrow system for cases
4. Email notifications

### Phase 3: GROWTH (Month 2)
1. Gamification
2. Referral program
3. Mobile optimization
4. Social sharing

### Phase 4: MONETIZATION (Month 3+)
1. Featured cases marketplace
2. API access
3. Advanced analytics
4. Partnership deals

