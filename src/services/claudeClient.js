const Anthropic = require('@anthropic-ai/sdk');

// Sem ANTHROPIC_API_KEY / crédito configurado ainda? Defina MOCK_CLAUDE=true no
// .env para simular as respostas com regras simples e testar o fluxo de graça.
const MOCK = process.env.MOCK_CLAUDE === 'true';

const client = MOCK ? null : new Anthropic();

const MODELS = {
  HAIKU: 'claude-haiku-4-5',
  SONNET: 'claude-sonnet-5',
};

// Pega o ÚLTIMO bloco de texto, não o primeiro (bug real 2026-07-07): quando
// a resposta usa uma server tool (ex: busca na internet em
// generalAssistant.js), o content vem como [preâmbulo de texto opcional,
// server_tool_use, tool_result, texto final com a resposta de verdade] — o
// primeiro bloco de texto pode ser só "deixa eu verificar isso...", não a
// resposta. Em chamadas sem tool use (a maioria do código) só existe um
// bloco de texto, então pegar o último não muda nada pra elas.
function finalText(response) {
  const blocks = response.content.filter((b) => b.type === 'text');
  return blocks.length ? blocks[blocks.length - 1].text : '';
}

module.exports = { client, MODELS, finalText, MOCK };
