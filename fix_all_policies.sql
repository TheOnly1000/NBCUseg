-- Run ALL of these in order (policies are silently dropped if missing)
-- This fixes: notifications not inserting, tickets not updating/deleting

-- Notifications INSERT + SELECT policies
DROP POLICY IF EXISTS "notifications insert" ON public.notifications;
CREATE POLICY "notifications insert" ON public.notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "notifications select" ON public.notifications;
CREATE POLICY "notifications select" ON public.notifications
  FOR SELECT USING (target_email = COALESCE(auth.jwt() ->> 'email', ''));

-- Tickets DELETE + UPDATE policies
DROP POLICY IF EXISTS "tickets delete" ON public.tickets;
CREATE POLICY "tickets delete" ON public.tickets
  FOR DELETE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "tickets update" ON public.tickets;
CREATE POLICY "tickets update" ON public.tickets
  FOR UPDATE USING (auth.role() = 'authenticated');
