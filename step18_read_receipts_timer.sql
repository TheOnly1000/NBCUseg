-- Track who viewed tickets and comments
CREATE TABLE IF NOT EXISTS public.ticket_views (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ticket_id, user_email)
);
CREATE INDEX IF NOT EXISTS idx_ticket_views_ticket ON public.ticket_views(ticket_id);
ALTER TABLE public.ticket_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ticket_views select" ON public.ticket_views;
CREATE POLICY "ticket_views select" ON public.ticket_views FOR SELECT USING (true);
DROP POLICY IF EXISTS "ticket_views insert" ON public.ticket_views;
CREATE POLICY "ticket_views insert" ON public.ticket_views FOR INSERT WITH CHECK (user_email = COALESCE(auth.jwt() ->> 'email', ''));

-- Track who viewed comments
CREATE TABLE IF NOT EXISTS public.comment_views (
  id BIGSERIAL PRIMARY KEY,
  comment_id BIGINT NOT NULL REFERENCES public.ticket_comments(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(comment_id, user_email)
);
CREATE INDEX IF NOT EXISTS idx_comment_views_comment ON public.comment_views(comment_id);
ALTER TABLE public.comment_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comment_views select" ON public.comment_views;
CREATE POLICY "comment_views select" ON public.comment_views FOR SELECT USING (true);
DROP POLICY IF EXISTS "comment_views insert" ON public.comment_views;
CREATE POLICY "comment_views insert" ON public.comment_views FOR INSERT WITH CHECK (user_email = COALESCE(auth.jwt() ->> 'email', ''));

-- Add to realtime publication
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE ticket_views;
EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'ticket_views already in publication, skipping.';
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE comment_views;
EXCEPTION WHEN duplicate_object THEN RAISE NOTICE 'comment_views already in publication, skipping.';
END $$;

NOTIFY pgrst, 'reload schema';
