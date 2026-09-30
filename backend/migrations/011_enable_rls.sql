-- Migration: ativa Row Level Security em todas as tabelas do sistema.
--
-- Por que isso é seguro e não quebra nada: o backend SEMPRE acessa o banco
-- usando a service_role key (SUPABASE_SERVICE_KEY) — nunca a chave anon/
-- publishable — e a service_role sempre ignora RLS por padrão no Supabase.
-- O frontend, por sua vez, nunca fala com o Supabase diretamente: tudo
-- passa pela nossa API Express, que aplica a própria autenticação (JWT).
-- Portanto, ativar RLS sem nenhuma policy adicional:
--   - NÃO afeta o backend (continua funcionando exatamente igual);
--   - fecha o acesso público direto via API REST do Supabase (chave anon),
--     que é exatamente o alerta "Tabela de acesso público" do Advisor.
--
-- Idempotente: rodar de novo em uma tabela que já tem RLS ativado não dá erro.
-- Run this in the Supabase SQL Editor.

-- Tabelas originais (o setup inicial já mandava ativar isso, reafirma por
-- segurança caso não tenha sido rodado em algum ambiente).
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_records ENABLE ROW LEVEL SECURITY;

-- Tabelas adicionadas nas migrations 006-008, que ficaram sem RLS.
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE freelance_influencers ENABLE ROW LEVEL SECURITY;
ALTER TABLE freelance_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_partner_sales ENABLE ROW LEVEL SECURITY;
