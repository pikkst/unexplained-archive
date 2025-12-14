-- Add additional SEO metrics columns to seo_rankings table
-- These columns will store Google Search Console data

-- Add clicks column
ALTER TABLE seo_rankings 
ADD COLUMN IF NOT EXISTS clicks INTEGER DEFAULT 0;

-- Add impressions column
ALTER TABLE seo_rankings 
ADD COLUMN IF NOT EXISTS impressions INTEGER DEFAULT 0;

-- Add CTR (Click-Through Rate) column
ALTER TABLE seo_rankings 
ADD COLUMN IF NOT EXISTS ctr DECIMAL(5,2) DEFAULT 0.00;

-- Add unique constraint to prevent duplicates
ALTER TABLE seo_rankings 
DROP CONSTRAINT IF EXISTS seo_rankings_unique_entry;

ALTER TABLE seo_rankings 
ADD CONSTRAINT seo_rankings_unique_entry 
UNIQUE (keyword, page_url, search_engine, country, date);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_seo_rankings_date 
ON seo_rankings(date DESC);

CREATE INDEX IF NOT EXISTS idx_seo_rankings_position 
ON seo_rankings(ranking_position ASC);

-- Add comment
COMMENT ON COLUMN seo_rankings.clicks IS 'Number of clicks from Google Search Console';
COMMENT ON COLUMN seo_rankings.impressions IS 'Number of impressions from Google Search Console';
COMMENT ON COLUMN seo_rankings.ctr IS 'Click-through rate (percentage) from Google Search Console';
