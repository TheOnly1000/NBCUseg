-- STEP 6: Complete update - locking, unique constraints, notifications upgrade
-- Run this in Supabase SQL Editor

-- 1) Add UNIQUE constraint on (asset_id, seg) to prevent duplicate segments
-- First clean up any existing duplicates
DELETE FROM segments a USING segments b 
WHERE a.id < b.id AND a.asset_id = b.asset_id AND a.seg = b.seg;
-- Now add the constraint
ALTER TABLE segments ADD CONSTRAINT segments_asset_seg_unique UNIQUE (asset_id, seg);

-- 2) Add locked_at column (locked_by already exists from step5)
ALTER TABLE segments ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- 3) Add notification_type to notifications for better categorization
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_type TEXT DEFAULT 'notification';
-- types: 'notification', 'handover_request', 'handover_accepted', 'handover_given'

-- 4) Add from_email to notifications for direct replies
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS from_email TEXT DEFAULT '';

-- 5) Add a metadata JSONB column for extra data (optional handover chain, etc.)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 6) Update RLS for segments to allow lock management by any authenticated user
DROP POLICY IF EXISTS "segments_update" ON segments;
CREATE POLICY "segments_update" ON segments FOR UPDATE USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "segments_delete" ON segments;
CREATE POLICY "segments_delete" ON segments FOR DELETE USING (auth.role() = 'authenticated');

-- 7) Update the handle_new_user trigger to also set email
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    '',
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8) Ensure profiles table has all needed columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';

-- 9) Backfill email for existing profiles
UPDATE profiles p
SET email = au.email
FROM auth.users au
WHERE p.id = au.id AND (p.email IS NULL OR p.email = '');

-- 10) Enable realtime for profiles too (so avatar changes sync)
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
