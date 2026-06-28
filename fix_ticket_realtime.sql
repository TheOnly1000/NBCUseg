-- Fix: add tickets table to realtime publication + ensure all policies
-- Run the whole block at once in Supabase SQL Editor

-- Add tickets and other tables to realtime (ignore "already member" errors)
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE segments;

-- Ensure notifications insert + select policies
DROP POLICY IF EXISTS "notifications insert" ON public.notifications;
CREATE POLICY "notifications insert" ON public.notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "notifications select" ON public.notifications;
CREATE POLICY "notifications select" ON public.notifications
  FOR SELECT USING (target_email = COALESCE(auth.jwt() ->> 'email', ''));

-- Ensure tickets update policy for Raise button
DROP POLICY IF EXISTS "tickets update" ON public.tickets;
CREATE POLICY "tickets update" ON public.tickets
  FOR UPDATE USING (auth.role() = 'authenticated');
