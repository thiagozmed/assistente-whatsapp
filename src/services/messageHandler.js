const profileStore = require('./profileStore');
const preferences = require('./preferences');
const reminderStore = require('./reminderStore');
const agenda = require('./agenda');
const transcription = require('./transcription');
const consent = require('./consent');
const rateLimit = require('./rateLimit');
const generalAssistant = require('./generalAssistant');
const { classifyIntent } = require('./router');
const { checkForScam } = require('./scamShield');
const { explain } = require('./bureaucracy');

const RATE_LIMIT_MESSAGE =
  'Você já trocou bastante mensagem comigo hoje! Pra eu continuar ajudando direitinho, vamos retomar amanhã, tá bom? Se for urgente, o melhor é ligar pra alguém de confiança agora.';

// Protege contra "paste bombs" (custo de token e possível abuso) antes de
// tocar em qualquer serviço — o WhatsApp já limita mensagens de texto a
// poucos milhares de caracteres, isso é só uma segunda trava nossa.
const MAX_TEXT_LENGTH = 4000;
const MESSAGE_TOO_LONG_MESSAGE =
  'Essa mensagem ficou grande demais pra eu processar de uma vez — pode tentar resumir ou mandar em partes menores?';

const ASK_NAME_MESSAGE = 'Oi! Eu sou seu assistente por aqui. Como você gostaria de me chamar?';
const ONBOARDING_RETRY_NAME =
  'Desculpa, não peguei o nome — pode me dizer de novo? Por exemplo: "pode me chamar de Zeca".';
const ONBOARDING_RETRY_TONE =
  'Desculpa, não entendi — como você gostaria que eu falasse com você? Pode ser do jeito que você quiser: formal, informal, alegre, sério... fica a seu critério.';
const ONBOARDING_NEEDS_TEXT_MESSAGE =
  'Antes de eu conseguir olhar essa imagem, preciso terminar de te conhecer — pode responder em texto por enquanto?';
const TRANSCRIPTION_FAILURE_MESSAGE =
  'Desculpa, não consegui entender esse áudio agora. Pode tentar gravar de novo, ou me mandar por texto?';
const CONSENT_RETRY_MESSAGE = 'Desculpa, não entendi — posso continuar? Pode responder só "sim" ou "não".';
const CONSENT_DECLINED_MESSAGE =
  'Sem problemas — mas, pra eu conseguir te ajudar de verdade, preciso guardar pelo menos essas informações básicas. Se mudar de ideia, é só me chamar de novo quando quiser.';
const DATA_DELETED_MESSAGE = 'Pronto, apaguei todos os seus dados que eu tinha guardado — nome, preferências e lembretes.';

// Confirmação explícita antes de apagar (CLAUDE.md 6.3 / risco de SIM swap ou
// celular roubado): sem isso, uma única mensagem de quem estiver de posse do
// número do usuário apagava tudo na hora, sem chance de desfazer.
const CONFIRM_FORGET_MESSAGE =
  'Tem certeza que quer que eu apague tudo que guardei sobre você — nome, preferências e lembretes? Isso não pode ser desfeito. Responda "sim" pra confirmar, ou "não" pra deixar como está.';
const FORGET_CANCELLED_MESSAGE = 'Tudo bem, não vou apagar nada. Seus dados continuam guardados normalmente.';
const CONFIRM_FORGET_RETRY_MESSAGE =
  'Desculpa, não entendi — quer mesmo que eu apague seus dados guardados? Responda só "sim" ou "não".';
const PENDING_FORGET_NEEDS_TEXT_MESSAGE =
  'Antes de eu continuar, preciso que você confirme se quer mesmo apagar seus dados — responda "sim" ou "não" em texto, por favor.';

// Tom livre (desde 2026-07-07) não tem mais um enum de duas opções travando
// o tamanho — sem isso, um resumo anormalmente longo do Haiku ficaria salvo
// pra sempre e reinjetado em todo system prompt futuro do usuário.
const MAX_TONE_LENGTH = 60;

function askToneMessage(assistantName) {
  return `Prazer! Pode me chamar de ${assistantName}. Como você gostaria que eu falasse com você? Pode ser formal, informal, alegre, sério... fica a seu critério.`;
}

function welcomeMessage(profile) {
  return `Combinado! Vou falar com você desse jeito: ${profile.tone}. Pode me chamar de ${profile.assistant_name} sempre que precisar.

Ah, só pra você saber o que eu consigo fazer: posso checar se um site, anúncio ou mensagem suspeita é golpe, tirar dúvida sobre qualquer assunto de tecnologia, buscar uma informação rápida na internet quando for preciso, e também analisar fotos que você mandar — de tela confusa a documento. Tudo isso funciona por áudio também, é só mandar gravando que eu entendo.

Em que posso ajudar?`;
}

