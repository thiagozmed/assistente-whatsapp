const { test } = require('node:test');
const assert = require('node:assert/strict');
const { supabase } = require('../../src/services/supabaseClient');
const { fakeQuery } = require('../helpers/fakeSupabase');
const reminderStore = require('../../src/services/reminderStore');

test('createReminder: sucesso retorna a linha criada', async (t) => {
  t.mock.method(supabase, 'from', () =>
    fakeQuery({ data: { id: 'r1', phone_number: '123', description: 'tomar remédio', status: 'pendente' }, error: null }),
  );

  const reminder = await reminderStore.createReminder('123', { description: 'tomar remédio', scheduledAt: new Date('2026-07-08T08:00:00-03:00') });
  assert.equal(reminder.description, 'tomar remédio');
});

test('createReminder: erro do Supabase propaga como exceção', async (t) => {
  t.mock.method(supabase, 'from', () => fakeQuery({ data: null, error: { message: 'conexão recusada' } }));

  await assert.rejects(
    () => reminderStore.createReminder('123', { description: 'x', scheduledAt: new Date() }),
    /conexão recusada/,
  );
});

test('getDueReminders: retorna a lista de lembretes pendentes vencidos', async (t) => {
  t.mock.method(supabase, 'from', () =>
    fakeQuery({ data: [{ id: 'r1', phone_number: '123', description: 'tomar remédio' }], error: null }),
  );

  const due = await reminderStore.getDueReminders(new Date());
  assert.equal(due.length, 1);
  assert.equal(due[0].id, 'r1');
});

test('getDueReminders: sem lembretes vencidos retorna array vazio', async (t) => {
  t.mock.method(supabase, 'from', () => fakeQuery({ data: [], error: null }));

  const due = await reminderStore.getDueReminders(new Date());
  assert.deepEqual(due, []);
});

test('claimReminder: ainda pendente, reivindica e devolve a linha atualizada', async (t) => {
  t.mock.method(supabase, 'from', () => fakeQuery({ data: { id: 'r1', status: 'enviado' }, error: null }));

  const reminder = await reminderStore.claimReminder('r1');
  assert.equal(reminder.status, 'enviado');
});

test('claimReminder: já reivindicado por outro processo devolve null', async (t) => {
  // UPDATE ... WHERE status = 'pendente' não afeta nenhuma linha se outro
  // processo já mudou o status antes — maybeSingle() nesse caso resolve com data: null.
  t.mock.method(supabase, 'from', () => fakeQuery({ data: null, error: null }));

  const reminder = await reminderStore.claimReminder('r1');
  assert.equal(reminder, null);
});

test('releaseReminder: volta o status pra pendente sem lançar erro', async (t) => {
  t.mock.method(supabase, 'from', () => fakeQuery({ data: null, error: null }));

  await assert.doesNotReject(() => reminderStore.releaseReminder('r1'));
});
