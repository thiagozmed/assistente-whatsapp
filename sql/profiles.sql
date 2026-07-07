-- Rodar manualmente no SQL Editor do Supabase (Fase 3). Sem framework de
-- migration, mantendo o minimalismo do projeto.

create table if not exists profiles (
  phone_number text primary key,                     -- formato cru do webhook, ex "554891466284" (sem 9º dígito)
  assistant_name text,                                -- nome que o usuário escolheu pro assistente; null até o onboarding perguntar
  tone text check (tone in ('formal', 'afetuoso')),   -- null até o onboarding perguntar
  onboarding_state text not null default 'aguardando_nome'
    check (onboarding_state in ('aguardando_nome', 'aguardando_tom', 'completo')),
  last_interaction_type text check (last_interaction_type in ('golpe', 'burocracia')),
  last_interaction_summary text,
  last_interaction_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- service_role (usada pelo backend) sempre faz bypass de RLS; isso só fecha a
-- porta pra uma chave anon/pública usada por engano ou vazada.
alter table profiles enable row level security;
