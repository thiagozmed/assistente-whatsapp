const { test } = require('node:test');
const assert = require('node:assert/strict');
const { client, MODELS } = require('../../src/services/claudeClient');
const { respond, CODE_BLOCKED_MESSAGE, IMAGE_BLOCKED_MESSAGE, looksLikeCode } = require('../../src/services/generalAssistant');

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

  await respond('oi', { assistant_name: 'Zeca', tone: 'descontraído e engraçado' });
  assert.match(capturedSystem, /Zeca/);
  assert.match(capturedSystem, /descontraído e engraçado/);
});

test('looksLikeCode: reconhece blocos de código markdown e padrões comuns', () => {
  assert.equal(looksLikeCode('```python\nprint("oi")\n```'), true);
  assert.equal(looksLikeCode('function soma(a, b) { return a + b; }'), true);
  assert.equal(looksLikeCode('const x = 10;'), true);
  assert.equal(looksLikeCode('Bom dia! Como você está?'), false);
  assert.equal(looksLikeCode('Prazer, pode me chamar de Zeca.'), false);
});

test('respond: barreira determinística bloqueia código mesmo se a triagem deixar passar', async (t) => {
  let call = 0;
  t.mock.method(client.messages, 'create', async () => {
    call += 1;
    if (call === 1) return textResponse({ blocked_reason: 'nenhum', complexity: 'simples' }); // triagem furada
    return textResponse('Claro! Aqui vai:\n```javascript\nfunction soma(a, b) { return a + b; }\n```');
  });

  const reply = await respond('me ajuda com uma coisa', {});
  assert.equal(reply, CODE_BLOCKED_MESSAGE);
});

test('respond: com imagem, usa Sonnet e envia o content block de visão, mesmo com triagem "simples"', async (t) => {
  let call = 0;
  let capturedModel;
  let capturedContent;
  t.mock.method(client.messages, 'create', async (params) => {
    call += 1;
    if (call === 1) return textResponse({ blocked_reason: 'nenhum', complexity: 'simples' });
    capturedModel = params.model;
    capturedContent = params.messages[0].content;
    return textResponse('Isso parece um aparelho de leg press! Ajusta o peso na pilha lateral...');
  });

  const image = { mimeType: 'image/jpeg', buffer: Buffer.from('fake-gym-equipment-photo') };
  const reply = await respond('', {}, image);
  assert.match(reply, /leg press/i);
  assert.equal(capturedModel, MODELS.SONNET);
  assert.equal(capturedContent.length, 1);
  assert.equal(capturedContent[0].type, 'image');
});

test('respond: pergunta que depende de informação atual habilita a busca e escala pro Sonnet', async (t) => {
  let call = 0;
  let capturedModel;
  let capturedTools;
  t.mock.method(client.messages, 'create', async (params) => {
    call += 1;
    if (call === 1) return textResponse({ blocked_reason: 'nenhum', complexity: 'simples', needs_search: true });
    capturedModel = params.model;
    capturedTools = params.tools;
    return textResponse('O jogo do Brasil é hoje às 16h.');
  });

  const reply = await respond('a que horas é o jogo do brasil hoje', {});
  assert.match(reply, /16h/);
  assert.equal(capturedModel, MODELS.SONNET);
  assert.deepEqual(capturedTools, [{ type: 'web_search_20260209', name: 'web_search', max_uses: 2 }]);
});

test('respond: pergunta comum não habilita busca nem manda o parâmetro tools', async (t) => {
  let call = 0;
  let capturedTools = 'not-set';
  t.mock.method(client.messages, 'create', async (params) => {
    call += 1;
    if (call === 1) return textResponse({ blocked_reason: 'nenhum', complexity: 'simples', needs_search: false });
    capturedTools = params.tools;
    return textResponse('Bom dia!');
  });

  await respond('bom dia', {});
  assert.equal(capturedTools, undefined);
});

test('respond: falha de API propaga erro sem travar o processo', async (t) => {
  t.mock.method(client.messages, 'create', async () => {
    throw new Error('simulated Anthropic outage');
  });
  await assert.rejects(() => respond('oi', {}), /simulated Anthropic outage/);
});
