const { test } = require('node:test');
const assert = require('node:assert/strict');
const { client } = require('../../src/services/claudeClient');
const preferences = require('../../src/services/preferences');

function textResponse(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

test('extractAssistantName: extrai o nome de uma frase completa', async (t) => {
  t.mock.method(client.messages, 'create', async () => textResponse({ name: 'Zeca' }));
  assert.equal(await preferences.extractAssistantName('pode me chamar de Zeca'), 'Zeca');
});

test('extractAssistantName: string vazia vira null', async (t) => {
  t.mock.method(client.messages, 'create', async () => textResponse({ name: '' }));
  assert.equal(await preferences.extractAssistantName('não sei'), null);
});

test('extractTone: reconhece formal e afetuoso', async (t) => {
  t.mock.method(client.messages, 'create', async () => textResponse({ tone: 'formal' }));
  assert.equal(await preferences.extractTone('prefiro algo mais formal'), 'formal');
});

test('extractTone: indefinido vira null', async (t) => {
  t.mock.method(client.messages, 'create', async () => textResponse({ tone: 'indefinido' }));
  assert.equal(await preferences.extractTone('sei lá'), null);
});

test('extractPreferenceUpdate: extrai nome e tom da mesma frase', async (t) => {
  t.mock.method(client.messages, 'create', async () => textResponse({ name: 'Zeca', tone: 'formal' }));
  const result = await preferences.extractPreferenceUpdate('quero te chamar de Zeca e falar mais formal');
  assert.deepEqual(result, { name: 'Zeca', tone: 'formal' });
});

test('extractPreferenceUpdate: campo ausente vira null (atualização parcial)', async (t) => {
  t.mock.method(client.messages, 'create', async () => textResponse({ name: '', tone: 'afetuoso' }));
  const result = await preferences.extractPreferenceUpdate('fala comigo de um jeito mais afetuoso');
  assert.deepEqual(result, { name: null, tone: 'afetuoso' });
});

test('buildConfirmationMessage: nome e tom juntos', () => {
  const msg = preferences.buildConfirmationMessage({ name: 'Zeca', tone: 'formal' });
  assert.match(msg, /Zeca/);
  assert.match(msg, /formal/);
});

test('buildConfirmationMessage: nenhuma preferência reconhecida pede pra repetir', () => {
  const msg = preferences.buildConfirmationMessage({ name: null, tone: null });
  assert.match(msg, /não entendi/i);
});
