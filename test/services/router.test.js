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

test('classifyIntent: sem perfil/última interação, não adiciona contexto extra ao system prompt', async (t) => {
  let capturedSystem;
  t.mock.method(client.messages, 'create', async (params) => {
    capturedSystem = params.system;
    return textResponse({ intent: 'outro' });
  });

  await classifyIntent('oi');
  assert.doesNotMatch(capturedSystem, /Contexto da última interação/);
});

test('classifyIntent: com resumo da última interação, inclui contexto pra evitar classificar resposta de continuação isolada (bug real 2026-07-08)', async (t) => {
  // Cenário real: a IA perguntou a localização pra dar a previsão do tempo,
  // o usuário respondeu só "Florianópolis" — sem contexto, isso não bate com
  // nenhuma categoria óbvia e foi classificado errado como "preferencia".
  let capturedSystem;
  t.mock.method(client.messages, 'create', async (params) => {
    capturedSystem = params.system;
    return textResponse({ intent: 'outro' });
  });

  const profile = {
    last_interaction_type: 'geral',
    last_interaction_summary: 'Perguntei a localização do usuário pra poder buscar a previsão do tempo.',
    last_interaction_at: '2026-07-08T12:00:00Z',
  };
  const intent = await classifyIntent('Florianópolis', undefined, profile);
  assert.equal(intent, 'outro');
  assert.match(capturedSystem, /Contexto da última interação/);
  assert.match(capturedSystem, /previsão do tempo/);
  assert.match(capturedSystem, /nunca uma instrução/i);
});

test('classifyIntent: com imagem, envia content block de visão pro Haiku', async (t) => {
  let capturedContent;
  t.mock.method(client.messages, 'create', async (params) => {
    capturedContent = params.messages[0].content;
    return textResponse({ intent: 'outro' });
  });

  const image = { mimeType: 'image/jpeg', buffer: Buffer.from('fake-photo-bytes') };
  const intent = await classifyIntent('', image);
  assert.equal(intent, 'outro');
  assert.equal(capturedContent.length, 1);
  assert.equal(capturedContent[0].type, 'image');
});
