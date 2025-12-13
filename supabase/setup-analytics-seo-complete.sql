-- =============================================
-- COMPLETE ANALYTICS & SEO SYSTEM SETUP
-- Creates all necessary tables, policies, and sample data
-- Run this to make analytics and SEO fully functional
-- =============================================

-- =============================================
-- 1. ANALYTICS TRACKING TABLES
-- =============================================

-- Analytics events table (if not exists)
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('page_view', 'click', 'form_submit', 'download', 'search', 'custom')),
  page_path TEXT NOT NULL,
  page_title TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  device_type TEXT CHECK (device_type IN ('mobile', 'tablet', 'desktop')),
  browser TEXT,
  os TEXT,
  screen_resolution TEXT,
  language TEXT,
  ip_address INET,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure legacy analytics_events tables are upgraded to include required columns
DO $$
BEGIN
  -- Add session_id column if it is missing
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'analytics_events'
      AND column_name = 'session_id'
  ) THEN
    ALTER TABLE analytics_events ADD COLUMN session_id TEXT;
  END IF;

  -- Add visitor_id column if it is missing
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'analytics_events'
      AND column_name = 'visitor_id'
  ) THEN
    ALTER TABLE analytics_events ADD COLUMN visitor_id TEXT;
  END IF;

  -- Add page_title column if it is missing
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'analytics_events'
      AND column_name = 'page_title'
  ) THEN
    ALTER TABLE analytics_events ADD COLUMN page_title TEXT;
  END IF;

  -- Add referrer column if it is missing
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'analytics_events'
      AND column_name = 'referrer'
  ) THEN
    ALTER TABLE analytics_events ADD COLUMN referrer TEXT;
  END IF;

  -- Add UTM columns if they are missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'utm_source'
  ) THEN
    ALTER TABLE analytics_events ADD COLUMN utm_source TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'utm_medium'
  ) THEN
    ALTER TABLE analytics_events ADD COLUMN utm_medium TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'utm_campaign'
  ) THEN
    ALTER TABLE analytics_events ADD COLUMN utm_campaign TEXT;
  END IF;

  -- Add geo/device/info columns if they are missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'country'
  ) THEN
    ALTER TABLE analytics_events ADD COLUMN country TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'region'
  ) THEN
    ALTER TABLE analytics_events ADD COLUMN region TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'city'
  ) THEN
    ALTER TABLE analytics_events ADD COLUMN city TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'device_type'
  ) THEN
    ALTER TABLE analytics_events ADD COLUMN device_type TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'browser'
  ) THEN
    ALTER TABLE analytics_events ADD COLUMN browser TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'os'
  ) THEN
    ALTER TABLE analytics_events ADD COLUMN os TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'screen_resolution'
  ) THEN
    ALTER TABLE analytics_events ADD COLUMN screen_resolution TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'language'
  ) THEN
    ALTER TABLE analytics_events ADD COLUMN language TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'ip_address'
  ) THEN
    ALTER TABLE analytics_events ADD COLUMN ip_address INET;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE analytics_events ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE analytics_events ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics_events' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE analytics_events ADD COLUMN created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;
  END IF;
END $$;

-- Indexes for analytics_events
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor_id ON analytics_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_page_path ON analytics_events(page_path);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_country ON analytics_events(country);

-- Daily analytics stats (aggregated)
CREATE TABLE IF NOT EXISTS analytics_daily_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE NOT NULL,
  total_page_views INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  avg_session_duration INTERVAL,
  bounce_rate DECIMAL(5, 2),
  top_pages JSONB DEFAULT '[]',
  top_referrers JSONB DEFAULT '[]',
  top_countries JSONB DEFAULT '[]',
  device_breakdown JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_stats_date ON analytics_daily_stats(date DESC);

-- =============================================
-- 2. BLOG & CONTENT MANAGEMENT
-- =============================================

-- Blog articles table
CREATE TABLE IF NOT EXISTS blog_articles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  featured_image TEXT,
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  category TEXT,
  tags TEXT[],
  seo_keywords TEXT,
  meta_description TEXT,
  published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP WITH TIME ZONE,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure legacy blog_articles tables are upgraded to include required columns
ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS excerpt TEXT;
ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS featured_image TEXT;
ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS seo_keywords TEXT;
ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS meta_description TEXT;
ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT FALSE;
ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;
ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;
ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;
ALTER TABLE blog_articles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;

