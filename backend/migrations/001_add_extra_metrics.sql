-- Migration: add extra_metrics and ai_raw_response columns
-- Run this in the Supabase SQL editor (Dashboard > SQL Editor)
-- It is idempotent — safe to run multiple times.

-- 1. Extra metrics JSONB column on the metrics table
--    Stores any AI-detected metrics beyond the standard fields.
ALTER TABLE metrics
  ADD COLUMN IF NOT EXISTS extra_metrics jsonb;

-- 2. Raw AI response on the posts table
--    Stores the full JSON returned by the AI extraction service.
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS ai_raw_response jsonb;
