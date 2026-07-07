const { test } = require('node:test');
const assert = require('node:assert/strict');
const profileStore = require('../../src/services/profileStore');
const rateLimit = require('../../src/services/rateLimit');

test('checkAndIncrement: contagem abaixo do limite é permitida', async (t) => {
  t.mock.method(profileStore, 'incrementDailyMessageCount', async () => ({ daily_message_count: 1 }));

  const { allowed, count } = await rateLimit.checkAndIncrement('123');

  assert.equal(allowed, true);
  assert.equal(count, 1);
});

test('checkAndIncrement: contagem acima do limite diário não é permitida', async (t) => {
  t.mock.method(profileStore, 'incrementDailyMessageCount', async () => ({
    daily_message_count: rateLimit.DAILY_MESSAGE_LIMIT + 1,
  }));

  const { allowed, count } = await rateLimit.checkAndIncrement('123');

  assert.equal(allowed, false);
  assert.equal(count, rateLimit.DAILY_MESSAGE_LIMIT + 1);
});

test('checkAndIncrement: contagem exatamente no limite ainda é permitida', async (t) => {
  t.mock.method(profileStore, 'incrementDailyMessageCount', async () => ({
    daily_message_count: rateLimit.DAILY_MESSAGE_LIMIT,
  }));

  const { allowed } = await rateLimit.checkAndIncrement('123');
  assert.equal(allowed, true);
});

test('checkAndIncrement: erro do Supabase propaga como exceção', async (t) => {
  t.mock.method(profileStore, 'incrementDailyMessageCount', async () => {
    throw new Error('conexão recusada');
  });

  await assert.rejects(() => rateLimit.checkAndIncrement('123'), /conexão recusada/);
});
