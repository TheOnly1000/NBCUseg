-- =============================================================
-- SELF-DELETE: allow users to delete their own account
-- Run in Supabase SQL Editor
-- =============================================================

-- 1. Self-delete RLS policy on profiles (user can delete own row)
DROP POLICY IF EXISTS "self_delete_profile" ON public.profiles;
CREATE POLICY "self_delete_profile" ON public.profiles
  FOR DELETE USING (auth.uid() = id);

-- 2. Updated admin_delete_user: allows self-deletion OR admin deletion
CREATE OR REPLACE FUNCTION public.admin_delete_user(uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = uid THEN
    DELETE FROM auth.users WHERE id = uid;
  ELSIF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    DELETE FROM auth.users WHERE id = uid;
  ELSE
    RAISE EXCEPTION 'Only admins can delete other users';
  END IF;
END;
$$;
