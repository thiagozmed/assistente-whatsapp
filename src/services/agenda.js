const { client, MODELS, finalText, MOCK } = require('./claudeClient');

const REMINDER_SCHEMA = {
  type: 'object',
  properties: {
    descricao: { type: 'string' },
    quando_iso: { type: 'string' }, // ISO 8601 com offset -03:00; vazio se não conseguir determinar
    recorrente: { type: 'boolean' },
  },
  required: ['descricao', 'quando_iso', 'recorrente'],
  additionalProperties: false,
};

function mockExtractReminder() {
  return { descricao: null, scheduledAt: null, recorrente: false };
}

async function extractReminder(text, referenceDate = new Date()) {
  if (MOCK) return mockExtractReminder();

  const agora = referenceDate.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full', timeStyle: 'short' });

  const response = await client.messages.create({
    model: MODELS.HAIKU,
    max_tokens: 256,
    system: `Você extrai um lembrete de uma mensagem de um usuário brasileiro (texto ou transcrição de áudio).
Agora é: ${agora} (horário de Brasília, fuso America/Sao_Paulo).
"descricao": resumo curto do que é o lembrete (ex: "tomar remédio de pressão").
"quando_iso": data e hora em ISO 8601 com offset -03:00, calculada a partir de "agora" (ex: "amanhã às 3 da tarde" -> data de amanhã, 15:00 -03:00). Deixe vazio ("") se não conseguir determinar uma data/hora específica.
"recorrente": true só se o pedido for claramente repetitivo (ex: "todo dia", "toda semana", "sempre às"). false por padrão.`,
    output_config: { format: { type: 'json_schema', schema: REMINDER_SCHEMA } },
    messages: [{ role: 'user', content: text }],
  });

  const { descricao, quando_iso, recorrente } = JSON.parse(finalText(response));
  const scheduledAt = quando_iso ? new Date(quando_iso) : null;
  const valid =
    Boolean(descricao) &&
    scheduledAt &&
    !Number.isNaN(scheduledAt.getTime()) &&
    scheduledAt.getTime() > referenceDate.getTime();

  return { descricao: descricao || null, scheduledAt: valid ? scheduledAt : null, recorrente: Boolean(recorrente) };
}

function buildConfirmationMessage({ descricao, scheduledAt }) {
  if (!descricao || !scheduledAt) {
    return 'Desculpa, não consegui entender direito o que e quando você quer que eu te lembre — pode me dizer de novo? Por exemplo: "me lembra de tomar remédio amanhã às 8 da manhã".';
  }

  const quando = scheduledAt.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  });
  return `Combinado! Vou te lembrar de "${descricao}" em ${quando}.`;
}

module.exports = { extractReminder, buildConfirmationMessage };
