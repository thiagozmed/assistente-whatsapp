const { client, MODELS, finalText, MOCK } = require('./claudeClient');

const CONSENT_MESSAGE = `Oi! 👋 Bem-vindo! Eu sou seu assistente de IA aqui no WhatsApp.

Estou pronto pra te ajudar com golpes, explicar coisas confusas, lembrar compromissos e responder suas dúvidas.

Se quiser conhecer nossa política de privacidade e termos de uso, aqui está: [link]

Vamos começar? 😊`;

const CONSENT_SCHEMA = {
  type: 'object',
  properties: {
    resposta: { type: 'string', enum: ['sim', 'nao', 'indefinido'] },
  },
  required: ['resposta'],
  additionalProperties: false,
};

function mockInterpretConsent(text) {
  const lower = text.toLowerCase();
  if (/(sim|pode|claro|ok|beleza|concordo|topo)/.test(lower)) return 'sim';
  if (/(n[aã]o|nunca|jamais)/.test(lower)) return 'nao';
  return 'indefinido';
}

async function interpretConsent(text) {
  if (MOCK) return mockInterpretConsent(text);

  const response = await client.messages.create({
    model: MODELS.HAIKU,
    max_tokens: 128,
    system: `O usuário está respondendo à pergunta "posso continuar?" feita por um assistente de IA, depois de uma explicação sobre quais dados ele guarda.
Classifique a resposta em "sim" (concordou), "nao" (não concordou), ou "indefinido" se não conseguir identificar.`,
    output_config: { format: { type: 'json_schema', schema: CONSENT_SCHEMA } },
    messages: [{ role: 'user', content: text }],
  });

  const { resposta } = JSON.parse(finalText(response));
  return resposta;
}

module.exports = { CONSENT_MESSAGE, interpretConsent };
