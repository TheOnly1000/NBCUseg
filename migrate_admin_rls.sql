-- Run this in Supabase SQL Editor to enable admin operations via the authenticated sb client
-- These policies allow users with role='admin' in profiles to manage other users and upload thumbnails

-- 1. Allow admins to UPDATE any profile (users can already update their own)
DROP POLICY IF EXISTS "admin_update_profiles" ON public.profiles;
CREATE POLICY "admin_update_profiles" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 2. Allow admins to DELETE profiles
DROP POLICY IF EXISTS "admin_delete_profiles" ON public.profiles;
CREATE POLICY "admin_delete_profiles" ON public.profiles
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. Allow admins to INSERT/UPSERT asset_thumbnails (if RLS is enabled on this table)
DROP POLICY IF EXISTS "admin_manage_thumbnails" ON public.asset_thumbnails;
CREATE POLICY "admin_manage_thumbnails" ON public.asset_thumbnails
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 4. Allow admins to upload files to the thumbnails storage bucket
DROP POLICY IF EXISTS "admin_upload_thumbnails" ON storage.objects;
CREATE POLICY "admin_upload_thumbnails" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'thumbnails'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
