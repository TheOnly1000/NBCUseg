-- STEP 9: Schedule & Security
-- 1) App config table for sensitive settings (stored in DB, not in HTML)
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_config_select" ON app_config;
CREATE POLICY "app_config_select" ON app_config FOR SELECT USING (auth.role() = 'authenticated');

-- 2) Schedule entries from Google Sheets + user assignments
CREATE TABLE IF NOT EXISTS schedule_entries (
    id SERIAL PRIMARY KEY,
    row_index INTEGER DEFAULT 0,
    schedule_date TEXT,
    event_type TEXT,
    series_name TEXT,
    episode_title TEXT,
    season_no TEXT,
    episode_no TEXT,
    start_time_edt TEXT,
    end_time_edt TEXT,
    start_time_ist TEXT DEFAULT '',
    end_time_ist TEXT DEFAULT '',
    sheet_asset_id TEXT DEFAULT '',
    assigned_to TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    launched_asset_id TEXT DEFAULT '',
    segment_count TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE schedule_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "schedule_select" ON schedule_entries;
DROP POLICY IF EXISTS "schedule_insert" ON schedule_entries;
DROP POLICY IF EXISTS "schedule_update" ON schedule_entries;
DROP POLICY IF EXISTS "schedule_delete" ON schedule_entries;
CREATE POLICY "schedule_select" ON schedule_entries FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "schedule_insert" ON schedule_entries FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "schedule_update" ON schedule_entries FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "schedule_delete" ON schedule_entries FOR DELETE USING (auth.role() = 'authenticated');

-- Seed app_config with defaults (update values as needed)
INSERT INTO app_config (key, value) VALUES ('google_sheet_id', '1yf8W7oDGmUlTMmRxDcgCTD8D-zHUH3lsYgZ5jVdaSXY')
ON CONFLICT (key) DO NOTHING;
INSERT INTO app_config (key, value) VALUES ('google_sheet_gid', '0')
ON CONFLICT (key) DO NOTHING;
INSERT INTO app_config (key, value) VALUES ('schedule_header_row', '4')
ON CONFLICT (key) DO NOTHING;
