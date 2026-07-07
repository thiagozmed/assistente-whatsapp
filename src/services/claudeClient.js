const Anthropic = require('@anthropic-ai/sdk');

// Sem ANTHROPIC_API_KEY / crédito configurado ainda? Defina MOCK_CLAUDE=true no
// .env para simular as respostas com regras simples e testar o fluxo de graça.
const MOCK = process.env.MOCK_CLAUDE === 'true';

const client = MOCK ? null : new Anthropic();

const MODELS = {
  HAIKU: 'claude-haiku-4-5',
  SONNET: 'claude-sonnet-5',
};

function firstText(response) {
  const block = response.content.find((b) => b.type === 'text');
  return block ? block.text : '';
}

module.exports = { client, MODELS, firstText, MOCK };
