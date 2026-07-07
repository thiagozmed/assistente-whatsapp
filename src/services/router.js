const { client, MODELS, firstText, MOCK } = require('./claudeClient');
const { buildVisionContent } = require('./mediaContent');

const INTENT_SCHEMA = {
  type: 'object',
  properties: {
    intent: { type: 'string', enum: ['golpe', 'burocracia', 'preferencia', 'agenda', 'esquecer', 'outro'] },
  },
  required: ['intent'],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `Você classifica mensagens (às vezes com uma imagem anexada) recebidas de um usuário no WhatsApp em uma de seis categorias:
- "golpe": o usuário encaminhou uma mensagem, print ou texto suspeito e quer saber se é golpe.
- "burocracia": o texto ou a imagem é uma tela ou documento confuso de banco, INSS, Receita Federal ou plano de saúde, e o usuário quer entender o que fazer.
- "preferencia": o usuário quer mudar como o assistente o trata — o nome que usa pra chamar o assistente, ou o tom de conversa (mais formal ou mais próximo/afetuoso).
- "agenda": o usuário quer ser lembrado de algo depois — um compromisso, remédio, consulta ou recado (ex: "me lembra de tomar remédio amanhã de manhã").
- "esquecer": o usuário quer que o assistente apague os dados guardados sobre ele (ex: "esquece meus dados", "apaga tudo que você sabe sobre mim").
- "outro": qualquer outra coisa — incluindo fotos e perguntas sobre qualquer assunto do dia a dia que não seja golpe nem burocracia (ex: um aparelho de exercício, uma planta, uma receita, um produto, uma dúvida geral).
Se vier uma imagem, use o conteúdo dela pra classificar — o assunto da imagem importa mais do que a legenda, quando ela existir.`;

function mockClassifyIntent(text) {
  const lower = text.toLowerCase();
  if (/(clique|link|pr[eê]mio|ganhou|senha|c[oó]digo de verifica[cç][aã]o|pix urgente)/.test(lower)) {
    return 'golpe';
  }
  if (/(inss|banco|receita federal|plano de sa[uú]de|cadastro|declara[cç][aã]o|aplicativo)/.test(lower)) {
    return 'burocracia';
  }
  if (/(quero te chamar|me chamar de outro nome|fala comigo de um jeito|mudar (o|meu) tom)/.test(lower)) {
    return 'preferencia';
  }
  if (/(me lembra|lembrete|lembra de|marcar? (uma )?consulta|n[aã]o (me )?deixa esquecer)/.test(lower)) {
    return 'agenda';
  }
  if (/(esque[cç]e meus dados|apaga (tudo|meus dados)|apagar meus dados)/.test(lower)) {
    return 'esquecer';
  }
  return 'outro';
}

async function classifyIntent(text, image) {
  if (MOCK) return mockClassifyIntent(text);

  // output_config.effort não é suportado no Haiku 4.5 — omitir o parâmetro.
  const response = await client.messages.create({
    model: MODELS.HAIKU,
    max_tokens: 256,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema', schema: INTENT_SCHEMA } },
    messages: [{ role: 'user', content: buildVisionContent(text, image) }],
  });

  return JSON.parse(firstText(response)).intent;
}

module.exports = { classifyIntent };
