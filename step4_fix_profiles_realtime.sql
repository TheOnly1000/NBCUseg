-- STEP 4: Fix profiles (add email column) + enable Realtime
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/fzbktwyurskhvtwkklzu/sql/new)

-- 1) Add email column to profiles (missing, caused handover modal "error loading")
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';

-- 2) Fix the trigger to also populate email
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

-- 3) Backfill emails for existing profiles that don't have one
UPDATE profiles p
SET email = au.email
FROM auth.users au
WHERE p.id = au.id AND (p.email IS NULL OR p.email = '');

-- 4) Grant anon read access to profiles.email (RLS already allows all SELECT)
-- The existing "profiles_select" policy already grants SELECT to all, so this is fine.

-- 5) ENABLE REALTIME for segments + notifications tables
-- supabase_realtime publication already exists by default; add tables
ALTER PUBLICATION supabase_realtime ADD TABLE segments;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
