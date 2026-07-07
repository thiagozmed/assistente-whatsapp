const profileStore = require('./profileStore');
const preferences = require('./preferences');
const { classifyIntent } = require('./router');
const { checkForScam } = require('./scamShield');
const { explain } = require('./bureaucracy');

const FALLBACK_REPLY = `Oi! Eu posso te ajudar de duas formas:

1) Me manda uma mensagem ou print suspeito que eu checo se é golpe.
2) Me manda o texto de uma tela confusa (banco, INSS, Receita) que eu explico o que fazer, passo a passo.`;

const ASK_NAME_MESSAGE = 'Oi! Eu sou seu assistente por aqui. Como você gostaria de me chamar?';
const ONBOARDING_RETRY_NAME =
  'Desculpa, não peguei o nome — pode me dizer de novo? Por exemplo: "pode me chamar de Zeca".';
const ONBOARDING_RETRY_TONE =
  'Desculpa, não entendi — você prefere que eu fale com você de um jeito mais formal, ou mais próximo e afetuoso?';

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

async function handleIncomingText(phoneNumber, text) {
  let profile = await profileStore.getProfile(phoneNumber);

  if (!profile) {
    await profileStore.createProfile(phoneNumber);
    return ASK_NAME_MESSAGE;
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

  return FALLBACK_REPLY;
}

module.exports = { handleIncomingText };
