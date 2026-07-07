const { client, MODELS, firstText, MOCK } = require('./claudeClient');
const { buildPersonalizedSystemPrompt } = require('./personalization');
const { buildVisionContent } = require('./mediaContent');

const CLASSIFICATION_SCHEMA = {
  type: 'object',
  properties: {
    classification: {
      type: 'string',
      enum: ['golpe_conhecido', 'suspeito', 'legitimo'],
    },
    motivo: { type: 'string' },
  },
  required: ['classification', 'motivo'],
  additionalProperties: false,
};

const CLASSIFY_SYSTEM_PROMPT = `Você é um classificador de golpes digitais (phishing, golpe do PIX, falso funcionário de banco, golpe do WhatsApp clonado, etc) direcionado a idosos no Brasil.
Classifique a mensagem recebida em:
- "golpe_conhecido": segue um padrão de golpe já documentado.
- "suspeito": tem sinais de risco mas não é um padrão claro.
- "legitimo": não há sinais de golpe.
Dê um motivo curto e concreto.`;

const ALERT_SYSTEM_PROMPT = `Você escreve alertas de segurança digital para idosos brasileiros com pouca familiaridade com tecnologia.
Regras:
- Português simples e direto, sem jargão técnico.
- Tom paciente, nunca condescendente ou alarmista.
- Estrutura: (1) o que é essa mensagem, em 1 frase; (2) o que fazer, em passos curtos e concretos (ex: "não clique", "apague a mensagem", "bloqueie o número").
- No máximo 5 linhas.`;

function mockClassify(text = '') {
  const lower = text.toLowerCase();
  if (/(clique|link|pr[eê]mio|ganhou|senha|c[oó]digo de verifica[cç][aã]o)/.test(lower)) {
    return {
      classification: 'golpe_conhecido',
      motivo: '[mock] contém gatilhos típicos de golpe (link, prêmio ou pedido de senha/código).',
    };
  }
  return {
    classification: 'suspeito',
    motivo: '[mock] nenhum padrão claro de golpe conhecido identificado, mas sem confirmação de legitimidade.',
  };
}

async function classify(text, image) {
  if (MOCK) return mockClassify(text);

  // output_config.effort não é suportado no Haiku 4.5 — omitir o parâmetro.
  const response = await client.messages.create({
    model: MODELS.HAIKU,
    max_tokens: 512,
    system: CLASSIFY_SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema', schema: CLASSIFICATION_SCHEMA } },
    messages: [{ role: 'user', content: buildVisionContent(text, image) }],
  });

  return JSON.parse(firstText(response));
}

async function draftAlert(text, classification, motivo, profile) {
  if (classification === 'legitimo') {
    return 'Não encontrei sinais de golpe nessa mensagem. Mesmo assim, se algo parecer estranho, pode me mandar de novo que eu checo com prazer.';
  }

  if (MOCK) {
    return `[MOCK] Isso parece um golpe (${motivo}). O que fazer: não clique em nenhum link, não responda, apague a mensagem e bloqueie o número.`;
  }

  const response = await client.messages.create({
    model: MODELS.SONNET,
    max_tokens: 1024,
    output_config: { effort: 'medium' },
    system: buildPersonalizedSystemPrompt(ALERT_SYSTEM_PROMPT, profile),
    messages: [
      {
        role: 'user',
        content: `Mensagem suspeita recebida:\n"""${text}"""\n\nClassificação: ${classification}\nMotivo: ${motivo}\n\nEscreva o alerta para o idoso.`,
      },
    ],
  });

  return firstText(response);
}

async function checkForScam(text, profile, image) {
  const { classification, motivo } = await classify(text, image);
  const reply = await draftAlert(text, classification, motivo, profile);
  return { classification, motivo, reply };
}

module.exports = { checkForScam };
