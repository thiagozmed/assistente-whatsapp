const { client, MODELS, firstText, MOCK } = require('./claudeClient');

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
    tone: { type: 'string', enum: ['formal', 'afetuoso', 'indefinido'] },
  },
  required: ['tone'],
  additionalProperties: false,
};

const PREFERENCE_UPDATE_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' }, // string vazia = usuário não pediu pra mudar o nome
    tone: { type: 'string', enum: ['formal', 'afetuoso', 'nenhuma'] },
  },
  required: ['name', 'tone'],
  additionalProperties: false,
};

function mockExtractAssistantName(text) {
  const match = text.match(/chamar(?: de| você de)? ([A-Za-zÀ-ÿ]+)/i);
  return match ? match[1] : (text.trim().split(/\s+/).length === 1 ? text.trim() : null);
}

function mockExtractTone(text) {
  const lower = text.toLowerCase();
  if (/(formal|respeitos)/.test(lower)) return 'formal';
  if (/(afetuoso|carinhos|pr[oó]ximo|informal)/.test(lower)) return 'afetuoso';
  return null;
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

  const { name } = JSON.parse(firstText(response));
  return name.trim() || null;
}

async function extractTone(text) {
  if (MOCK) return mockExtractTone(text);

  const response = await client.messages.create({
    model: MODELS.HAIKU,
    max_tokens: 128,
    system: `O usuário está respondendo à pergunta "você prefere que eu fale de um jeito mais formal ou mais próximo/afetuoso?" feita por um assistente de IA.
Classifique a preferência em "formal", "afetuoso", ou "indefinido" se não conseguir identificar.`,
    output_config: { format: { type: 'json_schema', schema: TONE_SCHEMA } },
    messages: [{ role: 'user', content: text }],
  });

  const { tone } = JSON.parse(firstText(response));
  return tone === 'indefinido' ? null : tone;
}

async function extractPreferenceUpdate(text) {
  if (MOCK) {
    return { name: mockExtractAssistantName(text), tone: mockExtractTone(text) };
  }

  const response = await client.messages.create({
    model: MODELS.HAIKU,
    max_tokens: 128,
    system: `O usuário quer mudar o nome que usa pra chamar o assistente de IA e/ou o tom de conversa (formal ou afetuoso).
Extraia o novo nome (string vazia se não pediu pra mudar o nome) e o novo tom ("formal", "afetuoso", ou "nenhuma" se não pediu pra mudar o tom).
Exemplo: "quero te chamar de Zeca e falar mais formal" -> name: "Zeca", tone: "formal".`,
    output_config: { format: { type: 'json_schema', schema: PREFERENCE_UPDATE_SCHEMA } },
    messages: [{ role: 'user', content: text }],
  });

  const { name, tone } = JSON.parse(firstText(response));
  return { name: name.trim() || null, tone: tone === 'nenhuma' ? null : tone };
}

function buildConfirmationMessage({ name, tone }) {
  const toneLabel = tone === 'formal' ? 'mais formal' : 'mais próximo e afetuoso';
  if (name && tone) return `Combinado! Agora pode me chamar de ${name}, e vou falar com você de um jeito ${toneLabel}.`;
  if (name) return `Combinado! Agora pode me chamar de ${name}.`;
  if (tone) return `Combinado! Vou falar com você de um jeito ${toneLabel} a partir de agora.`;
  return 'Desculpa, não entendi qual preferência você quer mudar — pode me dizer de novo, tipo "quero te chamar de outro nome" ou "fala comigo de um jeito mais formal"?';
}

module.exports = { extractAssistantName, extractTone, extractPreferenceUpdate, buildConfirmationMessage };
