-- Migration: URL do post (link público, ex.: link do Instagram/TikTok)
-- Guardado como referência; ainda não é usado para extrair comentários.
-- Run this in the Supabase SQL Editor — it is idempotent.

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS post_url text;
