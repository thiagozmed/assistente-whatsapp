const { test } = require('node:test');
const assert = require('node:assert/strict');
const { client } = require('../../src/services/claudeClient');
const { CONSENT_MESSAGE, interpretConsent } = require('../../src/services/consent');

function textResponse(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

test('CONSENT_MESSAGE explica que é uma IA e o que guarda', () => {
  assert.match(CONSENT_MESSAGE, /intelig[eê]ncia artificial/i);
  assert.match(CONSENT_MESSAGE, /esquece meus dados/i);
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
