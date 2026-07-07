const { test } = require('node:test');
const assert = require('node:assert/strict');
const { client } = require('../../src/services/claudeClient');
const profileStore = require('../../src/services/profileStore');
const reminderStore = require('../../src/services/reminderStore');
const transcription = require('../../src/services/transcription');
const consent = require('../../src/services/consent');
const rateLimit = require('../../src/services/rateLimit');
const generalAssistant = require('../../src/services/generalAssistant');
const { handleIncomingText, handleIncomingImage, handleIncomingAudio } = require('../../src/services/messageHandler');

function mockRateLimitAllowed(t) {
  return t.mock.method(rateLimit, 'checkAndIncrement', async () => ({ allowed: true, count: 1 }));
}

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

test('handleIncomingText: número novo dispara onboarding (pede consentimento) sem rotear a mensagem', async (t) => {
  t.mock.method(profileStore, 'getProfile', async () => null);
  const createMock = t.mock.method(profileStore, 'createProfile', async () => ({
    phone_number: '5511999999999',
    onboarding_state: 'aguardando_consentimento',
  }));
  const createModelMock = t.mock.method(client.messages, 'create', async () => {
    throw new Error('não deveria classificar intenção durante onboarding');
  });

  const reply = await handleIncomingText('5511999999999', 'oi');
  assert.equal(reply, consent.CONSENT_MESSAGE);
  assert.equal(createMock.mock.callCount(), 1);
  assert.equal(createModelMock.mock.callCount(), 0);
});

test('handleIncomingText: onboarding aguardando_consentimento com "sim" registra consentimento e pergunta o nome', async (t) => {
  t.mock.method(profileStore, 'getProfile', async () => ({
    phone_number: '5511999999999',
    onboarding_state: 'aguardando_consentimento',
  }));
  const recordMock = t.mock.method(profileStore, 'recordConsent', async () => ({
    phone_number: '5511999999999',
    onboarding_state: 'aguardando_nome',
  }));
  t.mock.method(client.messages, 'create', async () => textResponse({ resposta: 'sim' }));

  const reply = await handleIncomingText('5511999999999', 'sim, pode');
  assert.match(reply, /como você gostaria de me chamar/i);
  assert.equal(recordMock.mock.callCount(), 1);
});

test('handleIncomingText: onboarding aguardando_consentimento com "não" não avança e não apaga nada', async (t) => {
  t.mock.method(profileStore, 'getProfile', async () => ({
    phone_number: '5511999999999',
    onboarding_state: 'aguardando_consentimento',
  }));
  const recordMock = t.mock.method(profileStore, 'recordConsent', async () => ({}));
  t.mock.method(client.messages, 'create', async () => textResponse({ resposta: 'nao' }));

  const reply = await handleIncomingText('5511999999999', 'não quero');
  assert.match(reply, /sem problemas/i);
  assert.equal(recordMock.mock.callCount(), 0);
});