-- Indexes for blog_articles
CREATE INDEX IF NOT EXISTS idx_blog_articles_slug ON blog_articles(slug);
CREATE INDEX IF NOT EXISTS idx_blog_articles_published ON blog_articles(published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_articles_category ON blog_articles(category);
CREATE INDEX IF NOT EXISTS idx_blog_articles_tags ON blog_articles USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_blog_articles_author_id ON blog_articles(author_id);

-- Blog comments table
CREATE TABLE IF NOT EXISTS blog_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  article_id UUID REFERENCES blog_articles(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES blog_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  flagged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_blog_comments_article_id ON blog_comments(article_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_comments_user_id ON blog_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_blog_comments_parent_id ON blog_comments(parent_id);

-- =============================================
-- 3. SEO RANKINGS TRACKING
-- =============================================

-- SEO rankings table
CREATE TABLE IF NOT EXISTS seo_rankings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  keyword TEXT NOT NULL,
  search_engine TEXT NOT NULL CHECK (search_engine IN ('google', 'bing', 'duckduckgo', 'yandex')),
  ranking_position INTEGER,
  page_url TEXT NOT NULL,
  country TEXT DEFAULT 'US',
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(keyword, search_engine, country, date)
);

CREATE INDEX IF NOT EXISTS idx_seo_rankings_keyword ON seo_rankings(keyword, date DESC);
CREATE INDEX IF NOT EXISTS idx_seo_rankings_date ON seo_rankings(date DESC);
CREATE INDEX IF NOT EXISTS idx_seo_rankings_search_engine ON seo_rankings(search_engine);

-- =============================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_rankings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Admins can view all analytics" ON analytics_events;
DROP POLICY IF EXISTS "Anyone can insert analytics" ON analytics_events;
DROP POLICY IF EXISTS "Admins can view daily stats" ON analytics_daily_stats;
DROP POLICY IF EXISTS "Anyone can view published articles" ON blog_articles;
DROP POLICY IF EXISTS "Admins can insert articles" ON blog_articles;
DROP POLICY IF EXISTS "Admins can update articles" ON blog_articles;
DROP POLICY IF EXISTS "Admins can delete articles" ON blog_articles;
DROP POLICY IF EXISTS "Anyone can view comments on published articles" ON blog_comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON blog_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON blog_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON blog_comments;
DROP POLICY IF EXISTS "Admins can manage SEO rankings" ON seo_rankings;

-- Analytics Events: Allow inserts from anyone (for tracking), read for admins only
CREATE POLICY "Anyone can insert analytics"
  ON analytics_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all analytics"
  ON analytics_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Analytics Daily Stats: Admin only
CREATE POLICY "Admins can manage daily stats"
  ON analytics_daily_stats FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Blog Articles: Public read for published, admins can do everything
CREATE POLICY "Anyone can view published articles"
  ON blog_articles FOR SELECT
  USING (
    published = TRUE OR 
    auth.uid() IN (
      SELECT id FROM profiles WHERE role = 'admin'
    )
  );

CREATE POLICY "Admins can insert articles"
  ON blog_articles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update articles"
  ON blog_articles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete articles"
  ON blog_articles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Blog Comments: Public read, authenticated create, own update/delete
CREATE POLICY "Anyone can view comments on published articles"
  ON blog_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM blog_articles
      WHERE blog_articles.id = blog_comments.article_id
      AND blog_articles.published = TRUE
    )
  );

CREATE POLICY "Authenticated users can create comments"
  ON blog_comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own comments"
  ON blog_comments FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments or admins can delete any"
  ON blog_comments FOR DELETE
  USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- SEO Rankings: Admin only
CREATE POLICY "Admins can manage SEO rankings"
  ON seo_rankings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- =============================================
-- 5. TRIGGERS & FUNCTIONS
-- =============================================

-- Auto-update updated_at timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to relevant tables
DROP TRIGGER IF EXISTS update_analytics_daily_stats_updated_at ON analytics_daily_stats;
CREATE TRIGGER update_analytics_daily_stats_updated_at
  BEFORE UPDATE ON analytics_daily_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_blog_articles_updated_at ON blog_articles;
CREATE TRIGGER update_blog_articles_updated_at
  BEFORE UPDATE ON blog_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_blog_comments_updated_at ON blog_comments;
CREATE TRIGGER update_blog_comments_updated_at
  BEFORE UPDATE ON blog_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 6. SAMPLE DATA FOR TESTING (OPTIONAL)
-- =============================================

