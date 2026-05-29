# Nex Influencer Metrics

Plataforma interna do Nex Coworking para gerenciamento e visualização de métricas de influenciadores parceiros.

## Funcionalidades

- Upload de prints de posts com extração automática de métricas via IA (Claude)
- Dashboard individual por influenciador com histórico mensal
- Painel admin com visão geral da rede, ranking e exportação CSV
- Controle de acesso por perfil (admin / influencer)

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Node.js 20 + Express.js |
| Frontend | React 18 + Vite |
| Banco de dados | Supabase (PostgreSQL) |
| Storage | Supabase Storage |
| IA | Anthropic Claude (claude-sonnet-4-20250514) |
| Deploy | Railway |

## Setup Local

### Backend

```bash
cd backend
cp .env.example .env
# Preencha as variáveis de ambiente
npm install
npm run seed    # Cria os usuários iniciais
npm run dev
```

### Frontend

```bash
cd frontend
cp .env.example .env
# Defina VITE_API_URL=http://localhost:3001
npm install
npm run dev
```

## Variáveis de Ambiente

### Backend (`backend/.env`)

| Variável | Descrição |
|---|---|
| `PORT` | Porta do servidor (padrão: 3001) |
| `JWT_SECRET` | Chave secreta para JWT |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_KEY` | Service role key do Supabase |
| `ANTHROPIC_API_KEY` | Chave da API Anthropic |
| `FRONTEND_URL` | URL do frontend (para CORS) |

### Frontend (`frontend/.env`)

| Variável | Descrição |
|---|---|
| `VITE_API_URL` | URL do backend |

## Usuários Iniciais

Todos os usuários são criados via `npm run seed` no backend.

| Username | Perfil | Senha inicial |
|---|---|---|
| `felipemoreira` | admin | `nex2026` |
| `luizamarques` | admin | `nex2026` |
| `paulapicat` | influencer | `nex2026` |
| `gabs` | influencer | `nex2026` |
| `ari` | influencer | `nex2026` |
| `anabia` | influencer | `nex2026` |
| `anarusick` | influencer | `nex2026` |
| `gabi` | influencer | `nex2026` |

> No primeiro login, o sistema obriga a troca de senha (mínimo 8 caracteres).

## Setup Supabase

Execute as queries abaixo no SQL Editor do Supabase:

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  display_name text,
  password_hash text,
  role text check (role in ('admin', 'influencer')),
  bio text,
  avatar_url text,
  must_change_password boolean default true,
  is_active boolean default true,
  last_login timestamp,
  created_at timestamp default now()
);

create table posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  title text,
  platform text check (platform in ('instagram', 'tiktok', 'youtube', 'linkedin')),
  published_at date not null,
  uploaded_at timestamp default now(),
  image_url text,
  ai_raw_response jsonb,
  confirmed_by_user boolean default false
);

create table metrics (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  reach integer,
  impressions integer,
  likes integer,
  comments integer,
  shares integer,
  saves integer,
  plays integer,
  engagement_rate numeric(5,2),
  profile_visits integer,
  link_clicks integer,
  manually_edited boolean default false,
  created_at timestamp default now()
);

create table coupon_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  year integer not null,
  month integer not null,
  subscription_count integer default 0,
  access_count integer default 0,
  updated_at timestamp default now(),
  unique (user_id, year, month)
);

alter table users enable row level security;
alter table posts enable row level security;
alter table metrics enable row level security;
alter table coupon_records enable row level security;
```

Crie o bucket `post-prints` como **privado** no painel do Supabase Storage
(o backend o cria automaticamente no primeiro upload, caso não exista).

### Migração — perfil e cupons (rode se o banco já existia antes destas features)

```sql
-- Perfil: bio e foto
alter table users add column if not exists bio text;
alter table users add column if not exists avatar_url text;

-- Cupons: contabilização mensal por influenciador
create table if not exists coupon_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  year integer not null,
  month integer not null,
  subscription_count integer default 0,
  access_count integer default 0,
  updated_at timestamp default now(),
  unique (user_id, year, month)
);
alter table coupon_records enable row level security;
```

## Deploy (Railway)

1. Conecte o repositório no Railway
2. Crie dois serviços: `backend` (root: `/backend`) e `frontend` (root: `/frontend`)
3. Configure as variáveis de ambiente em cada serviço
4. Execute `npm run seed` no backend para criar os usuários

---

*Plataforma interna Nex Coworking — uso restrito*
