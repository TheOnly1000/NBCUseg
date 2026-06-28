-- Ensure notifications table works with realtime and RLS
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Allow any authenticated user to insert notifications
CREATE POLICY "notifications insert" ON public.notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
