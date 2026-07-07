const { test } = require('node:test');
const assert = require('node:assert/strict');
const { client } = require('../../src/services/claudeClient');
const { checkForScam } = require('../../src/services/scamShield');

function textResponse(payloadOrText) {
  const text = typeof payloadOrText === 'string' ? payloadOrText : JSON.stringify(payloadOrText);
  return { content: [{ type: 'text', text }] };
}

test('checkForScam: golpe conhecido chama classify (Haiku) e draftAlert (Sonnet)', async (t) => {
  let call = 0;
  t.mock.method(client.messages, 'create', async () => {
    call += 1;
    if (call === 1) {
      return textResponse({ classification: 'golpe_conhecido', motivo: 'link suspeito de prêmio' });
    }
    return textResponse('É golpe. Não clique no link.');
  });

  const { classification, reply } = await checkForScam('Você ganhou um prêmio, clique aqui!');
  assert.equal(classification, 'golpe_conhecido');
  assert.match(reply, /não clique/i);
  assert.equal(call, 2);
});

test('checkForScam: legítimo usa resposta fixa e não chama o Sonnet', async (t) => {
  const createMock = t.mock.method(client.messages, 'create', async () =>
    textResponse({ classification: 'legitimo', motivo: 'nenhum sinal de golpe' }),
  );

  const { reply } = await checkForScam('Sua fatura do cartão fechou em R$150.');
  assert.match(reply, /não encontrei sinais de golpe/i);
  // Só a chamada de classify (Haiku) deveria ter acontecido, não a de draftAlert (Sonnet).
  assert.equal(createMock.mock.callCount(), 1);
});

test('checkForScam: mensagem ambígua classificada como suspeito também gera alerta', async (t) => {
  let call = 0;
  t.mock.method(client.messages, 'create', async () => {
    call += 1;
    if (call === 1) {
      return textResponse({
        classification: 'suspeito',
        motivo: 'pede confirmação de dados mas não segue um padrão de golpe já documentado',
      });
    }
    return textResponse('Não tenho certeza se é golpe, mas por segurança não clique em nada.');
  });

  const { classification, reply } = await checkForScam(
    'Sua operadora identificou uma atualização pendente no seu plano, ligue para confirmar seus dados.',
  );
  assert.equal(classification, 'suspeito');
  assert.match(reply, /não clique/i);
  assert.equal(call, 2);
});

test('checkForScam: personalização do perfil é injetada no system prompt do alerta', async (t) => {
  let call = 0;
  let capturedSystem;
  t.mock.method(client.messages, 'create', async (params) => {
    call += 1;
    if (call === 1) return textResponse({ classification: 'golpe_conhecido', motivo: 'link suspeito' });
    capturedSystem = params.system;
    return textResponse('Não clique no link.');
  });

  await checkForScam('Clique aqui e ganhe um prêmio!', { assistant_name: 'Zeca', tone: 'carinhoso e informal' });
  assert.match(capturedSystem, /Zeca/);
  assert.match(capturedSystem, /carinhoso e informal/);
});

test('checkForScam: com imagem, envia content block de visão pro classify (Haiku)', async (t) => {
  let call = 0;
  let capturedContent;
  t.mock.method(client.messages, 'create', async (params) => {
    call += 1;
    if (call === 1) {
      capturedContent = params.messages[0].content;
      return textResponse({ classification: 'golpe_conhecido', motivo: 'print de golpe do falso banco' });
    }
    return textResponse('É golpe. Não clique em nada.');
  });

  const image = { mimeType: 'image/jpeg', buffer: Buffer.from('fake-screenshot-bytes') };
  const { classification } = await checkForScam('', undefined, image);
  assert.equal(classification, 'golpe_conhecido');
  assert.equal(capturedContent.length, 1);
  assert.equal(capturedContent[0].type, 'image');
});

test('checkForScam: falha de API propaga erro sem travar o processo', async (t) => {
  t.mock.method(client.messages, 'create', async () => {
    throw new Error('simulated Anthropic outage');
  });
  await assert.rejects(() => checkForScam('oi'), /simulated Anthropic outage/);
});
