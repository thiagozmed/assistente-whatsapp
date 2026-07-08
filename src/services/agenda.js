const { client, MODELS, finalText, MOCK } = require('./claudeClient');
const { buildPersonalizedSystemPrompt } = require('./personalization');

const REMINDER_SCHEMA = {
  type: 'object',
  properties: {
    descricao: { type: 'string' },
    quando_iso: { type: 'string' }, // ISO 8601 com offset -03:00; vazio se não conseguir determinar
    recorrente: { type: 'boolean' },
    resposta_se_incompleto: { type: 'string' }, // resposta natural pro usuário, só quando descricao/quando_iso não deram; vazio se deram
  },
  required: ['descricao', 'quando_iso', 'recorrente', 'resposta_se_incompleto'],
  additionalProperties: false,
};

function mockExtractReminder() {
  return { descricao: null, scheduledAt: null, recorrente: false, respostaSeIncompleto: null };
}

// Antes disso, qualquer extração incompleta (faltou o quê, faltou a hora, ou
// era só uma pergunta tipo "você consegue me lembrar de algo?") caía sempre
// na MESMA frase fixa pedindo pra repetir — soava travado e ignorava o que a
// pessoa realmente perguntou (bug reportado pelo usuário 2026-07-08). Agora o
// próprio Haiku, que já entendeu a mensagem pra tentar extrair o lembrete,
// também gera a resposta de esclarecimento adequada a cada caso.
async function extractReminder(text, referenceDate = new Date(), profile) {
  if (MOCK) return mockExtractReminder();

  const agora = referenceDate.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full', timeStyle: 'short' });

  const response = await client.messages.create({
    model: MODELS.HAIKU,
    max_tokens: 256,
    system: buildPersonalizedSystemPrompt(
      `Você extrai um lembrete de uma mensagem de um usuário brasileiro (texto ou transcrição de áudio).
Agora é: ${agora} (horário de Brasília, fuso America/Sao_Paulo).
"descricao": resumo curto do que é o lembrete (ex: "tomar remédio de pressão"). Vazio ("") se não conseguir determinar.
"quando_iso": data e hora em ISO 8601 com offset -03:00, calculada a partir de "agora" (ex: "amanhã às 3 da tarde" -> data de amanhã, 15:00 -03:00). Vazio ("") se não conseguir determinar uma data/hora específica.
"recorrente": true só se o pedido for claramente repetitivo (ex: "todo dia", "toda semana", "sempre às"). false por padrão.
"resposta_se_incompleto": preencha SÓ se "descricao" ou "quando_iso" ficarem vazios — uma resposta curta, calorosa e natural, adaptada ao que o usuário disse (nunca uma frase genérica fixa). Se ele só perguntou se você é capaz de lembrar algo (ex: "você consegue me lembrar de algo?"), confirme que sim e peça o quê e quando. Se ele tentou pedir um lembrete mas faltou uma parte específica (só a hora, ou só o assunto), peça exatamente o que faltou. Deixe vazio ("") se descricao e quando_iso foram determinados com sucesso.`,
      profile,
    ),
    output_config: { format: { type: 'json_schema', schema: REMINDER_SCHEMA } },
    messages: [{ role: 'user', content: text }],
  });

  const { descricao, quando_iso, recorrente, resposta_se_incompleto: respostaSeIncompleto } = JSON.parse(finalText(response));
  const scheduledAt = quando_iso ? new Date(quando_iso) : null;
  const valid =
    Boolean(descricao) &&
    scheduledAt &&
    !Number.isNaN(scheduledAt.getTime()) &&
    scheduledAt.getTime() > referenceDate.getTime();

  return {
    descricao: descricao || null,
    scheduledAt: valid ? scheduledAt : null,
    recorrente: Boolean(recorrente),
    respostaSeIncompleto: respostaSeIncompleto || null,
  };
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
