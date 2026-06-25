-- STEP 7: Add metadata JSONB column to segments table
ALTER TABLE segments ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
