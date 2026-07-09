-- Migration: classify posts as Feed vs Story
-- Run this in the Supabase SQL Editor — it is idempotent.

-- 1. Add the post_type column (default 'feed'). Adding a DEFAULT backfills
--    every existing row with 'feed' automatically.
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS post_type text DEFAULT 'feed';

-- 2. Backfill existing data: any post whose título menciona "story" é
--    reclassificado como story. Os demais permanecem como 'feed'.
UPDATE posts
  SET post_type = 'story'
  WHERE lower(coalesce(title, '')) LIKE '%story%';

-- 3. Garante que não sobrou nenhum nulo.
UPDATE posts
  SET post_type = 'feed'
  WHERE post_type IS NULL;