-- Insert sample analytics events (last 7 days)
DO $$
DECLARE
  v_date DATE;
  v_visitor_id TEXT;
  v_session_id TEXT;
  i INTEGER;
BEGIN
  -- Only insert if table is empty
  IF NOT EXISTS (SELECT 1 FROM analytics_events LIMIT 1) THEN
    FOR i IN 1..100 LOOP
      v_visitor_id := 'visitor_' || (random() * 1000)::integer;
      v_session_id := 'session_' || (random() * 500)::integer;
      v_date := CURRENT_DATE - (random() * 7)::integer;
      
      INSERT INTO analytics_events (
        visitor_id, session_id, event_type, page_path, page_title,
        referrer, country, device_type, language, created_at
      ) VALUES (
        v_visitor_id,
        v_session_id,
        'page_view',
        CASE (random() * 5)::integer
          WHEN 0 THEN '/'
          WHEN 1 THEN '/explore'
          WHEN 2 THEN '/cases/some-case-id'
          WHEN 3 THEN '/forum'
          ELSE '/map'
        END,
        'Unexplained Archive',
        CASE (random() * 4)::integer
          WHEN 0 THEN 'direct'
          WHEN 1 THEN 'google.com'
          WHEN 2 THEN 'reddit.com'
          ELSE 'twitter.com'
        END,
        CASE (random() * 5)::integer
          WHEN 0 THEN 'US'
          WHEN 1 THEN 'UK'
          WHEN 2 THEN 'CA'
          WHEN 3 THEN 'AU'
          ELSE 'EE'
        END,
        CASE (random() * 3)::integer
          WHEN 0 THEN 'desktop'
          WHEN 1 THEN 'mobile'
          ELSE 'tablet'
        END,
        'en',
        v_date + (random() * interval '24 hours')
      );
    END LOOP;
    
    RAISE NOTICE 'Inserted 100 sample analytics events';
  END IF;
END $$;

-- Insert sample SEO rankings
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM seo_rankings LIMIT 1) THEN
    INSERT INTO seo_rankings (keyword, search_engine, ranking_position, page_url, country, date) VALUES
    ('unexplained mysteries', 'google', 15, '/', 'US', CURRENT_DATE),
    ('paranormal cases', 'google', 23, '/explore', 'US', CURRENT_DATE),
    ('ufo sightings', 'google', 8, '/explore?category=ufo', 'US', CURRENT_DATE),
    ('cryptid database', 'google', 42, '/explore?category=cryptozoology', 'US', CURRENT_DATE),
    ('ghost evidence', 'bing', 12, '/explore?category=paranormal', 'US', CURRENT_DATE),
    ('unexplained phenomena', 'duckduckgo', 6, '/', 'US', CURRENT_DATE);
    
    RAISE NOTICE 'Inserted 6 sample SEO rankings';
  END IF;
END $$;

-- Insert sample blog article
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM blog_articles LIMIT 1) THEN
    INSERT INTO blog_articles (title, slug, content, published, published_at) VALUES
    (
      'Top 10 Most Mysterious UFO Encounters of 2024',
      'top-10-ufo-encounters-2024',
      E'# Top 10 Most Mysterious UFO Encounters of 2024\n\nThis year has been extraordinary for UFO sightings around the world. From credible military witnesses to civilian footage, the evidence continues to mount.\n\n## 1. The Phoenix Lights Redux\n\nIn March 2024, Phoenix Arizona witnessed another mass sighting...\n\n## 2. Baltic Sea Anomaly\n\nResearchers investigating the Baltic Sea discovered...\n\n[Continue with more content...]',
      true,
      NOW()
    );
    
    RAISE NOTICE 'Inserted 1 sample blog article';
  END IF;
END $$;

-- =============================================
-- 7. VERIFICATION
-- =============================================

-- Show table counts
DO $$
DECLARE
  v_analytics_count INTEGER;
  v_seo_count INTEGER;
  v_articles_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_analytics_count FROM analytics_events;
  SELECT COUNT(*) INTO v_seo_count FROM seo_rankings;
  SELECT COUNT(*) INTO v_articles_count FROM blog_articles;
  
  RAISE NOTICE '=== Analytics & SEO System Setup Complete ===';
  RAISE NOTICE 'Analytics Events: % records', v_analytics_count;
  RAISE NOTICE 'SEO Rankings: % records', v_seo_count;
  RAISE NOTICE 'Blog Articles: % records', v_articles_count;
  RAISE NOTICE '============================================';
END $$;
