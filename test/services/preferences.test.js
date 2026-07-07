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

test('extractTone: extrai a descrição livre do tom pedido', async (t) => {
  t.mock.method(client.messages, 'create', async () => textResponse({ tone: 'formal' }));
  assert.equal(await preferences.extractTone('prefiro algo mais formal'), 'formal');
});

test('extractTone: aceita qualquer descrição, não só formal/informal', async (t) => {
  t.mock.method(client.messages, 'create', async () => textResponse({ tone: 'alegre e engraçado' }));
  assert.equal(await preferences.extractTone('quero que você seja bem alegre e engraçado comigo'), 'alegre e engraçado');
});

test('extractTone: string vazia (não identificou pedido de tom) vira null', async (t) => {
  t.mock.method(client.messages, 'create', async () => textResponse({ tone: '' }));
  assert.equal(await preferences.extractTone('sei lá'), null);
});

test('extractPreferenceUpdate: extrai nome e tom da mesma frase', async (t) => {
  t.mock.method(client.messages, 'create', async () => textResponse({ name: 'Zeca', tone: 'sério e direto' }));
  const result = await preferences.extractPreferenceUpdate('quero te chamar de Zeca e falar mais sério e direto');
  assert.deepEqual(result, { name: 'Zeca', tone: 'sério e direto' });
});

test('extractPreferenceUpdate: campo ausente vira null (atualização parcial)', async (t) => {
  t.mock.method(client.messages, 'create', async () => textResponse({ name: '', tone: 'mais descontraído' }));
  const result = await preferences.extractPreferenceUpdate('fala comigo de um jeito mais descontraído');
  assert.deepEqual(result, { name: null, tone: 'mais descontraído' });
});

test('extractPreferenceUpdate: tom vazio isolado (só pediu pra mudar o nome) vira null', async (t) => {
  t.mock.method(client.messages, 'create', async () => textResponse({ name: 'Cuca', tone: '' }));
  const result = await preferences.extractPreferenceUpdate('quero te chamar de Cuca');
  assert.deepEqual(result, { name: 'Cuca', tone: null });
});

test('buildConfirmationMessage: nome e tom juntos', () => {
  const msg = preferences.buildConfirmationMessage({ name: 'Zeca', tone: 'sério' });
  assert.match(msg, /Zeca/);
  assert.match(msg, /sério/);
});

test('buildConfirmationMessage: nenhuma preferência reconhecida pede pra repetir', () => {
  const msg = preferences.buildConfirmationMessage({ name: null, tone: null });
  assert.match(msg, /não entendi/i);
});
