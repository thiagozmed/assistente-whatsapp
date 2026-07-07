const { client, MODELS, firstText, MOCK } = require('./claudeClient');

const CONSENT_MESSAGE = `Oi! Antes de começarmos, uma explicação rápida:

Eu sou um assistente de inteligência artificial (não uma pessoa) — vou te ajudar por aqui a checar se mensagens são golpe, explicar telas confusas, e lembrar você de compromissos.

Pra isso, eu guardo algumas informações suas: o nome que você escolher pra mim, como prefere que eu fale com você, e um resumo curto da última vez que te ajudei (não guardo a conversa inteira). Você pode pedir pra eu apagar tudo isso a qualquer momento, é só me falar "esquece meus dados".

Posso continuar?`;

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

  const { resposta } = JSON.parse(firstText(response));
  return resposta;
}

module.exports = { CONSENT_MESSAGE, interpretConsent };
