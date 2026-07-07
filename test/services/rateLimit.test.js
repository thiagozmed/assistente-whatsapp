const { test } = require('node:test');
const assert = require('node:assert/strict');
const profileStore = require('../../src/services/profileStore');
const rateLimit = require('../../src/services/rateLimit');

test('checkAndIncrement: primeira mensagem do dia começa a contagem em 1', async (t) => {
  const updateMock = t.mock.method(profileStore, 'updateDailyMessageCount', async () => ({}));

  const { allowed, count } = await rateLimit.checkAndIncrement('123', {
    daily_message_count: 0,
    daily_message_count_date: null,
  });

  assert.equal(allowed, true);
  assert.equal(count, 1);
  assert.equal(updateMock.mock.calls[0].arguments[1], 1);
});

test('checkAndIncrement: mesmo dia incrementa a contagem existente', async (t) => {
  t.mock.method(profileStore, 'updateDailyMessageCount', async () => ({}));
  const today = new Date().toISOString().slice(0, 10);

  const { allowed, count } = await rateLimit.checkAndIncrement('123', {
    daily_message_count: 5,
    daily_message_count_date: today,
  });

  assert.equal(allowed, true);
  assert.equal(count, 6);
});

test('checkAndIncrement: dia diferente reseta a contagem, mesmo com contagem antiga alta', async (t) => {
  t.mock.method(profileStore, 'updateDailyMessageCount', async () => ({}));

  const { allowed, count } = await rateLimit.checkAndIncrement('123', {
    daily_message_count: 999,
    daily_message_count_date: '2020-01-01',
  });

  assert.equal(allowed, true);
  assert.equal(count, 1);
});

test('checkAndIncrement: contagem acima do limite diário não é permitida', async (t) => {
  t.mock.method(profileStore, 'updateDailyMessageCount', async () => ({}));
  const today = new Date().toISOString().slice(0, 10);

  const { allowed, count } = await rateLimit.checkAndIncrement('123', {
    daily_message_count: rateLimit.DAILY_MESSAGE_LIMIT,
    daily_message_count_date: today,
  });

  assert.equal(allowed, false);
  assert.equal(count, rateLimit.DAILY_MESSAGE_LIMIT + 1);
});

test('checkAndIncrement: erro do Supabase propaga como exceção', async (t) => {
  t.mock.method(profileStore, 'updateDailyMessageCount', async () => {
    throw new Error('conexão recusada');
  });

  await assert.rejects(
    () => rateLimit.checkAndIncrement('123', { daily_message_count: 0, daily_message_count_date: null }),
    /conexão recusada/,
  );
});
