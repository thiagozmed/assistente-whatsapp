const Anthropic = require('@anthropic-ai/sdk');

// Sem ANTHROPIC_API_KEY / crédito configurado ainda? Defina MOCK_CLAUDE=true no
// .env para simular as respostas com regras simples e testar o fluxo de graça.
const MOCK = process.env.MOCK_CLAUDE === 'true';

const client = MOCK ? null : new Anthropic();

const MODELS = {
  HAIKU: 'claude-haiku-4-5',
  SONNET: 'claude-sonnet-5',
};

// Concatena todos os blocos de texto DEPOIS do último bloco de ferramenta
// (server_tool_use/tool_result/thinking), não só o último bloco de texto
// (bug real 2026-07-08): com busca na internet, a resposta final às vezes sai
// dividida em vários blocos de texto consecutivos (não um só) — pegar só o
// último bloco (fix de 2026-07-07 pro bug do preâmbulo "deixa eu verificar
// isso...") descartava o começo da resposta de verdade, mandando pro usuário
// só a última frase solta, sem contexto nenhum (ex: usuário perguntou se o
// Brasil ainda estava na Copa, a IA respondeu com só uma frase final que não
// dizia nada). Em chamadas sem tool use (a maioria do código) só existe um
// bloco de texto no final, então isso não muda nada pra elas.
function finalText(response) {
  const blocks = response.content;
  let lastToolIndex = -1;
  blocks.forEach((block, i) => {
    if (block.type !== 'text') lastToolIndex = i;
  });
  return blocks
    .slice(lastToolIndex + 1)
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

module.exports = { client, MODELS, finalText, MOCK };