test('handleIncomingText: onboarding aguardando_consentimento com resposta ambígua pede pra repetir', async (t) => {
  t.mock.method(profileStore, 'getProfile', async () => ({
    phone_number: '5511999999999',
    onboarding_state: 'aguardando_consentimento',
  }));
  t.mock.method(client.messages, 'create', async () => textResponse({ resposta: 'indefinido' }));

  const reply = await handleIncomingText('5511999999999', 'sei lá');
  assert.match(reply, /posso continuar/i);
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
  mockRateLimitAllowed(t);
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
  mockRateLimitAllowed(t);
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
  mockRateLimitAllowed(t);
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

test('handleIncomingText: intent "outro" chama o assistente de conversa geral e registra a interação', async (t) => {
  mockRateLimitAllowed(t);
  t.mock.method(profileStore, 'getProfile', async () => COMPLETED_PROFILE);
  const recordMock = t.mock.method(profileStore, 'recordInteraction', async () => COMPLETED_PROFILE);
  const respondMock = t.mock.method(generalAssistant, 'respond', async () => 'Bom dia! Como posso ajudar hoje?');
  t.mock.method(client.messages, 'create', async () => textResponse({ intent: 'outro' }));

  const reply = await handleIncomingText('5511999999999', 'oi, bom dia');
  assert.equal(reply, 'Bom dia! Como posso ajudar hoje?');
  assert.equal(respondMock.mock.callCount(), 1);
  assert.equal(recordMock.mock.calls[0].arguments[1].type, 'geral');
});

test('handleIncomingText: limite diário de mensagens atingido bloqueia antes de classificar intenção', async (t) => {
  t.mock.method(profileStore, 'getProfile', async () => COMPLETED_PROFILE);
  t.mock.method(rateLimit, 'checkAndIncrement', async () => ({ allowed: false, count: 61 }));
  const createModelMock = t.mock.method(client.messages, 'create', async () => {
    throw new Error('não deveria chamar a IA depois do limite diário estourado');
  });

  const reply = await handleIncomingText('5511999999999', 'mais uma pergunta');
  assert.match(reply, /amanhã/i);
  assert.equal(createModelMock.mock.callCount(), 0);
});

test('handleIncomingText: intent "agenda" cria o lembrete e confirma', async (t) => {
  mockRateLimitAllowed(t);
  t.mock.method(profileStore, 'getProfile', async () => COMPLETED_PROFILE);
  const createMock = t.mock.method(reminderStore, 'createReminder', async () => ({}));

  const reference = new Date('2026-07-07T12:00:00-03:00');
  let call = 0;
  t.mock.method(client.messages, 'create', async () => {
    call += 1;
    if (call === 1) return textResponse({ intent: 'agenda' }); // router
    return textResponse({ descricao: 'tomar remédio', quando_iso: '2026-07-08T08:00:00-03:00', recorrente: false }); // agenda.extractReminder
  });

  const reply = await handleIncomingText('5511999999999', 'me lembra de tomar remédio amanhã às 8', reference);
  assert.match(reply, /tomar remédio/);
  assert.equal(createMock.mock.callCount(), 1);
  assert.equal(createMock.mock.calls[0].arguments[0], '5511999999999');
});

test('handleIncomingText: intent "agenda" sem data válida não cria lembrete e pede pra repetir', async (t) => {
  mockRateLimitAllowed(t);
  t.mock.method(profileStore, 'getProfile', async () => COMPLETED_PROFILE);
  const createMock = t.mock.method(reminderStore, 'createReminder', async () => ({}));

  let call = 0;
  t.mock.method(client.messages, 'create', async () => {
    call += 1;
    if (call === 1) return textResponse({ intent: 'agenda' });
    return textResponse({ descricao: '', quando_iso: '', recorrente: false });
  });

  const reply = await handleIncomingText('5511999999999', 'me lembra de uma coisa');
  assert.match(reply, /não consegui entender/i);
  assert.equal(createMock.mock.callCount(), 0);
});

test('handleIncomingText: intent "esquecer" pede confirmação em vez de apagar na hora', async (t) => {
  mockRateLimitAllowed(t);
  t.mock.method(profileStore, 'getProfile', async () => COMPLETED_PROFILE);
  const deleteMock = t.mock.method(profileStore, 'deleteProfile', async () => {});
  const pendingMock = t.mock.method(profileStore, 'updatePendingAction', async () => ({}));
  t.mock.method(client.messages, 'create', async () => textResponse({ intent: 'esquecer' }));

  const reply = await handleIncomingText('5511999999999', 'esquece meus dados, por favor');
  assert.match(reply, /tem certeza/i);
  assert.equal(deleteMock.mock.callCount(), 0);
  assert.equal(pendingMock.mock.calls[0].arguments[0], '5511999999999');
  assert.equal(pendingMock.mock.calls[0].arguments[1], 'confirmar_esquecer');
});

test('handleIncomingText: confirmação "sim" com ação pendente apaga o perfil de verdade', async (t) => {
  t.mock.method(profileStore, 'getProfile', async () => ({ ...COMPLETED_PROFILE, pending_action: 'confirmar_esquecer' }));
  const deleteMock = t.mock.method(profileStore, 'deleteProfile', async () => {});
  t.mock.method(client.messages, 'create', async () => textResponse({ resposta: 'sim' }));

  const reply = await handleIncomingText('5511999999999', 'sim, pode apagar');
  assert.match(reply, /apaguei/i);
  assert.equal(deleteMock.mock.callCount(), 1);
  assert.equal(deleteMock.mock.calls[0].arguments[0], '5511999999999');
});

test('handleIncomingText: confirmação "não" com ação pendente cancela sem apagar', async (t) => {
  t.mock.method(profileStore, 'getProfile', async () => ({ ...COMPLETED_PROFILE, pending_action: 'confirmar_esquecer' }));
  const deleteMock = t.mock.method(profileStore, 'deleteProfile', async () => {});
  const clearMock = t.mock.method(profileStore, 'updatePendingAction', async () => ({}));
  t.mock.method(client.messages, 'create', async () => textResponse({ resposta: 'nao' }));

  const reply = await handleIncomingText('5511999999999', 'não, deixa como está');
  assert.match(reply, /não vou apagar/i);
  assert.equal(deleteMock.mock.callCount(), 0);
  assert.equal(clearMock.mock.calls[0].arguments[1], null);
});

test('handleIncomingText: resposta ambígua com ação pendente pede pra repetir sem apagar', async (t) => {
  t.mock.method(profileStore, 'getProfile', async () => ({ ...COMPLETED_PROFILE, pending_action: 'confirmar_esquecer' }));
  const deleteMock = t.mock.method(profileStore, 'deleteProfile', async () => {});
  t.mock.method(client.messages, 'create', async () => textResponse({ resposta: 'indefinido' }));

  const reply = await handleIncomingText('5511999999999', 'hein?');
  assert.match(reply, /não entendi/i);
  assert.equal(deleteMock.mock.callCount(), 0);
});

test('handleIncomingText: mensagem acima do limite de tamanho é rejeitada antes de tocar em qualquer serviço', async (t) => {
  const getProfileMock = t.mock.method(profileStore, 'getProfile', async () => COMPLETED_PROFILE);
  const createModelMock = t.mock.method(client.messages, 'create', async () => {
    throw new Error('não deveria chamar a IA com mensagem gigante');
  });

  const reply = await handleIncomingText('5511999999999', 'x'.repeat(4001));
  assert.match(reply, /grande demais/i);
  assert.equal(getProfileMock.mock.callCount(), 0);
  assert.equal(createModelMock.mock.callCount(), 0);
});

test('handleIncomingText: falha da API Claude propaga erro sem travar o processo', async (t) => {
  mockRateLimitAllowed(t);
  t.mock.method(profileStore, 'getProfile', async () => COMPLETED_PROFILE);
  t.mock.method(client.messages, 'create', async () => {
    throw new Error('simulated Anthropic outage');
  });
  await assert.rejects(() => handleIncomingText('5511999999999', 'oi'), /simulated Anthropic outage/);
});

const FAKE_IMAGE = { mimeType: 'image/jpeg', buffer: Buffer.from('fake-screenshot-bytes') };
const FAKE_AUDIO = { mimeType: 'audio/ogg', buffer: Buffer.from('fake-audio-bytes') };

test('handleIncomingImage: número novo dispara onboarding (pede consentimento)', async (t) => {
  t.mock.method(profileStore, 'getProfile', async () => null);
  t.mock.method(profileStore, 'createProfile', async () => ({ onboarding_state: 'aguardando_consentimento' }));

  const reply = await handleIncomingImage('5511999999999', FAKE_IMAGE, undefined);
  assert.equal(reply, consent.CONSENT_MESSAGE);
});

test('handleIncomingImage: onboarding incompleto pede pra terminar em texto', async (t) => {
  t.mock.method(profileStore, 'getProfile', async () => ({ onboarding_state: 'aguardando_tom' }));

  const reply = await handleIncomingImage('5511999999999', FAKE_IMAGE, undefined);
  assert.match(reply, /terminar de te conhecer/i);
});

test('handleIncomingImage: sem legenda, trata como burocracia', async (t) => {
  mockRateLimitAllowed(t);
  t.mock.method(profileStore, 'getProfile', async () => COMPLETED_PROFILE);
  const recordMock = t.mock.method(profileStore, 'recordInteraction', async () => COMPLETED_PROFILE);
  t.mock.method(client.messages, 'create', async () => textResponse('1. Toque em ATUALIZAR CADASTRO.'));

  const reply = await handleIncomingImage('5511999999999', FAKE_IMAGE, undefined);
  assert.match(reply, /atualizar cadastro/i);
  assert.equal(recordMock.mock.calls[0].arguments[1].type, 'burocracia');
});

test('handleIncomingImage: legenda de golpe roteia pro escudo contra golpe', async (t) => {
  mockRateLimitAllowed(t);
  t.mock.method(profileStore, 'getProfile', async () => COMPLETED_PROFILE);
  const recordMock = t.mock.method(profileStore, 'recordInteraction', async () => COMPLETED_PROFILE);

  let call = 0;
  t.mock.method(client.messages, 'create', async () => {
    call += 1;
    if (call === 1) return textResponse({ intent: 'golpe' }); // router pela legenda
    if (call === 2) return textResponse({ classification: 'golpe_conhecido', motivo: 'print de golpe' });
    return textResponse('É golpe. Não clique.');
  });

  const reply = await handleIncomingImage('5511999999999', FAKE_IMAGE, 'isso é golpe?');
  assert.match(reply, /não clique/i);
  assert.equal(recordMock.mock.calls[0].arguments[1].type, 'golpe');
});

test('handleIncomingImage: limite diário atingido bloqueia antes de classificar legenda', async (t) => {
  t.mock.method(profileStore, 'getProfile', async () => COMPLETED_PROFILE);
  t.mock.method(rateLimit, 'checkAndIncrement', async () => ({ allowed: false, count: 61 }));
  const createModelMock = t.mock.method(client.messages, 'create', async () => {
    throw new Error('não deveria chamar a IA depois do limite diário estourado');
  });

  const reply = await handleIncomingImage('5511999999999', FAKE_IMAGE, 'isso é golpe?');
  assert.match(reply, /amanhã/i);
  assert.equal(createModelMock.mock.callCount(), 0);
});

test('handleIncomingAudio: transcreve e processa como texto normal', async (t) => {
  mockRateLimitAllowed(t);
  t.mock.method(transcription, 'transcribeAudio', async () => 'me lembra de tomar remédio amanhã às 8');
  t.mock.method(profileStore, 'getProfile', async () => COMPLETED_PROFILE);
  t.mock.method(reminderStore, 'createReminder', async () => ({}));

  let call = 0;
  t.mock.method(client.messages, 'create', async () => {
    call += 1;
    if (call === 1) return textResponse({ intent: 'agenda' });
    return textResponse({ descricao: 'tomar remédio', quando_iso: '2026-07-08T08:00:00-03:00', recorrente: false });
  });

  const reply = await handleIncomingAudio('5511999999999', FAKE_AUDIO, new Date('2026-07-07T12:00:00-03:00'));
  assert.match(reply, /tomar remédio/);
});

test('handleIncomingAudio: falha de transcrição responde amigável sem travar o processo', async (t) => {
  t.mock.method(transcription, 'transcribeAudio', async () => {
    throw new Error('simulated Whisper outage');
  });

  const reply = await handleIncomingAudio('5511999999999', FAKE_AUDIO);
  assert.match(reply, /não consegui entender esse áudio/i);
});
