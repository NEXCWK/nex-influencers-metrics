-- Migration: flag para posts possivelmente duplicados
-- Run this in the Supabase SQL Editor — it is idempotent.

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS possible_duplicate boolean DEFAULT false;
