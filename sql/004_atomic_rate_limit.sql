-- Rodar manualmente no SQL Editor do Supabase, depois de 003_add_general_chat.sql.
-- Revisão de segurança (2026-07-07): o contador de rate limit era lido e
-- escrito em duas chamadas separadas da aplicação (leia perfil -> calcule ->
-- grave), o que abre uma condição de corrida se duas mensagens do mesmo
-- número chegarem quase juntas (ou a Meta reentregar o mesmo evento) — as
-- duas podem ler a mesma contagem antiga e deixar passar mensagem acima do
-- limite. Uma função no Postgres resolve isso: o UPDATE roda inteiro dentro
-- de uma única instrução, então o lock de linha do Postgres serializa
-- chamadas concorrentes pro mesmo phone_number (mesmo padrão de atomicidade
-- já usado em claimReminder).
create or replace function increment_daily_message_count(p_phone_number text, p_today date)
returns table (daily_message_count int, daily_message_count_date date) as $$
  update profiles
  set daily_message_count = case
        when daily_message_count_date = p_today then daily_message_count + 1
        else 1
      end,
      daily_message_count_date = p_today,
      updated_at = now()
  where phone_number = p_phone_number
  returning profiles.daily_message_count, profiles.daily_message_count_date;
$$ language sql volatile;
