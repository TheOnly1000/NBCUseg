-- =============================================================
-- SELF-DELETE & ADMIN-DELETE: comprehensive account deletion
-- Run ALL of this in Supabase SQL Editor
-- =============================================================

-- 1. Self-delete RLS policy on profiles (user can delete own row)
DROP POLICY IF EXISTS "self_delete_profile" ON public.profiles;
CREATE POLICY "self_delete_profile" ON public.profiles
  FOR DELETE USING (auth.uid() = id);

-- 2. SECURITY DEFINER function for a user to delete their own account
-- Deletes related data, profile row, AND auth.users entry
CREATE OR REPLACE FUNCTION public.self_delete_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  -- Get current user's email from auth (not public.profiles, which we're about to delete)
  SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Session user not found in auth.users';
  END IF;

  -- Delete user's related data
  DELETE FROM public.ticket_comments WHERE ticket_comments.user_email = v_email;
  DELETE FROM public.notifications WHERE notifications.target_email = v_email;
  DELETE FROM public.notification_reads WHERE notification_reads.user_email = v_email;
  DELETE FROM public.comment_views WHERE comment_views.user_email = v_email;
  DELETE FROM public.ticket_views WHERE ticket_views.user_email = v_email;

  -- Delete profile row (RLS self_delete_profile policy allows this)
  DELETE FROM public.profiles WHERE id = auth.uid();

  -- Delete from auth.users (requires SECURITY DEFINER)
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- 3. Updated admin_delete_user: allows self-deletion OR admin deletion
-- Admins can pass any uid; regular users can only delete themselves
CREATE OR REPLACE FUNCTION public.admin_delete_user(uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  -- Get target email
  SELECT email INTO v_email FROM auth.users WHERE id = uid;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Target user not found in auth.users';
  END IF;

  -- Self-deletion allowed
  IF auth.uid() = uid THEN
    -- Delete related data
    DELETE FROM public.ticket_comments WHERE ticket_comments.user_email = v_email;
    DELETE FROM public.notifications WHERE notifications.target_email = v_email;
    DELETE FROM public.notification_reads WHERE notification_reads.user_email = v_email;
    DELETE FROM public.comment_views WHERE comment_views.user_email = v_email;
    DELETE FROM public.ticket_views WHERE ticket_views.user_email = v_email;
    -- Delete profile
    DELETE FROM public.profiles WHERE id = uid;
    -- Delete from auth.users
    DELETE FROM auth.users WHERE id = uid;
    RETURN;
  END IF;

  -- Admin deletion of any user
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    DELETE FROM public.ticket_comments WHERE ticket_comments.user_email = v_email;
    DELETE FROM public.notifications WHERE notifications.target_email = v_email;
    DELETE FROM public.notification_reads WHERE notification_reads.user_email = v_email;
    DELETE FROM public.comment_views WHERE comment_views.user_email = v_email;
    DELETE FROM public.ticket_views WHERE ticket_views.user_email = v_email;
    DELETE FROM public.profiles WHERE id = uid;
    DELETE FROM auth.users WHERE id = uid;
    RETURN;
  END IF;

  RAISE EXCEPTION 'Only admins can delete other users';
END;
$$;
