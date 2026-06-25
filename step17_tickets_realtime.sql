-- ============================================================================
-- V13+: Add tickets/ticket_comments to realtime publication + DELETE/UPDATE RLS
-- ============================================================================
-- Run this in Supabase SQL Editor. Resolves:
--   "delete not working" (missing DELETE policy)
--   "real-time not reflecting across users" (table not in publication)

-- 1. DELETE RLS policy for tickets (creator or admin can delete)
DROP POLICY IF EXISTS "tickets delete" ON public.tickets;
CREATE POLICY "tickets delete" ON public.tickets
  FOR DELETE USING (
    created_by_email = COALESCE(auth.jwt() ->> 'email', '')
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- 2. DELETE RLS policy for ticket_comments (comment author can delete)
DROP POLICY IF EXISTS "ticket_comments delete" ON public.ticket_comments;
CREATE POLICY "ticket_comments delete" ON public.ticket_comments
  FOR DELETE USING (
    user_email = COALESCE(auth.jwt() ->> 'email', '')
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- 3. UPDATE RLS for ticket_comments (comment author can update)
DROP POLICY IF EXISTS "ticket_comments update" ON public.ticket_comments;
CREATE POLICY "ticket_comments update" ON public.ticket_comments
  FOR UPDATE USING (
    user_email = COALESCE(auth.jwt() ->> 'email', '')
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- 4. Fix ticket_comments SELECT policy to also allow reading asset-level comments
-- (The old policy only allowed comments with a matching ticket_id, blocking asset-level
--  comments where ticket_id IS NULL and asset_id is set instead.)
DROP POLICY IF EXISTS "ticket_comments read if ticket accessible" ON public.ticket_comments;
CREATE POLICY "ticket_comments read if ticket accessible" ON public.ticket_comments
  FOR SELECT USING (
    (ticket_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_comments.ticket_id))
    OR
    (asset_id IS NOT NULL AND asset_id <> '')
  );

-- 5. Add tables to supabase_realtime publication so events broadcast to all users
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'tickets already in publication, skipping.';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE ticket_comments;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'ticket_comments already in publication, skipping.';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notification_reads;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'notification_reads already in publication, skipping.';
END $$;

-- 6. Refresh schema cache
NOTIFY pgrst, 'reload schema';