function truncate(text, max) {
  if (!text || text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

// A mensagem de consentimento promete "é só me falar 'esquece meus dados'" a
// qualquer momento — sem isso, um usuário que pedisse isso no meio do
// onboarding (antes de onboarding_state === 'completo') caía direto na
// extração de nome/tom da etapa atual, que ignorava o pedido e insistia
// perguntando a mesma coisa de novo.
async function checkOnboardingForgetRequest(phoneNumber, text) {
  const intent = await classifyIntent(text);
  if (intent !== 'esquecer') return null;
  await profileStore.updatePendingAction(phoneNumber, 'confirmar_esquecer');
  return CONFIRM_FORGET_MESSAGE;
}

async function handleIncomingText(phoneNumber, text, referenceTimestamp = new Date()) {
  if (text && text.length > MAX_TEXT_LENGTH) return MESSAGE_TOO_LONG_MESSAGE;

  let profile = await profileStore.getProfile(phoneNumber);

  if (!profile) {
    await profileStore.createProfile(phoneNumber);
    return consent.CONSENT_MESSAGE;
  }

  if (profile.pending_action === 'confirmar_esquecer') {
    const resposta = await consent.interpretConsent(text);
    if (resposta === 'sim') {
      await profileStore.deleteProfile(phoneNumber);
      return DATA_DELETED_MESSAGE;
    }
    if (resposta === 'nao') {
      await profileStore.updatePendingAction(phoneNumber, null);
      return FORGET_CANCELLED_MESSAGE;
    }
    return CONFIRM_FORGET_RETRY_MESSAGE;
  }

  if (profile.onboarding_state === 'aguardando_consentimento') {
    const forget = await checkOnboardingForgetRequest(phoneNumber, text);
    if (forget) return forget;
    const resposta = await consent.interpretConsent(text);
    if (resposta === 'sim') {
      await profileStore.recordConsent(phoneNumber);
      return ASK_NAME_MESSAGE;
    }
    if (resposta === 'nao') return CONSENT_DECLINED_MESSAGE;
    return CONSENT_RETRY_MESSAGE;
  }

  if (profile.onboarding_state === 'aguardando_nome') {
    const forget = await checkOnboardingForgetRequest(phoneNumber, text);
    if (forget) return forget;
    const name = await preferences.extractAssistantName(text);
    if (!name) return ONBOARDING_RETRY_NAME;
    const updated = await profileStore.updateName(phoneNumber, name);
    return askToneMessage(updated.assistant_name);
  }

  if (profile.onboarding_state === 'aguardando_tom') {
    const forget = await checkOnboardingForgetRequest(phoneNumber, text);
    if (forget) return forget;
    const tone = await preferences.extractTone(text);
    if (!tone) return ONBOARDING_RETRY_TONE;
    const updated = await profileStore.updateTone(phoneNumber, truncate(tone, MAX_TONE_LENGTH));
    return welcomeMessage(updated);
  }

  const { allowed } = await rateLimit.checkAndIncrement(phoneNumber);
  if (!allowed) return RATE_LIMIT_MESSAGE;

  const intent = await classifyIntent(text, undefined, profile);

  if (intent === 'golpe') {
    const { classification, motivo, reply } = await checkForScam(text, profile);
    await profileStore.recordInteraction(phoneNumber, { type: 'golpe', summary: `${classification} — ${motivo}` });
    return reply;
  }

  if (intent === 'burocracia') {
    const reply = await explain(text, profile);
    await profileStore.recordInteraction(phoneNumber, { type: 'burocracia', summary: truncate(reply, 200) });
    return reply;
  }

  if (intent === 'preferencia') {
    const update = await preferences.extractPreferenceUpdate(text);
    if (update.tone) update.tone = truncate(update.tone, MAX_TONE_LENGTH);
    if (update.name || update.tone) {
      await profileStore.updatePreference(phoneNumber, update);
    }
    return preferences.buildConfirmationMessage(update);
  }

  if (intent === 'agenda') {
    const { descricao, scheduledAt } = await agenda.extractReminder(text, referenceTimestamp);
    if (descricao && scheduledAt) {
      await reminderStore.createReminder(phoneNumber, { description: descricao, scheduledAt });
    }
    return agenda.buildConfirmationMessage({ descricao, scheduledAt });
  }

  if (intent === 'esquecer') {
    await profileStore.updatePendingAction(phoneNumber, 'confirmar_esquecer');
    return CONFIRM_FORGET_MESSAGE;
  }

  const reply = await generalAssistant.respond(text, profile);
  await profileStore.recordInteraction(phoneNumber, { type: 'geral', summary: truncate(reply, 200) });
  return reply;
}

async function handleIncomingImage(phoneNumber, media, caption) {
  if (caption && caption.length > MAX_TEXT_LENGTH) return MESSAGE_TOO_LONG_MESSAGE;

  const profile = await profileStore.getProfile(phoneNumber);

  if (!profile) {
    await profileStore.createProfile(phoneNumber);
    return consent.CONSENT_MESSAGE;
  }

  if (profile.pending_action === 'confirmar_esquecer') {
    return PENDING_FORGET_NEEDS_TEXT_MESSAGE;
  }

  if (profile.onboarding_state !== 'completo') {
    return ONBOARDING_NEEDS_TEXT_MESSAGE;
  }

  const { allowed } = await rateLimit.checkAndIncrement(phoneNumber);
  if (!allowed) return RATE_LIMIT_MESSAGE;

  const intent = await classifyIntent(caption || '', media, profile);

  if (intent === 'golpe') {
    const { classification, motivo, reply } = await checkForScam(caption || '', profile, media);
    await profileStore.recordInteraction(phoneNumber, { type: 'golpe', summary: `${classification} — ${motivo}` });
    return reply;
  }

  if (intent === 'burocracia') {
    const reply = await explain(caption || '', profile, media);
    await profileStore.recordInteraction(phoneNumber, { type: 'burocracia', summary: truncate(reply, 200) });
    return reply;
  }

  const reply = await generalAssistant.respond(caption || '', profile, media);
  await profileStore.recordInteraction(phoneNumber, { type: 'geral', summary: truncate(reply, 200) });
  return reply;
}

async function handleIncomingAudio(phoneNumber, media, referenceTimestamp = new Date()) {
  let transcript;
  try {
    transcript = await transcription.transcribeAudio(media.buffer, media.mimeType);
  } catch (err) {
    console.error('Erro transcrevendo áudio:', err.message);
    return TRANSCRIPTION_FAILURE_MESSAGE;
  }

  return handleIncomingText(phoneNumber, transcript, referenceTimestamp);
}

module.exports = { handleIncomingText, handleIncomingImage, handleIncomingAudio };
