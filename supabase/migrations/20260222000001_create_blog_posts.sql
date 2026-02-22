-- Blog Posts table for draft/scheduled content (Supabase layer of hybrid blog)
-- Static MDX files in /content/blog/ handle permanent SEO posts
-- This table handles drafts, scheduled posts, and dynamic content

CREATE TABLE blog_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    content TEXT NOT NULL,              -- Markdown body
    author TEXT DEFAULT 'Apelier',
    category TEXT DEFAULT 'General',
    tags TEXT[] DEFAULT '{}',
    image_url TEXT,                      -- Hero image
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
    publish_at TIMESTAMPTZ,             -- Scheduled publish date (NULL = manual publish)
    published_at TIMESTAMPTZ,           -- Actual publish timestamp
    seo_title TEXT,
    seo_description TEXT,
    reading_time INT DEFAULT 5,
    featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_blog_posts_publish_at ON blog_posts(publish_at) WHERE status = 'scheduled';

-- Allow public read access for published posts
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published blog posts"
    ON blog_posts FOR SELECT
    USING (status = 'published' AND (published_at IS NOT NULL AND published_at <= NOW()));

-- Service role can do everything (for ClawBot API access)
CREATE POLICY "Service role full access"
    ON blog_posts FOR ALL
    USING (true)
    WITH CHECK (true);

-- Auto-publish scheduled posts (run via Supabase cron or Edge Function)
-- This function checks for posts past their publish_at date and publishes them
CREATE OR REPLACE FUNCTION publish_scheduled_posts()
RETURNS void AS $$
BEGIN
    UPDATE blog_posts
    SET status = 'published',
        published_at = NOW(),
        updated_at = NOW()
    WHERE status = 'scheduled'
      AND publish_at IS NOT NULL
      AND publish_at <= NOW();
END;
$$ LANGUAGE plpgsql;
