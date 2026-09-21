-- Migration: novo papel "operacao" — acesso restrito à aba Registro de
-- Cupons (nada mais). A tabela users tinha um CHECK restringindo role a
-- 'admin'/'influencer'; libera 'operacao' também.
-- Run this in the Supabase SQL Editor — it is idempotent (safe to re-run).

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'influencer', 'operacao'));
