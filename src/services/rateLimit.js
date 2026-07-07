const profileStore = require('./profileStore');

// CLAUDE.md 6.3 — limite de mensagens/dia por número, pra conter custo e abuso.
const DAILY_MESSAGE_LIMIT = 60;

// Bug real (auditoria 2026-07-07): usar UTC fazia o "dia" resetar às 21h de
// Brasília (UTC-3), não à meia-noite local — mesmo fuso já tratado em
// agenda.js pra lembretes. "en-CA" formata como YYYY-MM-DD, mesmo formato
// que a coluna date do Postgres espera.
function today() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

async function checkAndIncrement(phoneNumber) {
  const { daily_message_count: count } = await profileStore.incrementDailyMessageCount(phoneNumber, today());
  return { allowed: count <= DAILY_MESSAGE_LIMIT, count };
}

module.exports = { checkAndIncrement, DAILY_MESSAGE_LIMIT, today };
