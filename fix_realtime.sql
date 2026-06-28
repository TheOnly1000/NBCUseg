-- Fix realtime: ensure all tables in publication + proper RLS policies

-- Re-add all tables that need realtime (safe, duplicates are ignored)
ALTER PUBLICATION supabase_realtime ADD TABLE segments;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE schedule_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE ticket_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE notification_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE ticket_views;
ALTER PUBLICATION supabase_realtime ADD TABLE comment_views;
ALTER PUBLICATION supabase_realtime ADD TABLE asset_thumbnails;

-- Notifications SELECT policy (needed for realtime channel filter to work)
DROP POLICY IF EXISTS "notifications select" ON public.notifications;
CREATE POLICY "notifications select" ON public.notifications
  FOR SELECT USING (target_email = COALESCE(auth.jwt() ->> 'email', ''));

-- Notifications INSERT policy
DROP POLICY IF EXISTS "notifications insert" ON public.notifications;
CREATE POLICY "notifications insert" ON public.notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Tickets DELETE policy (often blocks deletion silently)
DROP POLICY IF EXISTS "tickets delete" ON public.tickets;
CREATE POLICY "tickets delete" ON public.tickets
  FOR DELETE USING (auth.role() = 'authenticated');

-- Tickets UPDATE policy
DROP POLICY IF EXISTS "tickets update" ON public.tickets;
CREATE POLICY "tickets update" ON public.tickets
  FOR UPDATE USING (auth.role() = 'authenticated');
