const { classifyIntent } = require('./router');
const { checkForScam } = require('./scamShield');
const { explain } = require('./bureaucracy');

const FALLBACK_REPLY = `Oi! Eu posso te ajudar de duas formas:

1) Me manda uma mensagem ou print suspeito que eu checo se é golpe.
2) Me manda o texto de uma tela confusa (banco, INSS, Receita) que eu explico o que fazer, passo a passo.`;

async function handleIncomingText(text) {
  const intent = await classifyIntent(text);

  if (intent === 'golpe') {
    const { reply } = await checkForScam(text);
    return reply;
  }

  if (intent === 'burocracia') {
    return explain(text);
  }

  return FALLBACK_REPLY;
}

module.exports = { handleIncomingText };
