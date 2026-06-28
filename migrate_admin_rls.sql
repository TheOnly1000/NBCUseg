-- Run ALL of these in Supabase SQL Editor (copy-paste the whole block)

-- 1. Profiles: admins can UPDATE any profile (users already update their own)
DROP POLICY IF EXISTS "admin_update_profiles" ON public.profiles;
CREATE POLICY "admin_update_profiles" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 2. Profiles: admins can DELETE profiles
DROP POLICY IF EXISTS "admin_delete_profiles" ON public.profiles;
CREATE POLICY "admin_delete_profiles" ON public.profiles
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. asset_thumbnails: admins can INSERT/UPDATE
DROP POLICY IF EXISTS "admin_manage_thumbnails" ON public.asset_thumbnails;
CREATE POLICY "admin_manage_thumbnails" ON public.asset_thumbnails
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 4. storage.objects (thumbnails bucket): admins can SELECT (needed for upsert check)
DROP POLICY IF EXISTS "admin_select_thumbnails" ON storage.objects;
CREATE POLICY "admin_select_thumbnails" ON storage.objects
  FOR SELECT USING (bucket_id = 'thumbnails');

-- 5. storage.objects (thumbnails bucket): admins can INSERT
DROP POLICY IF EXISTS "admin_insert_thumbnails" ON storage.objects;
CREATE POLICY "admin_insert_thumbnails" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'thumbnails');

-- 6. storage.objects (thumbnails bucket): admins can UPDATE (needed for upsert)
DROP POLICY IF EXISTS "admin_update_thumbnails" ON storage.objects;
CREATE POLICY "admin_update_thumbnails" ON storage.objects
  FOR UPDATE USING (bucket_id = 'thumbnails');
