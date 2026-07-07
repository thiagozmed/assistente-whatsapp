const { test } = require('node:test');
const assert = require('node:assert/strict');
const { client } = require('../../src/services/claudeClient');
const { CONSENT_MESSAGE, interpretConsent } = require('../../src/services/consent');

function textResponse(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

test('CONSENT_MESSAGE se identifica como IA e aponta pra política de privacidade', () => {
  assert.match(CONSENT_MESSAGE, /assistente de ia/i);
  assert.match(CONSENT_MESSAGE, /pol[ií]tica de privacidade/i);
});

test('interpretConsent: reconhece "sim"', async (t) => {
  t.mock.method(client.messages, 'create', async () => textResponse({ resposta: 'sim' }));
  assert.equal(await interpretConsent('sim, pode'), 'sim');
});

test('interpretConsent: reconhece "nao"', async (t) => {
  t.mock.method(client.messages, 'create', async () => textResponse({ resposta: 'nao' }));
  assert.equal(await interpretConsent('não quero'), 'nao');
});

test('interpretConsent: resposta ambígua vira indefinido', async (t) => {
  t.mock.method(client.messages, 'create', async () => textResponse({ resposta: 'indefinido' }));
  assert.equal(await interpretConsent('sei lá'), 'indefinido');
});

test('interpretConsent: falha de API propaga erro sem travar o processo', async (t) => {
  t.mock.method(client.messages, 'create', async () => {
    throw new Error('simulated Anthropic outage');
  });
  await assert.rejects(() => interpretConsent('sim'), /simulated Anthropic outage/);
});
