const { test } = require('node:test');
const assert = require('node:assert/strict');
const { client, MODELS } = require('../../src/services/claudeClient');
const { respond, CODE_BLOCKED_MESSAGE, IMAGE_BLOCKED_MESSAGE } = require('../../src/services/generalAssistant');

function textResponse(payloadOrText) {
  const text = typeof payloadOrText === 'string' ? payloadOrText : JSON.stringify(payloadOrText);
  return { content: [{ type: 'text', text }] };
}

test('respond: pedido de código é bloqueado antes de chamar a IA de verdade', async (t) => {
  let call = 0;
  t.mock.method(client.messages, 'create', async (params) => {
    call += 1;
    assert.equal(params.model, MODELS.HAIKU); // só a triagem deveria rodar
    return textResponse({ blocked_reason: 'codigo', complexity: 'simples' });
  });

  const reply = await respond('escreve um código em python pra somar dois números', {});
  assert.equal(reply, CODE_BLOCKED_MESSAGE);
  assert.equal(call, 1);
});

test('respond: pedido de imagem é bloqueado antes de chamar a IA de verdade', async (t) => {
  let call = 0;
  t.mock.method(client.messages, 'create', async () => {
    call += 1;
    return textResponse({ blocked_reason: 'imagem', complexity: 'simples' });
  });

  const reply = await respond('desenha um gato pra mim', {});
  assert.equal(reply, IMAGE_BLOCKED_MESSAGE);
  assert.equal(call, 1);
});

test('respond: mensagem simples roteia pro Haiku (modelo mais barato)', async (t) => {
  let call = 0;
  let capturedModel;
  t.mock.method(client.messages, 'create', async (params) => {
    call += 1;
    if (call === 1) return textResponse({ blocked_reason: 'nenhum', complexity: 'simples' });
    capturedModel = params.model;
    return textResponse('Bom dia! Como posso ajudar?');
  });

  const reply = await respond('bom dia', {});
  assert.equal(reply, 'Bom dia! Como posso ajudar?');
  assert.equal(capturedModel, MODELS.HAIKU);
  assert.equal(call, 2);
});

test('respond: mensagem complexa escala pro Sonnet', async (t) => {
  let call = 0;
  let capturedModel;
  t.mock.method(client.messages, 'create', async (params) => {
    call += 1;
    if (call === 1) return textResponse({ blocked_reason: 'nenhum', complexity: 'complexa' });
    capturedModel = params.model;
    return textResponse('Explicação detalhada em várias etapas.');
  });

  const reply = await respond('explica a diferença entre os planos de saúde e o que compensa mais pro meu caso', {});
  assert.equal(reply, 'Explicação detalhada em várias etapas.');
  assert.equal(capturedModel, MODELS.SONNET);
});

test('respond: personalização do perfil é injetada no system prompt da resposta', async (t) => {
  let call = 0;
  let capturedSystem;
  t.mock.method(client.messages, 'create', async (params) => {
    call += 1;
    if (call === 1) return textResponse({ blocked_reason: 'nenhum', complexity: 'simples' });
    capturedSystem = params.system;
    return textResponse('Oi, Zeca aqui!');
  });

  await respond('oi', { assistant_name: 'Zeca', tone: 'afetuoso' });
  assert.match(capturedSystem, /Zeca/);
  assert.match(capturedSystem, /caloroso e afetuoso/);
});

test('respond: falha de API propaga erro sem travar o processo', async (t) => {
  t.mock.method(client.messages, 'create', async () => {
    throw new Error('simulated Anthropic outage');
  });
  await assert.rejects(() => respond('oi', {}), /simulated Anthropic outage/);
});
