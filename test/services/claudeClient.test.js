const { test } = require('node:test');
const assert = require('node:assert/strict');
const { finalText } = require('../../src/services/claudeClient');

test('finalText: resposta simples de um bloco de texto só', () => {
  const response = { content: [{ type: 'text', text: 'Bom dia!' }] };
  assert.equal(finalText(response), 'Bom dia!');
});

test('finalText: com tool use, pega o ÚLTIMO bloco de texto, não o preâmbulo (bug real 2026-07-07)', () => {
  // Formato real de uma resposta com server tool (ex: web_search): texto de
  // preâmbulo -> uso da ferramenta -> resultado -> texto final de verdade.
  const response = {
    content: [
      { type: 'text', text: 'Deixa eu verificar isso pra você...' },
      { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'jogo do brasil hoje' } },
      { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [] },
      { type: 'text', text: 'O jogo do Brasil é hoje às 16h.' },
    ],
  };
  assert.equal(finalText(response), 'O jogo do Brasil é hoje às 16h.');
});

test('finalText: nenhum bloco de texto (ex: cortado por max_tokens) devolve string vazia', () => {
  const response = { content: [{ type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: {} }] };
  assert.equal(finalText(response), '');
});
