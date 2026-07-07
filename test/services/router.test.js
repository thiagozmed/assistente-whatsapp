const { test } = require('node:test');
const assert = require('node:assert/strict');
const { client } = require('../../src/services/claudeClient');
const { classifyIntent } = require('../../src/services/router');

function textResponse(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

test('classifyIntent: reconhece golpe', async (t) => {
  t.mock.method(client.messages, 'create', async () => textResponse({ intent: 'golpe' }));
  assert.equal(await classifyIntent('clique aqui e ganhe um prêmio'), 'golpe');
});

test('classifyIntent: reconhece burocracia', async (t) => {
  t.mock.method(client.messages, 'create', async () => textResponse({ intent: 'burocracia' }));
  assert.equal(await classifyIntent('não entendi essa tela do INSS'), 'burocracia');
});

test('classifyIntent: reconhece agenda', async (t) => {
  t.mock.method(client.messages, 'create', async () => textResponse({ intent: 'agenda' }));
  assert.equal(await classifyIntent('me lembra de tomar remédio amanhã de manhã'), 'agenda');
});

test('classifyIntent: reconhece esquecer', async (t) => {
  t.mock.method(client.messages, 'create', async () => textResponse({ intent: 'esquecer' }));
  assert.equal(await classifyIntent('esquece meus dados, por favor'), 'esquecer');
});

test('classifyIntent: reconhece outro', async (t) => {
  t.mock.method(client.messages, 'create', async () => textResponse({ intent: 'outro' }));
  assert.equal(await classifyIntent('oi, bom dia'), 'outro');
});

test('classifyIntent: falha de API propaga erro', async (t) => {
  t.mock.method(client.messages, 'create', async () => {
    throw new Error('simulated Anthropic outage');
  });
  await assert.rejects(() => classifyIntent('oi'), /simulated Anthropic outage/);
});
