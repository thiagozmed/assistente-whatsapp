const profileStore = require('./profileStore');

// CLAUDE.md 6.3 — limite de mensagens/dia por número, pra conter custo e abuso.
const DAILY_MESSAGE_LIMIT = 60;

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function checkAndIncrement(phoneNumber) {
  const { daily_message_count: count } = await profileStore.incrementDailyMessageCount(phoneNumber, today());
  return { allowed: count <= DAILY_MESSAGE_LIMIT, count };
}

module.exports = { checkAndIncrement, DAILY_MESSAGE_LIMIT };
