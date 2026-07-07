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

test('today: usa o fuso de Brasília, não UTC (bug real 2026-07-07)', (t) => {
  t.mock.timers.enable({ apis: ['Date'] });
  // 2026-01-15T02:00:00Z é 2026-01-14T23:00:00 em Brasília (UTC-3) — com o
  // bug antigo (UTC puro), o dia "virava" 3h mais cedo do que devia.
  t.mock.timers.setTime(new Date('2026-01-15T02:00:00.000Z').getTime());

  assert.equal(rateLimit.today(), '2026-01-14');
});
