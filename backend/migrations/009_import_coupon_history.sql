-- Migration: importa dados históricos do nexcupominflu (Lovable), via export
-- público lido em 2026-09-21. Corrige o cupom da Paula Pigatto, traz os
-- parceiros avulsos que ainda não existiam aqui, e importa o histórico de
-- vendas (6 registros). Idempotente: pode rodar mais de uma vez sem duplicar.
-- Run this in the Supabase SQL Editor.

-- source_id guarda o id original do registro no nexcupominflu, só para
-- permitir reimportar com segurança (ON CONFLICT) sem duplicar vendas.
ALTER TABLE coupon_partner_sales ADD COLUMN IF NOT EXISTS source_id text UNIQUE;

-- O README do projeto original listava o cupom da Paula Pigatto como
-- PAULAPIGATTONEXHOUSE, mas o cupom real em produção é PAULANEXHOUSE —
-- corrige para não gerar um parceiro duplicado.
UPDATE coupon_partners SET coupon_code = 'PAULANEXHOUSE' WHERE coupon_code = 'PAULAPIGATTONEXHOUSE';

-- Parceiros avulsos existentes no nexcupominflu que ainda não estavam aqui.
INSERT INTO coupon_partners (name, coupon_code, category, active, expires_at, created_at) VALUES
  ('Emilia Jurach',   'EMILIANEXHOUSE', 'avulso', true,  '2026-10-02T02:59:59+00:00', '2026-08-25T19:19:02.047432+00:00'),
  ('Femigos',         'FENEXHOUSE',     'avulso', false, '2026-08-15T02:59:59+00:00', '2026-07-15T11:54:54.953451+00:00'),
  ('KAMILA BRAND',    'KAMILANEXHOUSE', 'avulso', true,  '2026-10-02T02:59:59+00:00', '2026-07-09T18:56:22.759622+00:00'),
  ('Letícia Galvão',  'LETINEXHOUSE',   'avulso', false, NULL,                         '2026-07-02T14:28:32.181829+00:00'),
  ('Rebeca Oliveira', 'REBECANEXHOUSE', 'avulso', false, '2026-09-06T02:59:59+00:00', '2026-08-05T16:26:04.762946+00:00'),
  ('Sabrina',         'SABRINANEXHOUSE','avulso', false, '2026-09-07T02:59:59+00:00', '2026-08-06T12:09:14.575549+00:00')
ON CONFLICT (coupon_code) DO NOTHING;

-- Histórico de vendas (6 registros lidos do export do nexcupominflu).
-- ATENÇÃO: os dois últimos registros (Gabi / BEATRIZ BORGES) são quase
-- idênticos — mesmo cliente, mesma data, mesmo valor, criados 10 segundos
-- um do outro. Parece um clique duplicado no sistema original. Foram
-- importados os DOIS, fielmente, para não perder dado nenhum — revise
-- depois na aba Cupons Access Pass e apague um deles se confirmar que foi
-- engano.

INSERT INTO coupon_partner_sales
  (source_id, partner_id, customer_name, product, price, discount_amount, amount_paid, commission_amount, payment_confirmed, registered_by_email, sold_at, created_at)
SELECT 'd5fd4e9d-0c45-4864-8d2c-3c7585036e70', id, 'REBECA NOVO SHALON DE QUEIROZ', 'atrium', 890, 0, 890, 445, true, 'luiza@nexcoworking.com.br', '2026-09-16T15:00:00+00:00', '2026-09-16T19:20:56.929244+00:00'
FROM coupon_partners WHERE coupon_code = 'PAULANEXHOUSE'
ON CONFLICT (source_id) DO NOTHING;

INSERT INTO coupon_partner_sales
  (source_id, partner_id, customer_name, product, price, discount_amount, amount_paid, commission_amount, payment_confirmed, registered_by_email, sold_at, created_at)
SELECT 'd452bb5c-d54d-42fe-b5a4-a33fa05971f2', id, 'MAICON WILLIAM DAVID SHALON', 'atrium', 890, 0, 890, 445, true, 'luiza@nexcoworking.com.br', '2026-08-25T15:00:00+00:00', '2026-08-26T14:18:45.032103+00:00'
FROM coupon_partners WHERE coupon_code = 'GABRIELNEXHOUSE'
ON CONFLICT (source_id) DO NOTHING;

INSERT INTO coupon_partner_sales
  (source_id, partner_id, customer_name, product, price, discount_amount, amount_paid, commission_amount, payment_confirmed, registered_by_email, sold_at, created_at)
SELECT '36853c1a-2c0a-4266-9c3b-889d38896ffc', id, 'Luisa Bonaroski Gameiro Lopes', 'gallery', 640, 0, 640, 320, false, 'luiza@nexcoworking.com.br', '2026-08-24T15:00:00+00:00', '2026-08-26T14:19:54.066071+00:00'
FROM coupon_partners WHERE coupon_code = 'ARINEXHOUSE'
ON CONFLICT (source_id) DO NOTHING;

INSERT INTO coupon_partner_sales
  (source_id, partner_id, customer_name, product, price, discount_amount, amount_paid, commission_amount, payment_confirmed, registered_by_email, sold_at, created_at)
SELECT '7d6cc1f2-5f41-433a-80f1-d08ef7d26525', id, 'Maria Fernanda Decke', 'atrium', 890, 0, 890, 445, true, 'luiza@nexcoworking.com.br', '2026-07-10T15:00:00+00:00', '2026-08-26T15:04:56.498881+00:00'
FROM coupon_partners WHERE coupon_code = 'GABRIELNEXHOUSE'
ON CONFLICT (source_id) DO NOTHING;

INSERT INTO coupon_partner_sales
  (source_id, partner_id, customer_name, product, price, discount_amount, amount_paid, commission_amount, payment_confirmed, registered_by_email, sold_at, created_at)
SELECT '43f8230b-0caa-47f5-b33e-494d6b59a0cb', id, '(6758) BEATRIZ BORGES', 'access_pass', 130, 26, 104, 13, true, 'larissa@nexcoworking.com.br', '2026-07-01T15:00:00+00:00', '2026-07-01T16:21:48.739038+00:00'
FROM coupon_partners WHERE coupon_code = 'GABINEXHOUSE'
ON CONFLICT (source_id) DO NOTHING;

INSERT INTO coupon_partner_sales
  (source_id, partner_id, customer_name, product, price, discount_amount, amount_paid, commission_amount, payment_confirmed, registered_by_email, sold_at, created_at)
SELECT '8385827c-3d70-48a9-ac99-02673bc30579', id, '(6758) BEATRIZ BORGES', 'access_pass', 130, 26, 104, 13, true, 'larissa@nexcoworking.com.br', '2026-07-01T15:00:00+00:00', '2026-07-01T16:21:58.027727+00:00'
FROM coupon_partners WHERE coupon_code = 'GABINEXHOUSE'
ON CONFLICT (source_id) DO NOTHING;
