-- V13+: Asset-level comments, notification read tracking, ticket delete cascade

-- Add ticket_id to notifications for grouping read receipts
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS ticket_id TEXT DEFAULT '';

-- Add asset_id column to ticket_comments for asset-level comments (not tied to a ticket)
ALTER TABLE public.ticket_comments ADD COLUMN IF NOT EXISTS asset_id TEXT DEFAULT '';
-- Make ticket_id nullable so comments can be standalone
ALTER TABLE public.ticket_comments ALTER COLUMN ticket_id DROP NOT NULL;

-- Notification read receipts tracking
CREATE TABLE IF NOT EXISTS public.notification_reads (
  id BIGSERIAL PRIMARY KEY,
  notification_id BIGINT NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(notification_id, user_email)
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_notification_reads_notif ON public.notification_reads(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON public.notification_reads(user_email);

-- Enable RLS on notification_reads
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

-- Drop and recreate NOTIFICATIONS RLS to allow read tracking
DROP POLICY IF EXISTS "notifications read owner" ON public.notifications;
CREATE POLICY "notifications read owner" ON public.notifications
  FOR SELECT USING (target_email = COALESCE(auth.jwt() ->> 'email', ''));

DROP POLICY IF EXISTS "notifications insert" ON public.notifications;
CREATE POLICY "notifications insert" ON public.notifications
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "notifications update" ON public.notifications;
CREATE POLICY "notifications update" ON public.notifications
  FOR UPDATE USING (target_email = COALESCE(auth.jwt() ->> 'email', ''));

-- RLS for notification_reads
DROP POLICY IF EXISTS "notification_reads select" ON public.notification_reads;
CREATE POLICY "notification_reads select" ON public.notification_reads
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "notification_reads insert" ON public.notification_reads;
CREATE POLICY "notification_reads insert" ON public.notification_reads
  FOR INSERT WITH CHECK (user_email = COALESCE(auth.jwt() ->> 'email', ''));

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
