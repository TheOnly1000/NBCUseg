-- STEP 8: Asset thumbnails - cache Wikipedia image URLs by title
CREATE TABLE IF NOT EXISTS asset_thumbnails (
    title TEXT PRIMARY KEY,
    thumbnail_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE asset_thumbnails ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "thumbnails_select" ON asset_thumbnails;
CREATE POLICY "thumbnails_select" ON asset_thumbnails FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "thumbnails_insert" ON asset_thumbnails;
CREATE POLICY "thumbnails_insert" ON asset_thumbnails FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "thumbnails_update" ON asset_thumbnails;
CREATE POLICY "thumbnails_update" ON asset_thumbnails FOR UPDATE USING (auth.role() = 'authenticated');
