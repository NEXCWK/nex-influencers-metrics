-- Migration: Cupons Access Pass (port do sistema nexcupominflu/Lovable)
-- Parceiros (influenciadores fixos/avulsos com cupom próprio) e vendas
-- individuais de Access Pass/Atrium/Gallery registradas via cupom.
-- Run this in the Supabase SQL Editor — it is idempotent.

DO $$ BEGIN
  CREATE TYPE coupon_partner_category AS ENUM ('fixo', 'avulso');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE coupon_partner_product AS ENUM ('access_pass', 'atrium', 'gallery');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS coupon_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  coupon_code text NOT NULL UNIQUE,
  category coupon_partner_category NOT NULL DEFAULT 'avulso',
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS coupon_partner_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES coupon_partners(id) ON DELETE RESTRICT,
  customer_name text NOT NULL,
  product coupon_partner_product NOT NULL DEFAULT 'access_pass',
  price numeric(10,2) NOT NULL,
  discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  amount_paid numeric(10,2) NOT NULL,
  commission_amount numeric(10,2) NOT NULL,
  payment_confirmed boolean NOT NULL DEFAULT false,
  registered_by_email text NOT NULL,
  registered_by_name text,
  sold_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coupon_partner_sales_partner_idx ON coupon_partner_sales (partner_id);
CREATE INDEX IF NOT EXISTS coupon_partner_sales_sold_at_idx ON coupon_partner_sales (sold_at DESC);

-- Parceiros "Fixos" já cadastrados no sistema original (nexcupominflu), para
-- não precisar recadastrar manualmente. Vendas históricas NÃO são migradas
-- automaticamente (dado vivo no outro projeto Supabase) — ver README/aviso.
INSERT INTO coupon_partners (name, coupon_code, category, active) VALUES
  ('Paula Pigatto',      'PAULAPIGATTONEXHOUSE', 'fixo', true),
  ('Gabriel Scherendorf','GABRIELNEXHOUSE',      'fixo', true),
  ('Ana Bia',            'ANABIANEXHOUSE',       'fixo', true),
  ('Ronaldo Pithan',     'PITHANNEXHOUSE',       'fixo', true),
  ('Jaqueline',          'JAQUENEXHOUSE',        'fixo', true),
  ('Ariane Francez',     'ARINEXHOUSE',          'fixo', true),
  ('Ana Rusick',         'ANANEXHOUSE',          'fixo', true),
  ('Gabi',               'GABINEXHOUSE',         'fixo', true),
  ('Vanessa',            'VANENEXHOUSE',         'fixo', true)
ON CONFLICT (coupon_code) DO NOTHING;
