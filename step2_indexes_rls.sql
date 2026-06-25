-- STEP 2: Indexes + RLS (safe to re-run)

CREATE INDEX IF NOT EXISTS idx_segments_asset ON segments(asset_id, year);
CREATE INDEX IF NOT EXISTS idx_segments_status ON segments(status);
CREATE INDEX IF NOT EXISTS idx_notif_target ON notifications(target_email, read);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (safe to re-run)
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "segments_select" ON segments;
DROP POLICY IF EXISTS "segments_insert" ON segments;
DROP POLICY IF EXISTS "segments_update" ON segments;
DROP POLICY IF EXISTS "segments_delete" ON segments;
DROP POLICY IF EXISTS "notif_select" ON notifications;
DROP POLICY IF EXISTS "notif_insert" ON notifications;
DROP POLICY IF EXISTS "notif_update" ON notifications;

-- RLS Policies
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (id = auth.uid());

CREATE POLICY "segments_select" ON segments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "segments_insert" ON segments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "segments_update" ON segments FOR UPDATE USING (created_by = auth.email());
CREATE POLICY "segments_delete" ON segments FOR DELETE USING (created_by = auth.email());

CREATE POLICY "notif_select" ON notifications FOR SELECT USING (target_email = auth.email());
CREATE POLICY "notif_insert" ON notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "notif_update" ON notifications FOR UPDATE USING (target_email = auth.email());
