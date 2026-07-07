-- Rodar manualmente no SQL Editor do Supabase (Fase 4). Sem framework de
-- migration, mantendo o padrão de sql/profiles.sql.

create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null references profiles(phone_number),
  description text not null,
  scheduled_at timestamptz not null,
  status text not null default 'pendente' check (status in ('pendente', 'enviado', 'cancelado')),
  created_at timestamptz not null default now()
);

create index if not exists reminders_pending_idx on reminders (scheduled_at) where status = 'pendente';

-- service_role (usada pelo backend) sempre faz bypass de RLS; isso só fecha a
-- porta pra uma chave anon/pública usada por engano ou vazada.
alter table reminders enable row level security;
