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

test('finalText: resposta final dividida em vários blocos de texto consecutivos é concatenada inteira (bug real 2026-07-08)', () => {
  // Formato real observado em produção: com busca na internet, a resposta
  // final às vezes vem em VÁRIOS blocos "text" seguidos, não um só. Pegar só
  // o último (fix anterior, 2026-07-07) mandava pro usuário uma frase solta
  // sem o resto da resposta (ex: usuário perguntou se o Brasil seguia na
  // Copa, e recebeu só "Se quiser, posso te contar quem são os favoritos!").
  const response = {
    content: [
      { type: 'thinking', thinking: '' },
      { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'brasil copa do mundo 2026' } },
      { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [] },
      { type: 'text', text: 'Não, o Brasil já foi eliminado! 😔\n\n' },
      { type: 'text', text: 'A Seleção perdeu por 2 a 1 para a Noruega nas oitavas de final.' },
    ],
  };
  assert.equal(finalText(response), 'Não, o Brasil já foi eliminado! 😔\n\nA Seleção perdeu por 2 a 1 para a Noruega nas oitavas de final.');
});
