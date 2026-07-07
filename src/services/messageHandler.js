const profileStore = require('./profileStore');
const preferences = require('./preferences');
const reminderStore = require('./reminderStore');
const agenda = require('./agenda');
const transcription = require('./transcription');
const consent = require('./consent');
const { classifyIntent } = require('./router');
const { checkForScam } = require('./scamShield');
const { explain } = require('./bureaucracy');

const FALLBACK_REPLY = `Oi! Eu posso te ajudar de várias formas:

1) Me manda uma mensagem ou print suspeito que eu checo se é golpe.
2) Me manda o texto ou foto de uma tela confusa (banco, INSS, Receita) que eu explico o que fazer, passo a passo.
3) Me manda um áudio ou texto pra eu te lembrar de algo depois (remédio, consulta, compromisso).`;

const ASK_NAME_MESSAGE = 'Oi! Eu sou seu assistente por aqui. Como você gostaria de me chamar?';
const ONBOARDING_RETRY_NAME =
  'Desculpa, não peguei o nome — pode me dizer de novo? Por exemplo: "pode me chamar de Zeca".';
const ONBOARDING_RETRY_TONE =
  'Desculpa, não entendi — você prefere que eu fale com você de um jeito mais formal, ou mais próximo e afetuoso?';
const ONBOARDING_NEEDS_TEXT_MESSAGE =
  'Antes de eu conseguir olhar essa imagem, preciso terminar de te conhecer — pode responder em texto por enquanto?';
const TRANSCRIPTION_FAILURE_MESSAGE =
  'Desculpa, não consegui entender esse áudio agora. Pode tentar gravar de novo, ou me mandar por texto?';
const CONSENT_RETRY_MESSAGE = 'Desculpa, não entendi — posso continuar? Pode responder só "sim" ou "não".';
const CONSENT_DECLINED_MESSAGE =
  'Sem problemas — mas, pra eu conseguir te ajudar de verdade, preciso guardar pelo menos essas informações básicas. Se mudar de ideia, é só me chamar de novo quando quiser.';
const DATA_DELETED_MESSAGE = 'Pronto, apaguei todos os seus dados que eu tinha guardado — nome, preferências e lembretes.';

function askToneMessage(assistantName) {
  return `Prazer! Pode me chamar de ${assistantName}. Você prefere que eu fale com você de um jeito mais formal, ou mais próximo e afetuoso?`;
}

function welcomeMessage(profile) {
  const toneLabel = profile.tone === 'formal' ? 'mais formal' : 'mais próximo e afetuoso';
  return `Combinado! Vou falar com você de um jeito ${toneLabel}. Pode me chamar de ${profile.assistant_name} sempre que precisar. Em que posso ajudar?`;
}

function truncate(text, max) {
  if (!text || text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

async function handleIncomingText(phoneNumber, text, referenceTimestamp = new Date()) {
  let profile = await profileStore.getProfile(phoneNumber);

  if (!profile) {
    await profileStore.createProfile(phoneNumber);
    return consent.CONSENT_MESSAGE;
  }

  if (profile.onboarding_state === 'aguardando_consentimento') {
    const resposta = await consent.interpretConsent(text);
    if (resposta === 'sim') {
      await profileStore.recordConsent(phoneNumber);
      return ASK_NAME_MESSAGE;
    }
    if (resposta === 'nao') return CONSENT_DECLINED_MESSAGE;
    return CONSENT_RETRY_MESSAGE;
  }

  if (profile.onboarding_state === 'aguardando_nome') {
    const name = await preferences.extractAssistantName(text);
    if (!name) return ONBOARDING_RETRY_NAME;
    const updated = await profileStore.updateName(phoneNumber, name);
    return askToneMessage(updated.assistant_name);
  }

  if (profile.onboarding_state === 'aguardando_tom') {
    const tone = await preferences.extractTone(text);
    if (!tone) return ONBOARDING_RETRY_TONE;
    const updated = await profileStore.updateTone(phoneNumber, tone);
    return welcomeMessage(updated);
  }

  const intent = await classifyIntent(text);

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
    await profileStore.deleteProfile(phoneNumber);
    return DATA_DELETED_MESSAGE;
  }

  return FALLBACK_REPLY;
}

async function handleIncomingImage(phoneNumber, media, caption) {
  const profile = await profileStore.getProfile(phoneNumber);

  if (!profile) {
    await profileStore.createProfile(phoneNumber);
    return consent.CONSENT_MESSAGE;
  }

  if (profile.onboarding_state !== 'completo') {
    return ONBOARDING_NEEDS_TEXT_MESSAGE;
  }

  const intent = caption ? await classifyIntent(caption) : 'burocracia';

  if (intent === 'golpe') {
    const { classification, motivo, reply } = await checkForScam(caption || '', profile, media);
    await profileStore.recordInteraction(phoneNumber, { type: 'golpe', summary: `${classification} — ${motivo}` });
    return reply;
  }

  const reply = await explain(caption || '', profile, media);
  await profileStore.recordInteraction(phoneNumber, { type: 'burocracia', summary: truncate(reply, 200) });
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
