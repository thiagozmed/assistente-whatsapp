-- Rodar manualmente no SQL Editor do Supabase, depois de 002_add_consent.sql.
-- Suporta o CLAUDE.md 4.5 (assistente de propósito geral, com limites):
-- coluna pra registrar interação tipo "geral" e contador de rate limit diário
-- (CLAUDE.md 6.3 — limite de mensagens/dia por número, pra conter custo e abuso).

alter table profiles drop constraint if exists profiles_last_interaction_type_check;
alter table profiles add constraint profiles_last_interaction_type_check
  check (last_interaction_type in ('golpe', 'burocracia', 'geral'));

alter table profiles add column if not exists daily_message_count int not null default 0;
alter table profiles add column if not exists daily_message_count_date date;
