-- Rodar manualmente no SQL Editor do Supabase, depois de 004_atomic_rate_limit.sql.
-- Revisão de segurança (2026-07-07): a Meta pode reentregar o mesmo evento de
-- webhook (rede instável, timeout, etc.) mesmo já tendo recebido nosso ack
-- 200 imediato. Sem controle de idempotência, isso reprocessa a mesma
-- mensagem do zero — conta 2x no rate limit, pode duplicar lembrete ou
-- resposta. A PK em "wamid" (id da mensagem do WhatsApp) faz o dedup: a
-- segunda tentativa de INSERT do mesmo wamid colide (23505) e é descartada.
create table if not exists processed_messages (
  wamid text primary key,
  processed_at timestamptz not null default now()
);

alter table processed_messages enable row level security;
