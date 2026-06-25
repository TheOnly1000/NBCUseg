-- V13+: Add images column to tickets table
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
