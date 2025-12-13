-- =============================================
-- ANALYTICS & CONTENT MANAGEMENT SYSTEM
-- Setup for admin dashboard analytics and blog
-- =============================================

-- =============================================
-- ANALYTICS TRACKING
-- =============================================

-- Analytics events table for tracking website traffic
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  visitor_id TEXT NOT NULL, -- Anonymous visitor ID (cookie/fingerprint)
  session_id TEXT NOT NULL, -- Session identifier
  event_type TEXT NOT NULL CHECK (event_type IN ('page_view', 'click', 'form_submit', 'download', 'search', 'custom')),
  page_path TEXT NOT NULL,
  page_title TEXT,
  referrer TEXT, -- Where the visitor came from
  utm_source TEXT, -- Marketing campaign source
  utm_medium TEXT, -- Marketing campaign medium
  utm_campaign TEXT, -- Marketing campaign name
  country TEXT, -- Visitor country
  region TEXT, -- Visitor region/state
  city TEXT, -- Visitor city
  device_type TEXT CHECK (device_type IN ('mobile', 'tablet', 'desktop')),
  browser TEXT,
  os TEXT,
  screen_resolution TEXT,
  language TEXT,
  ip_address INET, -- For geo-location (anonymize if needed for GDPR)
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- If logged in
  metadata JSONB DEFAULT '{}', -- Additional custom data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor_id ON analytics_events(visitor_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_page_path ON analytics_events(page_path);
CREATE INDEX IF NOT EXISTS idx_analytics_events_referrer ON analytics_events(referrer);
CREATE INDEX IF NOT EXISTS idx_analytics_events_country ON analytics_events(country);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events(event_type);

-- Daily aggregated analytics for faster reporting
CREATE TABLE IF NOT EXISTS analytics_daily_stats (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE NOT NULL,
  total_page_views INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  avg_session_duration INTERVAL,
  bounce_rate DECIMAL(5, 2), -- Percentage
  top_pages JSONB DEFAULT '[]', -- Array of {page, views}
  top_referrers JSONB DEFAULT '[]', -- Array of {referrer, count}
  top_countries JSONB DEFAULT '[]', -- Array of {country, count}
  device_breakdown JSONB DEFAULT '{}', -- {mobile: X, tablet: Y, desktop: Z}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_daily_stats_date ON analytics_daily_stats(date DESC);

-- =============================================
-- BLOG & CONTENT MANAGEMENT
-- =============================================

-- Blog articles for SEO and content marketing
CREATE TABLE IF NOT EXISTS blog_articles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- URL-friendly version of title
  content TEXT NOT NULL, -- Article content (supports Markdown)
  excerpt TEXT, -- Short summary for previews
  featured_image TEXT, -- URL to featured image
  author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  category TEXT, -- e.g., 'paranormal', 'cryptozoology', 'ufo', 'guides'
  tags TEXT[], -- Array of tags
  seo_keywords TEXT, -- Comma-separated keywords for SEO
  meta_description TEXT, -- SEO meta description
  published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMP WITH TIME ZONE,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for blog
CREATE INDEX IF NOT EXISTS idx_blog_articles_slug ON blog_articles(slug);
CREATE INDEX IF NOT EXISTS idx_blog_articles_published ON blog_articles(published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_articles_category ON blog_articles(category);
CREATE INDEX IF NOT EXISTS idx_blog_articles_tags ON blog_articles USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_blog_articles_author_id ON blog_articles(author_id);

-- Blog comments
CREATE TABLE IF NOT EXISTS blog_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  article_id UUID REFERENCES blog_articles(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES blog_comments(id) ON DELETE CASCADE, -- For nested replies
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
-- SEO MONITORING
-- =============================================

-- Track search engine rankings for key terms
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

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_rankings ENABLE ROW LEVEL SECURITY;

-- Analytics: Only admins can read/write
CREATE POLICY "Admins can view all analytics"
  ON analytics_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert analytics"
  ON analytics_events FOR INSERT
  WITH CHECK (true); -- Allow anonymous tracking

CREATE POLICY "Admins can view daily stats"
  ON analytics_daily_stats FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Blog Articles: Public can read published, admins can do everything
CREATE POLICY "Anyone can view published articles"
  ON blog_articles FOR SELECT
  USING (published = TRUE OR auth.uid() IN (
    SELECT id FROM profiles WHERE role = 'admin'
  ));

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

-- Blog Comments: Users can read all, create their own, update/delete their own
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

CREATE POLICY "Users can delete their own comments"
  ON blog_comments FOR DELETE
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

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
-- FUNCTIONS & TRIGGERS
-- =============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_analytics_daily_stats_updated_at
  BEFORE UPDATE ON analytics_daily_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blog_articles_updated_at
  BEFORE UPDATE ON blog_articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blog_comments_updated_at
  BEFORE UPDATE ON blog_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Increment article views
CREATE OR REPLACE FUNCTION increment_article_views(article_uuid UUID)
RETURNS void AS $$
BEGIN
  UPDATE blog_articles
  SET views = views + 1
  WHERE id = article_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- SAMPLE DATA (Optional - for testing)
-- =============================================

-- Insert sample blog article
INSERT INTO blog_articles (title, slug, content, excerpt, category, tags, seo_keywords, meta_description, published, published_at)
VALUES (
  'The Unexplained Phoenix Lights of 1997',
  'phoenix-lights-1997-unexplained-ufo-sighting',
  '# The Phoenix Lights: A Mass UFO Sighting

On March 13, 1997, thousands of people in Phoenix, Arizona witnessed a series of lights in the sky...

## What Happened?

The Phoenix Lights consisted of two separate events...

## Witness Testimonies

Over 10,000 witnesses reported seeing...',
  'Explore one of the most well-documented mass UFO sightings in history - the Phoenix Lights of 1997.',
  'ufo',
  ARRAY['ufo', 'phoenix lights', 'mass sighting', '1997'],
  'phoenix lights, ufo sighting, mass ufo event, 1997, arizona',
  'The Phoenix Lights UFO sighting of 1997 remains one of the most documented unexplained aerial phenomena events in history with over 10,000 witnesses.',
  TRUE,
  NOW()
) ON CONFLICT DO NOTHING;

-- =============================================
-- GRANTS
-- =============================================

-- Grant necessary permissions
GRANT SELECT ON analytics_events TO authenticated, anon;
GRANT INSERT ON analytics_events TO authenticated, anon;
GRANT ALL ON analytics_daily_stats TO authenticated;
GRANT ALL ON blog_articles TO authenticated;
GRANT ALL ON blog_comments TO authenticated;
GRANT ALL ON seo_rankings TO authenticated;

-- =============================================
-- COMPLETION MESSAGE
-- =============================================

DO $$ 
BEGIN
  RAISE NOTICE 'Analytics and Content Management setup complete!';
  RAISE NOTICE '✓ Analytics events tracking';
  RAISE NOTICE '✓ Daily analytics aggregation';
  RAISE NOTICE '✓ Blog articles with SEO';
  RAISE NOTICE '✓ Blog comments system';
  RAISE NOTICE '✓ SEO rankings monitoring';
  RAISE NOTICE '✓ RLS policies configured';
END $$;
