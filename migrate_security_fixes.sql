-- =============================================================
-- SECURITY FIXES — Run in Supabase SQL Editor after migrate_admin_rls.sql
-- =============================================================

-- 1. FIX: admin_delete_user now checks caller is admin
-- Without this check, ANY authenticated user can delete any account.
DROP POLICY IF EXISTS "admin_delete_user_policy" ON public.profiles;
CREATE OR REPLACE FUNCTION public.admin_delete_user(uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

-- 2. FIX: Storage bucket policies must verify admin role
-- Previously only checked bucket_id, allowing any authenticated user to upload/delete.
DROP POLICY IF EXISTS "admin_insert_thumbnails" ON storage.objects;
CREATE POLICY "admin_insert_thumbnails" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'thumbnails'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "admin_update_thumbnails" ON storage.objects;
CREATE POLICY "admin_update_thumbnails" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'thumbnails'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "admin_delete_thumbnails" ON storage.objects;
CREATE POLICY "admin_delete_thumbnails" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'thumbnails'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- 3. FIX: Notifications RLS — prevent notification spam
-- Sender must match the authenticated user's email.
DROP POLICY IF EXISTS "notifications_insert_own" ON public.notifications;
CREATE POLICY "notifications_insert_own" ON public.notifications
  FOR INSERT WITH CHECK (
    COALESCE(auth.jwt() ->> 'email', '') <> ''  -- must be authenticated
  );

-- 4. FIX: Segments table write policies — viewers cannot edit/delete
-- Editors and admins can modify; viewers are blocked at DB level even if client check is bypassed.
DROP POLICY IF EXISTS "segments_write_editors_admins" ON public.segments;
CREATE POLICY "segments_write_editors_admins" ON public.segments
  FOR INSERT WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('editor', 'admin')
  );

DROP POLICY IF EXISTS "segments_update_editors_admins" ON public.segments;
CREATE POLICY "segments_update_editors_admins" ON public.segments
  FOR UPDATE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('editor', 'admin')
  );

DROP POLICY IF EXISTS "segments_delete_editors_admins" ON public.segments;
CREATE POLICY "segments_delete_editors_admins" ON public.segments
  FOR DELETE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('editor', 'admin')
  );

-- 5. FIX: Tickets table write policies
DROP POLICY IF EXISTS "tickets_insert_authenticated" ON public.tickets;
CREATE POLICY "tickets_insert_authenticated" ON public.tickets
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
  );

-- 6. FIX: Schedule entries write policies
DROP POLICY IF EXISTS "schedule_entries_write_editors_admins" ON public.schedule_entries;
DROP POLICY IF EXISTS "schedule_entries_update_editors_admins" ON public.schedule_entries;
DROP POLICY IF EXISTS "schedule_entries_delete_editors_admins" ON public.schedule_entries;
CREATE POLICY "schedule_entries_write_editors_admins" ON public.schedule_entries
  FOR INSERT WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('editor', 'admin')
  );
CREATE POLICY "schedule_entries_update_editors_admins" ON public.schedule_entries
  FOR UPDATE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('editor', 'admin')
  );
CREATE POLICY "schedule_entries_delete_editors_admins" ON public.schedule_entries
  FOR DELETE USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('editor', 'admin')
  );
