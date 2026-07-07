const { client, MODELS, firstText, MOCK } = require('./claudeClient');
const { buildPersonalizedSystemPrompt } = require('./personalization');
const { buildVisionContent } = require('./mediaContent');

const SYSTEM_PROMPT = `Você explica telas e textos de burocracia digital brasileira (banco, INSS, Receita Federal, plano de saúde) para idosos com pouca familiaridade com tecnologia.
Regras:
- Português simples, direto, sem jargão.
- Tom sempre paciente — nunca faça o usuário sentir que a dúvida é "boba".
- Estrutura em passos numerados curtos: o que apertar, nessa ordem.
- Se faltar informação para ter certeza, diga isso e peça o dado que falta em vez de adivinhar.`;

async function explain(text, profile, image) {
  if (MOCK) {
    return `[MOCK] Passo a passo (simulado, sem chamar a IA de verdade):\n1. Leia com calma o texto que você recebeu.\n2. Procure o botão ou link principal da tela.\n3. Se tiver dúvida sobre pedir dado sensível (senha, CPF completo), não preencha ainda e me pergunte de novo com mais detalhes.\n\nTexto recebido: "${text}"`;
  }

  const response = await client.messages.create({
    model: MODELS.SONNET,
    max_tokens: 1024,
    output_config: { effort: 'medium' },
    system: buildPersonalizedSystemPrompt(SYSTEM_PROMPT, profile),
    messages: [{ role: 'user', content: buildVisionContent(text, image) }],
  });

  return firstText(response);
}

module.exports = { explain };
