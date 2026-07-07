const { test } = require('node:test');
const assert = require('node:assert/strict');
const { client } = require('../../src/services/claudeClient');
const profileStore = require('../../src/services/profileStore');
const { handleIncomingText } = require('../../src/services/messageHandler');

function textResponse(payloadOrText) {
  const text = typeof payloadOrText === 'string' ? payloadOrText : JSON.stringify(payloadOrText);
  return { content: [{ type: 'text', text }] };
}

const COMPLETED_PROFILE = {
  phone_number: '5511999999999',
  assistant_name: 'Zeca',
  tone: 'afetuoso',
  onboarding_state: 'completo',
  last_interaction_summary: null,
};

test('handleIncomingText: número novo dispara onboarding (pergunta o nome) sem rotear a mensagem', async (t) => {
  t.mock.method(profileStore, 'getProfile', async () => null);
  const createMock = t.mock.method(profileStore, 'createProfile', async () => ({
    phone_number: '5511999999999',
    onboarding_state: 'aguardando_nome',
  }));
  const createModelMock = t.mock.method(client.messages, 'create', async () => {
    throw new Error('não deveria classificar intenção durante onboarding');
  });

  const reply = await handleIncomingText('5511999999999', 'oi');
  assert.match(reply, /como você gostaria de me chamar/i);
  assert.equal(createMock.mock.callCount(), 1);
  assert.equal(createModelMock.mock.callCount(), 0);
});

test('handleIncomingText: onboarding aguardando_nome extrai o nome e pergunta o tom', async (t) => {
  t.mock.method(profileStore, 'getProfile', async () => ({
    phone_number: '5511999999999',
    onboarding_state: 'aguardando_nome',
  }));
  t.mock.method(profileStore, 'updateName', async (phone, name) => ({
    phone_number: phone,
    assistant_name: name,
    onboarding_state: 'aguardando_tom',
  }));
  t.mock.method(client.messages, 'create', async () => textResponse({ name: 'Zeca' }));

  const reply = await handleIncomingText('5511999999999', 'pode me chamar de Zeca');
  assert.match(reply, /Zeca/);
  assert.match(reply, /formal.*afetuoso|afetuoso.*formal/i);
});

test('handleIncomingText: onboarding aguardando_tom conclui e dá boas-vindas', async (t) => {
  t.mock.method(profileStore, 'getProfile', async () => ({
    phone_number: '5511999999999',
    assistant_name: 'Zeca',
    onboarding_state: 'aguardando_tom',
  }));
  t.mock.method(profileStore, 'updateTone', async (phone, tone) => ({
    phone_number: phone,
    assistant_name: 'Zeca',
    tone,
    onboarding_state: 'completo',
  }));
  t.mock.method(client.messages, 'create', async () => textResponse({ tone: 'afetuoso' }));

  const reply = await handleIncomingText('5511999999999', 'pode ser mais afetuoso');
  assert.match(reply, /Zeca/);
  assert.match(reply, /combinado/i);
});

test('handleIncomingText: golpe -> alerta redigido pelo Sonnet e resumo registrado', async (t) => {
  t.mock.method(profileStore, 'getProfile', async () => COMPLETED_PROFILE);
  const recordMock = t.mock.method(profileStore, 'recordInteraction', async () => COMPLETED_PROFILE);

  let call = 0;
  t.mock.method(client.messages, 'create', async () => {
    call += 1;
    if (call === 1) return textResponse({ intent: 'golpe' }); // router (Haiku)
    if (call === 2) return textResponse({ classification: 'golpe_conhecido', motivo: 'link suspeito' }); // scamShield.classify
    return textResponse('Isso parece um golpe. Não clique no link.'); // draftAlert (Sonnet)
  });

  const reply = await handleIncomingText('5511999999999', 'Clique aqui e ganhe um prêmio!');
  assert.match(reply, /não clique/i);
  assert.equal(recordMock.mock.callCount(), 1);
  assert.equal(recordMock.mock.calls[0].arguments[1].type, 'golpe');
});

test('handleIncomingText: burocracia -> explicação do Sonnet e resumo registrado', async (t) => {
  t.mock.method(profileStore, 'getProfile', async () => COMPLETED_PROFILE);
  const recordMock = t.mock.method(profileStore, 'recordInteraction', async () => COMPLETED_PROFILE);

  let call = 0;
  t.mock.method(client.messages, 'create', async () => {
    call += 1;
    if (call === 1) return textResponse({ intent: 'burocracia' }); // router (Haiku)
    return textResponse('1. Toque em "Atualizar cadastro".'); // bureaucracy.explain (Sonnet)
  });

  const reply = await handleIncomingText('5511999999999', 'Não entendi essa tela do banco.');
  assert.match(reply, /atualizar cadastro/i);
  assert.equal(recordMock.mock.callCount(), 1);
  assert.equal(recordMock.mock.calls[0].arguments[1].type, 'burocracia');
});

test('handleIncomingText: intent "preferencia" atualiza o perfil e confirma', async (t) => {
  t.mock.method(profileStore, 'getProfile', async () => COMPLETED_PROFILE);
  const updateMock = t.mock.method(profileStore, 'updatePreference', async () => ({ ...COMPLETED_PROFILE, assistant_name: 'Cuca' }));

  let call = 0;
  t.mock.method(client.messages, 'create', async () => {
    call += 1;
    if (call === 1) return textResponse({ intent: 'preferencia' }); // router
    return textResponse({ name: 'Cuca', tone: 'nenhuma' }); // preferences.extractPreferenceUpdate
  });

  const reply = await handleIncomingText('5511999999999', 'quero te chamar de outro nome, Cuca');
  assert.match(reply, /Cuca/);
  assert.equal(updateMock.mock.callCount(), 1);
});

test('handleIncomingText: intent "outro" cai no fallback', async (t) => {
  t.mock.method(profileStore, 'getProfile', async () => COMPLETED_PROFILE);
  t.mock.method(client.messages, 'create', async () => textResponse({ intent: 'outro' }));

  const reply = await handleIncomingText('5511999999999', 'oi, bom dia');
  assert.match(reply, /posso te ajudar de duas formas/i);
});

test('handleIncomingText: falha da API Claude propaga erro sem travar o processo', async (t) => {
  t.mock.method(profileStore, 'getProfile', async () => COMPLETED_PROFILE);
  t.mock.method(client.messages, 'create', async () => {
    throw new Error('simulated Anthropic outage');
  });
  await assert.rejects(() => handleIncomingText('5511999999999', 'oi'), /simulated Anthropic outage/);
});
