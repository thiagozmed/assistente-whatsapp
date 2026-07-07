const { client, MODELS, finalText, MOCK } = require('./claudeClient');

const NAME_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' }, // string vazia = não conseguiu identificar um nome
  },
  required: ['name'],
  additionalProperties: false,
};

const TONE_SCHEMA = {
  type: 'object',
  properties: {
    tone: { type: 'string' }, // resumo curto do tom pedido pelo usuário, em texto livre; string vazia = não identificou
  },
  required: ['tone'],
  additionalProperties: false,
};

const PREFERENCE_UPDATE_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' }, // string vazia = usuário não pediu pra mudar o nome
    tone: { type: 'string' }, // string vazia = usuário não pediu pra mudar o tom
  },
  required: ['name', 'tone'],
  additionalProperties: false,
};

function mockExtractAssistantName(text) {
  const match = text.match(/chamar(?: de| você de)? ([A-Za-zÀ-ÿ]+)/i);
  return match ? match[1] : (text.trim().split(/\s+/).length === 1 ? text.trim() : null);
}

function mockExtractTone(text) {
  const trimmed = text.trim();
  if (!trimmed || /^(sei l[aá]|n[aã]o sei|hein)\??$/i.test(trimmed)) return null;
  return trimmed;
}

async function extractAssistantName(text) {
  if (MOCK) return mockExtractAssistantName(text);

  const response = await client.messages.create({
    model: MODELS.HAIKU,
    max_tokens: 128,
    system: `O usuário está respondendo à pergunta "como você quer me chamar?" feita por um assistente de IA.
Extraia só o nome escolhido (ex: em "pode me chamar de Zeca" extraia "Zeca"). Se não conseguir identificar um nome, retorne uma string vazia.`,
    output_config: { format: { type: 'json_schema', schema: NAME_SCHEMA } },
    messages: [{ role: 'user', content: text }],
  });

  const { name } = JSON.parse(finalText(response));
  return name.trim() || null;
}

async function extractTone(text) {
  if (MOCK) return mockExtractTone(text);

  const response = await client.messages.create({
    model: MODELS.HAIKU,
    max_tokens: 128,
    system: `O usuário está respondendo à pergunta "como você gostaria que eu falasse com você?" feita por um assistente de IA — a escolha do tom é livre (formal, informal, alegre, sério, o que a pessoa quiser), sem opções fixas.
Extraia um resumo bem curto (poucas palavras) do estilo de conversa pedido, do jeito que o usuário descreveu (ex: "formal", "informal e brincalhão", "sério e direto ao ponto", "bem à vontade"). Se não conseguir identificar nenhum pedido de tom, retorne uma string vazia.`,
    output_config: { format: { type: 'json_schema', schema: TONE_SCHEMA } },
    messages: [{ role: 'user', content: text }],
  });

  const { tone } = JSON.parse(finalText(response));
  return tone.trim() || null;
}

async function extractPreferenceUpdate(text) {
  if (MOCK) {
    return { name: mockExtractAssistantName(text), tone: mockExtractTone(text) };
  }

  const response = await client.messages.create({
    model: MODELS.HAIKU,
    max_tokens: 128,
    system: `O usuário quer mudar o nome que usa pra chamar o assistente de IA e/ou o tom de conversa — a escolha do tom é livre (formal, informal, alegre, sério, o que a pessoa quiser), sem opções fixas.
Extraia o novo nome (string vazia se não pediu pra mudar o nome) e um resumo bem curto do novo tom pedido, do jeito que o usuário descreveu (string vazia se não pediu pra mudar o tom).
Exemplo: "quero te chamar de Zeca e falar mais sério" -> name: "Zeca", tone: "sério".`,
    output_config: { format: { type: 'json_schema', schema: PREFERENCE_UPDATE_SCHEMA } },
    messages: [{ role: 'user', content: text }],
  });

  const { name, tone } = JSON.parse(finalText(response));
  return { name: name.trim() || null, tone: tone.trim() || null };
}

function buildConfirmationMessage({ name, tone }) {
  if (name && tone) return `Combinado! Agora pode me chamar de ${name}, e vou falar com você desse jeito: ${tone}.`;
  if (name) return `Combinado! Agora pode me chamar de ${name}.`;
  if (tone) return `Combinado! Vou falar com você desse jeito: ${tone} a partir de agora.`;
  return 'Desculpa, não entendi qual preferência você quer mudar — pode me dizer de novo, tipo "quero te chamar de outro nome" ou "fala comigo de um jeito mais sério"?';
}

module.exports = { extractAssistantName, extractTone, extractPreferenceUpdate, buildConfirmationMessage };
