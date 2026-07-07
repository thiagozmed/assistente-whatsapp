const { client, MODELS, firstText, MOCK } = require('./claudeClient');
const { buildPersonalizedSystemPrompt } = require('./personalization');

const TRIAGE_SCHEMA = {
  type: 'object',
  properties: {
    blocked_reason: { type: 'string', enum: ['codigo', 'imagem', 'nenhum'] },
    complexity: { type: 'string', enum: ['simples', 'complexa'] },
  },
  required: ['blocked_reason', 'complexity'],
  additionalProperties: false,
};

const TRIAGE_SYSTEM_PROMPT = `Você faz uma triagem rápida de mensagens recebidas por um assistente de propósito geral no WhatsApp, antes de gerar a resposta de verdade.
Avalie:
- "blocked_reason": "codigo" se o usuário está pedindo pra escrever, corrigir ou explicar código de programação linha a linha; "imagem" se está pedindo pra gerar, desenhar ou criar uma imagem; "nenhum" caso contrário.
- "complexity": "simples" para saudações, perguntas factuais curtas, conversa cotidiana; "complexa" se exige explicação em várias etapas, comparação ou raciocínio mais longo.`;

const GENERAL_SYSTEM_PROMPT = `Você é um assistente de propósito geral, acessado por WhatsApp, atendendo principalmente pessoas com pouca familiaridade com tecnologia no Brasil.
Regras inegociáveis:
- Você é uma inteligência artificial. Se perguntarem diretamente se você é humano, ou insinuarem isso, seja honesto — nunca finja ser uma pessoa.
- Se o usuário disser que você é o único que o entende, ou o único com quem ele conversa, acolha com carinho, mas reforce gentilmente o valor de ligar ou visitar família e amigos — nunca absorva esse papel sozinho.
- Português simples, direto, frases curtas. Tom paciente, nunca condescendente.
- Você não escreve código de programação nem gera/desenha imagens.`;

const CODE_BLOCKED_MESSAGE =
  'Isso eu não faço por aqui — não escrevo nem corrijo código de programação. Mas se for outra coisa, pode me perguntar que eu ajudo com prazer!';
const IMAGE_BLOCKED_MESSAGE =
  'Isso eu não faço por aqui — não crio nem desenho imagens. Mas se for outra coisa, pode me perguntar que eu ajudo com prazer!';

function mockTriage(text = '') {
  const lower = text.toLowerCase();
  if (/(escreve|corrige|gera).{0,20}(c[oó]digo|script|fun[cç][aã]o|programa)|em (python|javascript|java|html)/.test(lower)) {
    return { blocked_reason: 'codigo', complexity: 'simples' };
  }
  if (/(desenha|cria uma imagem|gera uma imagem|faz um desenho)/.test(lower)) {
    return { blocked_reason: 'imagem', complexity: 'simples' };
  }
  return { blocked_reason: 'nenhum', complexity: lower.length > 80 ? 'complexa' : 'simples' };
}

async function triage(text) {
  if (MOCK) return mockTriage(text);

  // output_config.effort não é suportado no Haiku 4.5 — omitir o parâmetro.
  const response = await client.messages.create({
    model: MODELS.HAIKU,
    max_tokens: 256,
    system: TRIAGE_SYSTEM_PROMPT,
    output_config: { format: { type: 'json_schema', schema: TRIAGE_SCHEMA } },
    messages: [{ role: 'user', content: text }],
  });

  return JSON.parse(firstText(response));
}

async function respond(text, profile) {
  const { blocked_reason: blockedReason, complexity } = await triage(text);

  if (blockedReason === 'codigo') return CODE_BLOCKED_MESSAGE;
  if (blockedReason === 'imagem') return IMAGE_BLOCKED_MESSAGE;

  if (MOCK) return `[MOCK] Resposta geral simulada (sem chamar a IA de verdade) para: "${text}"`;

  const model = complexity === 'complexa' ? MODELS.SONNET : MODELS.HAIKU;
  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    ...(model === MODELS.SONNET ? { output_config: { effort: 'medium' } } : {}),
    system: buildPersonalizedSystemPrompt(GENERAL_SYSTEM_PROMPT, profile),
    messages: [{ role: 'user', content: text }],
  });

  return firstText(response);
}

module.exports = { respond, CODE_BLOCKED_MESSAGE, IMAGE_BLOCKED_MESSAGE };
