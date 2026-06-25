-- ============================================================================
-- V13: Roles, Audit Logs, Tickets, Read Receipts
-- ============================================================================

-- 1. ADD ROLE TO PROFILES
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'viewer';

-- 2. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  asset_id TEXT DEFAULT '',
  details TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient querying by date range
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_email ON public.audit_logs(user_email);

-- Auto-cleanup function: delete audit logs older than 7 days (configurable)
CREATE OR REPLACE FUNCTION cleanup_audit_logs(retention_days INT DEFAULT 7)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM public.audit_logs WHERE created_at < now() - (retention_days || ' days')::INTERVAL;
END;
$$;

-- Schedule cleanup daily via pg_cron if available, otherwise run manually
-- SELECT cron.schedule('cleanup-audit-logs', '0 3 * * *', 'SELECT cleanup_audit_logs(7);');

-- 3. TICKETS TABLE
CREATE TABLE IF NOT EXISTS public.tickets (
  id BIGSERIAL PRIMARY KEY,
  ticket_id TEXT NOT NULL UNIQUE, -- e.g. TCK-0001
  asset_id TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  body TEXT DEFAULT '',
  created_by_email TEXT NOT NULL,
  created_by_name TEXT NOT NULL DEFAULT '',
  assigned_to_email TEXT DEFAULT '',
  assigned_to_name TEXT DEFAULT '',
  target_email TEXT DEFAULT '', -- recipient for personal tickets
  visibility TEXT NOT NULL DEFAULT 'everyone', -- 'personal' or 'everyone'
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'resolved', 'closed'
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT DEFAULT '',
  closed_at TIMESTAMPTZ,
  closed_by TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_tickets_asset_id ON public.tickets(asset_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON public.tickets(assigned_to_email);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON public.tickets(created_by_email);

-- 4. TICKET COMMENTS
CREATE TABLE IF NOT EXISTS public.ticket_comments (
  id BIGSERIAL PRIMARY KEY,
  ticket_id BIGINT REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  user_name TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  mentions TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON public.ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_at ON public.ticket_comments(created_at);

-- 5. NOTIFICATION READ RECEIPTS
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_count INT DEFAULT 0;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS notification_type TEXT DEFAULT 'info';

-- 6. ADD NEW V13 FIELDS TO SEGMENTS
ALTER TABLE public.segments ADD COLUMN IF NOT EXISTS artist TEXT DEFAULT '';
ALTER TABLE public.segments ADD COLUMN IF NOT EXISTS song TEXT DEFAULT '';
ALTER TABLE public.segments ADD COLUMN IF NOT EXISTS label TEXT DEFAULT '';
ALTER TABLE public.segments ADD COLUMN IF NOT EXISTS program TEXT DEFAULT '-';
ALTER TABLE public.segments ADD COLUMN IF NOT EXISTS performance TEXT DEFAULT '';
ALTER TABLE public.segments ADD COLUMN IF NOT EXISTS season_episode TEXT DEFAULT '';
ALTER TABLE public.segments ADD COLUMN IF NOT EXISTS mcr_notes TEXT DEFAULT '';
ALTER TABLE public.segments ADD COLUMN IF NOT EXISTS linenum INT DEFAULT 0;

-- 7. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roles
DROP POLICY IF EXISTS "viewers can read segments" ON public.segments;
CREATE POLICY "viewers can read segments" ON public.segments
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('viewer', 'editor', 'admin')
    OR auth.uid() IS NULL
  );

-- RLS for audit_logs: admin only can see all, others can see their own
DROP POLICY IF EXISTS "audit_logs admin read all" ON public.audit_logs;
CREATE POLICY "audit_logs admin read all" ON public.audit_logs
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    OR user_email = COALESCE(auth.jwt() ->> 'email', '')
  );

DROP POLICY IF EXISTS "audit_logs insert" ON public.audit_logs;
CREATE POLICY "audit_logs insert" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- RLS for tickets
DROP POLICY IF EXISTS "tickets read own or assigned" ON public.tickets;
CREATE POLICY "tickets read own or assigned" ON public.tickets
  FOR SELECT USING (
    created_by_email = COALESCE(auth.jwt() ->> 'email', '')
    OR assigned_to_email = COALESCE(auth.jwt() ->> 'email', '')
    OR target_email = COALESCE(auth.jwt() ->> 'email', '')
    OR visibility = 'everyone'
  );

DROP POLICY IF EXISTS "tickets insert" ON public.tickets;
CREATE POLICY "tickets insert" ON public.tickets
  FOR INSERT WITH CHECK (created_by_email = COALESCE(auth.jwt() ->> 'email', ''));

DROP POLICY IF EXISTS "tickets update" ON public.tickets;
CREATE POLICY "tickets update" ON public.tickets
  FOR UPDATE USING (
    created_by_email = COALESCE(auth.jwt() ->> 'email', '')
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

-- RLS for ticket_comments
DROP POLICY IF EXISTS "ticket_comments read if ticket accessible" ON public.ticket_comments;
CREATE POLICY "ticket_comments read if ticket accessible" ON public.ticket_comments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_comments.ticket_id)
  );

DROP POLICY IF EXISTS "ticket_comments insert" ON public.ticket_comments;
CREATE POLICY "ticket_comments insert" ON public.ticket_comments
  FOR INSERT WITH CHECK (user_email = COALESCE(auth.jwt() ->> 'email', ''));
