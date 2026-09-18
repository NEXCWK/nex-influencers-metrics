-- Migration: Influenciadores Avulsos (cadastro manual, fora do fluxo normal
-- de login/upload por print — o admin lança os posts manualmente).
-- Run this in the Supabase SQL Editor — it is idempotent.

CREATE TABLE IF NOT EXISTS freelance_influencers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS freelance_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES freelance_influencers(id) ON DELETE CASCADE,
  post_url text NOT NULL,
  format text NOT NULL DEFAULT 'feed',
  likes integer NOT NULL DEFAULT 0,
  views integer NOT NULL DEFAULT 0,
  comments integer NOT NULL DEFAULT 0,
  reposts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS freelance_posts_influencer_idx ON freelance_posts (influencer_id);
