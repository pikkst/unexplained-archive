-- =============================================
-- FORUM TABLES
-- =============================================

-- Forum Threads Table
CREATE TABLE IF NOT EXISTS forum_threads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  is_pinned BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,
  views INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Forum Comments Table
CREATE TABLE IF NOT EXISTS forum_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  thread_id UUID REFERENCES forum_threads(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES forum_comments(id) ON DELETE CASCADE,
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================
-- INDEXES for better performance
-- =============================================
CREATE INDEX IF NOT EXISTS idx_forum_threads_user_id ON forum_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_threads_category ON forum_threads(category);
CREATE INDEX IF NOT EXISTS idx_forum_threads_created_at ON forum_threads(created_at);
CREATE INDEX IF NOT EXISTS idx_forum_threads_pinned ON forum_threads(is_pinned);
CREATE INDEX IF NOT EXISTS idx_forum_comments_thread_id ON forum_comments(thread_id);
CREATE INDEX IF NOT EXISTS idx_forum_comments_user_id ON forum_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_forum_comments_parent_id ON forum_comments(parent_id);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to increment forum thread views
CREATE OR REPLACE FUNCTION increment_forum_thread_views(thread_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE forum_threads
  SET views = views + 1
  WHERE id = thread_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TRIGGERS
-- =============================================

-- Triggers to auto-update updated_at
CREATE TRIGGER update_forum_threads_updated_at BEFORE UPDATE ON forum_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_forum_comments_updated_at BEFORE UPDATE ON forum_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS
ALTER TABLE forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_comments ENABLE ROW LEVEL SECURITY;

-- Forum threads policies
CREATE POLICY "Forum threads are viewable by everyone" 
  ON forum_threads FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create forum threads" 
  ON forum_threads FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own forum threads" 
  ON forum_threads FOR UPDATE USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('investigator', 'admin')
  ));

CREATE POLICY "Users can delete own forum threads" 
  ON forum_threads FOR DELETE USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Forum comments policies
CREATE POLICY "Forum comments are viewable by everyone" 
  ON forum_comments FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create forum comments" 
  ON forum_comments FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own forum comments" 
  ON forum_comments FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own forum comments" 
  ON forum_comments FOR DELETE USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));
