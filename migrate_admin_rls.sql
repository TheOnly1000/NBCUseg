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

-- 4. storage.objects (thumbnails bucket): SELECT is public (needed for thumbnail display)
DROP POLICY IF EXISTS "admin_select_thumbnails" ON storage.objects;
CREATE POLICY "admin_select_thumbnails" ON storage.objects
  FOR SELECT USING (bucket_id = 'thumbnails');

-- 5. storage.objects (thumbnails bucket): admins can INSERT
DROP POLICY IF EXISTS "admin_insert_thumbnails" ON storage.objects;
CREATE POLICY "admin_insert_thumbnails" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'thumbnails'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- 6. storage.objects (thumbnails bucket): admins can UPDATE (needed for upsert)
DROP POLICY IF EXISTS "admin_update_thumbnails" ON storage.objects;
CREATE POLICY "admin_update_thumbnails" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'thumbnails'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- 7. storage.objects (thumbnails bucket): admins can DELETE (thumbnail cleanup on asset delete)
DROP POLICY IF EXISTS "admin_delete_thumbnails" ON storage.objects;
CREATE POLICY "admin_delete_thumbnails" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'thumbnails'
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- 8. SECURITY DEFINER function to delete a user from auth.users (bypasses RLS)
-- NOTE: Admin check is inside the function body — anyone who calls it must be admin.
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
