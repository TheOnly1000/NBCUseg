-- STEP 10: Add unique constraint for schedule_entries upsert support
-- Run this in Supabase SQL Editor (safe to re-run)

-- 1) Add schedule_entries to the realtime publication (safe to re-run)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE schedule_entries;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'schedule_entries already in publication, skipping.';
END $$;

-- 2) Add unique constraint on (row_index, schedule_date) for upsert support
-- First clean up any duplicates
DELETE FROM schedule_entries a USING schedule_entries b
WHERE a.id < b.id AND a.row_index = b.row_index AND a.schedule_date = b.schedule_date;

-- Add constraint (safe to re-run)
DO $$
BEGIN
  ALTER TABLE schedule_entries ADD CONSTRAINT schedule_entries_row_date_unique UNIQUE (row_index, schedule_date);
EXCEPTION WHEN duplicate_table THEN
  RAISE NOTICE 'Constraint already exists, skipping.';
WHEN duplicate_object THEN
  RAISE NOTICE 'Constraint already exists, skipping.';
END $$;
