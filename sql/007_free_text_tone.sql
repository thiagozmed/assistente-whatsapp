-- Rodar manualmente no SQL Editor do Supabase, depois de 006_pending_action.sql.
-- O onboarding perguntava "formal ou próximo e afetuoso?" com só duas opções
-- fixas. Decisão do usuário (2026-07-07): a pergunta vira aberta ("como você
-- gostaria que eu falasse com você?") e o tom fica livre (formal, informal,
-- alegre, sério, o que a pessoa disser) — por isso a coluna deixa de ser
-- restrita a um enum de duas opções.
alter table profiles drop constraint if exists profiles_tone_check;
