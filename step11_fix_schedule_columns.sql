-- STEP 11: Add missing columns to schedule_entries
-- Run this in Supabase SQL Editor (safe to re-run)

-- sheet_asset_id is referenced by the JS code but missing from some DB instances
ALTER TABLE schedule_entries ADD COLUMN IF NOT EXISTS sheet_asset_id TEXT DEFAULT '';
