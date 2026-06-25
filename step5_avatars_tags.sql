-- STEP 5: Add created_by_email, locked_by, tags columns
-- Run this in Supabase SQL Editor

ALTER TABLE segments ADD COLUMN IF NOT EXISTS created_by_email TEXT DEFAULT '';
ALTER TABLE segments ADD COLUMN IF NOT EXISTS locked_by TEXT DEFAULT '';
ALTER TABLE segments ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT '';

-- Update RLS: allow lock management
DROP POLICY IF EXISTS "segments_update" ON segments;
CREATE POLICY "segments_update" ON segments FOR UPDATE USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "segments_delete" ON segments;
CREATE POLICY "segments_delete" ON segments FOR DELETE USING (auth.role() = 'authenticated');
