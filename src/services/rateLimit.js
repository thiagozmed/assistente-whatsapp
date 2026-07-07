const profileStore = require('./profileStore');

// CLAUDE.md 6.3 — limite de mensagens/dia por número, pra conter custo e abuso.
const DAILY_MESSAGE_LIMIT = 60;

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function checkAndIncrement(phoneNumber, profile) {
  const date = today();
  const isNewDay = profile.daily_message_count_date !== date;
  const count = isNewDay ? 1 : (profile.daily_message_count || 0) + 1;

  await profileStore.updateDailyMessageCount(phoneNumber, count, date);

  return { allowed: count <= DAILY_MESSAGE_LIMIT, count };
}

module.exports = { checkAndIncrement, DAILY_MESSAGE_LIMIT };
