-- =============================================================
-- SELF-DELETE & ADMIN-DELETE: comprehensive account deletion
-- Run ALL of this in Supabase SQL Editor
-- =============================================================

-- 0. REPAIR: strip "(Deleted)" from schedule_entries.assigned_to
-- (previous version broke the Launch button by marking the email field)
UPDATE public.schedule_entries
  SET assigned_to = REPLACE(assigned_to, ' (Deleted)', '')
  WHERE assigned_to LIKE '% (Deleted)';

-- 1. Self-delete RLS policy on profiles (user can delete own row)
DROP POLICY IF EXISTS "self_delete_profile" ON public.profiles;
CREATE POLICY "self_delete_profile" ON public.profiles
  FOR DELETE USING (auth.uid() = id);

-- 2. SECURITY DEFINER function for a user to delete their own account
-- Preserves assets, segments, tickets, schedule entries but marks
-- display-name fields with (Deleted). Does NOT touch assigned_to (email field).
CREATE OR REPLACE FUNCTION public.self_delete_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_name text;
BEGIN
  -- Get current user's email and display name from auth
  SELECT email,
    COALESCE(raw_user_meta_data->>'name', SPLIT_PART(email, '@', 1))
  INTO v_email, v_name
  FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Session user not found in auth.users';
  END IF;

  -- Mark assets (created_by stores display name or email)
  UPDATE public.assets
    SET created_by = v_name || ' (Deleted)'
    WHERE LOWER(created_by) IN (LOWER(v_name), LOWER(v_email));

  -- Mark segments and release locks
  UPDATE public.segments
    SET created_by = v_name || ' (Deleted)',
        locked_by = NULL,
        locked_at = NULL
    WHERE LOWER(created_by) IN (LOWER(v_name), LOWER(v_email));
  UPDATE public.segments
    SET locked_by = NULL,
        locked_at = NULL
    WHERE LOWER(locked_by) = LOWER(v_email);

  -- Mark tickets
  UPDATE public.tickets
    SET created_by_name = v_name || ' (Deleted)'
    WHERE LOWER(created_by_name) = LOWER(v_name)
       OR LOWER(created_by_email) = LOWER(v_email);

  -- Delete user's related data (comments, notifications, views)
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
-- Same display-name marking logic; does NOT touch assigned_to (email field).
CREATE OR REPLACE FUNCTION public.admin_delete_user(uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_name text;
BEGIN
  -- Get target email and display name
  SELECT email,
    COALESCE(raw_user_meta_data->>'name', SPLIT_PART(email, '@', 1))
  INTO v_email, v_name
  FROM auth.users WHERE id = uid;
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Target user not found in auth.users';
  END IF;

  -- Mark assets
  UPDATE public.assets
    SET created_by = v_name || ' (Deleted)'
    WHERE LOWER(created_by) IN (LOWER(v_name), LOWER(v_email));

  -- Mark segments and release locks
  UPDATE public.segments
    SET created_by = v_name || ' (Deleted)',
        locked_by = NULL,
        locked_at = NULL
    WHERE LOWER(created_by) IN (LOWER(v_name), LOWER(v_email));
  UPDATE public.segments
    SET locked_by = NULL,
        locked_at = NULL
    WHERE LOWER(locked_by) = LOWER(v_email);

  -- Mark tickets
  UPDATE public.tickets
    SET created_by_name = v_name || ' (Deleted)'
    WHERE LOWER(created_by_name) = LOWER(v_name)
       OR LOWER(created_by_email) = LOWER(v_email);

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
END;
$$;
