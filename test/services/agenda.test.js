const { test } = require('node:test');
const assert = require('node:assert/strict');
const { client } = require('../../src/services/claudeClient');
const { extractReminder, buildConfirmationMessage } = require('../../src/services/agenda');

function textResponse(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload) }] };
}

const REFERENCE = new Date('2026-07-07T12:00:00-03:00');

test('extractReminder: caminho feliz extrai descrição e data futura', async (t) => {
  t.mock.method(client.messages, 'create', async () =>
    textResponse({
      descricao: 'tomar remédio de pressão',
      quando_iso: '2026-07-08T08:00:00-03:00',
      recorrente: false,
      resposta_se_incompleto: '',
    }),
  );

  const result = await extractReminder('me lembra de tomar o remédio de pressão amanhã às 8', REFERENCE);
  assert.equal(result.descricao, 'tomar remédio de pressão');
  assert.equal(result.scheduledAt.toISOString(), new Date('2026-07-08T08:00:00-03:00').toISOString());
  assert.equal(result.recorrente, false);
});

test('extractReminder: data no passado é tratada como extração inválida', async (t) => {
  t.mock.method(client.messages, 'create', async () =>
    textResponse({ descricao: 'consulta', quando_iso: '2026-07-01T08:00:00-03:00', recorrente: false }),
  );

  const result = await extractReminder('marca minha consulta', REFERENCE);
  assert.equal(result.scheduledAt, null);
});

test('extractReminder: quando_iso vazio (modelo não entendeu a data) vira scheduledAt null', async (t) => {
  t.mock.method(client.messages, 'create', async () =>
    textResponse({ descricao: 'alguma coisa', quando_iso: '', recorrente: false, resposta_se_incompleto: 'Só falta você me dizer quando!' }),
  );

  const result = await extractReminder('me lembra de algo', REFERENCE);
  assert.equal(result.scheduledAt, null);
});

test('extractReminder: pergunta de capacidade ("você consegue me lembrar de algo?") devolve resposta natural, não a frase genérica fixa (bug real 2026-07-08)', async (t) => {
  t.mock.method(client.messages, 'create', async () =>
    textResponse({
      descricao: '',
      quando_iso: '',
      recorrente: false,
      resposta_se_incompleto: 'Claro, consigo sim! Me conta o que e quando você quer que eu te lembre.',
    }),
  );

  const result = await extractReminder('você consegue me lembrar de algo mais tarde?', REFERENCE);
  assert.equal(result.descricao, null);
  assert.equal(result.scheduledAt, null);
  assert.equal(result.respostaSeIncompleto, 'Claro, consigo sim! Me conta o que e quando você quer que eu te lembre.');
});

test('extractReminder: extração completa não inclui resposta de esclarecimento', async (t) => {
  t.mock.method(client.messages, 'create', async () =>
    textResponse({
      descricao: 'tomar remédio',
      quando_iso: '2026-07-08T08:00:00-03:00',
      recorrente: false,
      resposta_se_incompleto: '',
    }),
  );

  const result = await extractReminder('me lembra de tomar remédio amanhã às 8', REFERENCE);
  assert.equal(result.respostaSeIncompleto, null);
});

test('extractReminder: falha de API propaga erro sem travar o processo', async (t) => {
  t.mock.method(client.messages, 'create', async () => {
    throw new Error('simulated Anthropic outage');
  });
  await assert.rejects(() => extractReminder('oi', REFERENCE), /simulated Anthropic outage/);
});

test('buildConfirmationMessage: lembrete válido confirma data e descrição', () => {
  const msg = buildConfirmationMessage({ descricao: 'tomar remédio', scheduledAt: new Date('2026-07-08T08:00:00-03:00') });
  assert.match(msg, /tomar remédio/);
});

test('buildConfirmationMessage: extração inválida pede pra repetir', () => {
  const msg = buildConfirmationMessage({ descricao: null, scheduledAt: null });
  assert.match(msg, /não consegui entender/i);
});
