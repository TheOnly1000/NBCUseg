-- Ensure tickets table and all required columns exist
-- Run this if you get "Could not find the 'body' column of 'tickets' in the schema cache"

-- Refresh Supabase schema cache (run this first)
NOTIFY pgrst, 'reload schema';

-- Ensure tickets table exists (CREATE TABLE does nothing if table already exists, so we use ALTER TABLE for each column)
CREATE TABLE IF NOT EXISTS public.tickets (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS ticket_id TEXT UNIQUE;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS asset_id TEXT DEFAULT '';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS subject TEXT DEFAULT '';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS body TEXT DEFAULT '';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS created_by_email TEXT DEFAULT '';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS created_by_name TEXT DEFAULT '';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS assigned_to_email TEXT DEFAULT '';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS assigned_to_name TEXT DEFAULT '';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS target_email TEXT DEFAULT '';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'everyone';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS resolved_by TEXT DEFAULT '';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS closed_by TEXT DEFAULT '';
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- Ensure ticket_comments table exists
CREATE TABLE IF NOT EXISTS public.ticket_comments (
    id BIGSERIAL PRIMARY KEY,
    ticket_id BIGINT REFERENCES public.tickets(id),
    asset_id TEXT DEFAULT '',
    user_email TEXT,
    user_name TEXT,
    message TEXT,
    mentions TEXT[],
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add asset_id column to existing ticket_comments if missing
ALTER TABLE public.ticket_comments ADD COLUMN IF NOT EXISTS asset_id TEXT DEFAULT '';
ALTER TABLE public.ticket_comments ALTER COLUMN ticket_id DROP NOT NULL;

-- Refresh schema cache again after changes
NOTIFY pgrst, 'reload schema';
