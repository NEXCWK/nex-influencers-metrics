-- Migration: relatórios mensais de performance por influenciador
-- Guarda o HTML gerado (envio dia 05 do mês, referente ao mês anterior
-- completo) para histórico/preview no admin, mesmo antes/depois do envio
-- por e-mail estar configurado.
-- Run this in the Supabase SQL Editor — it is idempotent.

CREATE TABLE IF NOT EXISTS monthly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_year integer NOT NULL,
  report_month integer NOT NULL,
  html text NOT NULL,
  recipients text[] NOT NULL DEFAULT '{}',
  sent boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  send_error text,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS monthly_reports_period_unique
  ON monthly_reports (report_year, report_month);
