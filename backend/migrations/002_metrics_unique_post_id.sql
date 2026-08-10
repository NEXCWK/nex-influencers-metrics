-- Migration: add unique index on metrics.post_id
-- Required for the upsert (onConflict: 'post_id') to work correctly.
-- Run this in the Supabase SQL Editor — it is idempotent.

CREATE UNIQUE INDEX IF NOT EXISTS metrics_post_id_unique ON metrics (post_id);
