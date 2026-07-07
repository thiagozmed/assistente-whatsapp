-- Rodar manualmente no SQL Editor do Supabase, depois de profiles.sql e
-- reminders.sql já existirem. Adiciona o passo de consentimento explícito no
-- onboarding (CLAUDE.md 3.4/6.3 — obrigatório antes do primeiro usuário real
-- fora do próprio time) e habilita o comando "esquecer meus dados".

alter table profiles drop constraint if exists profiles_onboarding_state_check;
alter table profiles add constraint profiles_onboarding_state_check
  check (onboarding_state in ('aguardando_consentimento', 'aguardando_nome', 'aguardando_tom', 'completo'));
alter table profiles alter column onboarding_state set default 'aguardando_consentimento';
alter table profiles add column if not exists consented_at timestamptz;

-- Apagar o perfil precisa apagar os lembretes junto (também são dado pessoal,
-- potencialmente médico) — cascade evita orquestrar isso em duas tabelas na
-- aplicação. Se o DROP CONSTRAINT abaixo não encontrar o nome (Postgres pode
-- ter gerado outro), rode "\d reminders" no SQL Editor pra conferir o nome
-- real da foreign key e ajuste antes de rodar o ADD CONSTRAINT.
alter table reminders drop constraint if exists reminders_phone_number_fkey;
alter table reminders add constraint reminders_phone_number_fkey
  foreign key (phone_number) references profiles(phone_number) on delete cascade;
