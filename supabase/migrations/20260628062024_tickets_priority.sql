-- Add priority column to tickets table
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium';
