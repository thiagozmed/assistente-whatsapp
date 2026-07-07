const { test } = require('node:test');
const assert = require('node:assert/strict');
const { client } = require('../../src/services/claudeClient');
const { explain } = require('../../src/services/bureaucracy');

test('explain: caminho feliz retorna o texto explicado pelo Sonnet', async (t) => {
  t.mock.method(client.messages, 'create', async () => ({
    content: [{ type: 'text', text: '1. Toque em "Atualizar cadastro".\n2. Confirme seus dados.' }],
  }));

  const reply = await explain('Apareceu uma tela pedindo pra atualizar cadastro, o que eu faço?');
  assert.match(reply, /atualizar cadastro/i);
});

test('explain: falha de API propaga erro sem travar o processo', async (t) => {
  t.mock.method(client.messages, 'create', async () => {
    throw new Error('simulated Anthropic outage');
  });
  await assert.rejects(() => explain('oi'), /simulated Anthropic outage/);
});
