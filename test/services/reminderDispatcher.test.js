const { test } = require('node:test');
const assert = require('node:assert/strict');
const reminderStore = require('../../src/services/reminderStore');
const whatsapp = require('../../src/services/whatsapp');
const { dispatchDueReminders, startReminderScheduler } = require('../../src/services/reminderDispatcher');

test('dispatchDueReminders: sem lembretes vencidos, não chama WhatsApp', async (t) => {
  t.mock.method(reminderStore, 'getDueReminders', async () => []);
  const sendMock = t.mock.method(whatsapp, 'sendTextMessage', async () => {});

  const count = await dispatchDueReminders(new Date());
  assert.equal(count, 0);
  assert.equal(sendMock.mock.callCount(), 0);
});

test('dispatchDueReminders: reivindica antes de enviar cada lembrete vencido', async (t) => {
  t.mock.method(reminderStore, 'getDueReminders', async () => [
    { id: 'r1', phone_number: '123', description: 'tomar remédio' },
    { id: 'r2', phone_number: '456', description: 'consulta médica' },
  ]);
  const claimMock = t.mock.method(reminderStore, 'claimReminder', async (id) => ({ id, status: 'enviado' }));
  const sendMock = t.mock.method(whatsapp, 'sendTextMessage', async () => {});

  const count = await dispatchDueReminders(new Date());
  assert.equal(count, 2);
  assert.equal(claimMock.mock.callCount(), 2);
  assert.equal(sendMock.mock.callCount(), 2);
  assert.match(sendMock.mock.calls[0].arguments[1], /tomar remédio/);
});

test('dispatchDueReminders: lembrete já reivindicado por outro processo não é enviado de novo', async (t) => {
  t.mock.method(reminderStore, 'getDueReminders', async () => [{ id: 'r1', phone_number: '123', description: 'tomar remédio' }]);
  t.mock.method(reminderStore, 'claimReminder', async () => null); // outro processo já reivindicou
  const sendMock = t.mock.method(whatsapp, 'sendTextMessage', async () => {});

  const count = await dispatchDueReminders(new Date());
  assert.equal(count, 0);
  assert.equal(sendMock.mock.callCount(), 0);
});

test('dispatchDueReminders: falha ao enviar um lembrete devolve ele pra pendente e não impede os demais', async (t) => {
  t.mock.method(reminderStore, 'getDueReminders', async () => [
    { id: 'r1', phone_number: '123', description: 'falha' },
    { id: 'r2', phone_number: '456', description: 'sucesso' },
  ]);
  t.mock.method(reminderStore, 'claimReminder', async (id) => ({ id, status: 'enviado' }));
  const releaseMock = t.mock.method(reminderStore, 'releaseReminder', async () => {});
  let call = 0;
  t.mock.method(whatsapp, 'sendTextMessage', async () => {
    call += 1;
    if (call === 1) throw new Error('simulated WhatsApp outage');
  });

  const count = await dispatchDueReminders(new Date());
  assert.equal(count, 1);
  assert.equal(releaseMock.mock.callCount(), 1);
  assert.equal(releaseMock.mock.calls[0].arguments[0], 'r1');
});

test('startReminderScheduler: devolve um timer que pode ser cancelado', () => {
  const timer = startReminderScheduler({ intervalMs: 60000 });
  assert.doesNotThrow(() => clearInterval(timer));
});
