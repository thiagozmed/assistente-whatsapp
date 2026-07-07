const { test } = require('node:test');
const assert = require('node:assert/strict');
const { client } = require('../../src/services/claudeClient');
const { handleIncomingText } = require('../../src/services/messageHandler');

function textResponse(payloadOrText) {
  const text = typeof payloadOrText === 'string' ? payloadOrText : JSON.stringify(payloadOrText);
  return { content: [{ type: 'text', text }] };
}

test('handleIncomingText: golpe -> alerta redigido pelo Sonnet', async (t) => {
  let call = 0;
  t.mock.method(client.messages, 'create', async () => {
    call += 1;
    if (call === 1) return textResponse({ intent: 'golpe' }); // router (Haiku)
    if (call === 2) return textResponse({ classification: 'golpe_conhecido', motivo: 'link suspeito' }); // scamShield.classify
    return textResponse('Isso parece um golpe. Não clique no link.'); // draftAlert (Sonnet)
  });

  const reply = await handleIncomingText('Clique aqui e ganhe um prêmio!');
  assert.match(reply, /não clique/i);
});

test('handleIncomingText: burocracia -> explicação do Sonnet', async (t) => {
  let call = 0;
  t.mock.method(client.messages, 'create', async () => {
    call += 1;
    if (call === 1) return textResponse({ intent: 'burocracia' }); // router (Haiku)
    return textResponse('1. Toque em "Atualizar cadastro".'); // bureaucracy.explain (Sonnet)
  });

  const reply = await handleIncomingText('Não entendi essa tela do banco.');
  assert.match(reply, /atualizar cadastro/i);
});

test('handleIncomingText: intent "outro" cai no fallback', async (t) => {
  t.mock.method(client.messages, 'create', async () => textResponse({ intent: 'outro' }));

  const reply = await handleIncomingText('oi, bom dia');
  assert.match(reply, /posso te ajudar de duas formas/i);
});

test('handleIncomingText: falha da API Claude propaga erro sem travar o processo', async (t) => {
  t.mock.method(client.messages, 'create', async () => {
    throw new Error('simulated Anthropic outage');
  });
  await assert.rejects(() => handleIncomingText('oi'), /simulated Anthropic outage/);
});
