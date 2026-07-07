const { client, MODELS, firstText, MOCK } = require('./claudeClient');

const INTENT_SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: ['golpe', 'burocracia', 'outro'] },
  },
  required: ['intent'],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `Você classifica mensagens recebidas de um idoso no WhatsApp em uma de três categorias:
- "golpe": o usuário encaminhou uma mensagem, print ou texto suspeito e quer saber se é golpe.
- "burocracia": o usuário colou um texto confuso de banco, INSS, Receita Federal ou plano de saúde e quer entender o que fazer.
- "outro": qualquer outra coisa (saudação, pergunta fora de escopo, etc).`;

function mockClassifyIntent(text) {
  const lower = text.toLowerCase();
  if (/(clique|link|pr[eê]mio|ganhou|senha|c[oó]digo de verifica[cç][aã]o|pix urgente)/.test(lower)) {
    return 'golpe';
  }
  if (/(inss|banco|receita federal|plano de sa[uú]de|cadastro|declara[cç][aã]o|aplicativo)/.test(lower)) {
    return 'burocracia';
  }
  return 'outro';
}

async function classifyIntent(text) {
  if (MOCK) return mockClassifyIntent(text);

  // output_config.effort não é suportado no Haiku 4.5 — omitir o parâmetro.
  const response = await client.messages.create({
    model: MODELS.HAIKU,
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema', schema: INTENT_SCHEMA } },
    messages: [{ role: 'user', content: text }],
  });

  return JSON.parse(firstText(response)).intent;
}

module.exports = { classifyIntent };
