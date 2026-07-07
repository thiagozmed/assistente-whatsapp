-- Rodar manualmente no SQL Editor do Supabase, depois de 005_processed_messages.sql.
-- Revisão de segurança (2026-07-07): "esquecer meus dados" apagava o perfil
-- na hora, sem confirmação — se o celular do idoso for roubado ou sofrer SIM
-- swap, quem estiver de posse do número consegue apagar tudo irreversivelmente
-- com uma única mensagem. Uma etapa de confirmação explícita (mesmo padrão
-- de "sim"/"não" já usado no consentimento) reduz esse risco sem exigir login.
alter table profiles add column if not exists pending_action text
  check (pending_action in ('confirmar_esquecer'));
