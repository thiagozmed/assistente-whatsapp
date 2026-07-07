// Cria (ou reenvia pra revisão) o message template usado pelos lembretes
// agendados (src/services/reminderDispatcher.js). Roda uma vez só, manual:
//
//   node scripts/createReminderTemplate.js
//
// Precisa de WHATSAPP_BUSINESS_ACCOUNT_ID e WHATSAPP_ACCESS_TOKEN no .env.
// A aprovação é feita pela Meta (geralmente minutos, às vezes mais) — confira
// o status em Meta Business Suite -> WhatsApp Manager -> Message Templates,
// ou rodando este script de novo (a API devolve o status atual).
require('dotenv').config();
const axios = require('axios');

const GRAPH_API_VERSION = 'v21.0';
const TEMPLATE_NAME = 'lembrete_agendado';
const TEMPLATE_LANGUAGE = 'pt_BR';

async function main() {
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!wabaId || !token) {
    throw new Error('WHATSAPP_BUSINESS_ACCOUNT_ID ou WHATSAPP_ACCESS_TOKEN não configurados no .env');
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/message_templates`;

  const { data } = await axios.post(
    url,
    {
      name: TEMPLATE_NAME,
      language: TEMPLATE_LANGUAGE,
      category: 'UTILITY',
      components: [
        {
          type: 'BODY',
          text: 'Olá! Passando pra lembrar: {{1}}. Este lembrete foi agendado a seu pedido.',
          example: { body_text: [['tomar o remédio de pressão']] },
        },
      ],
    },
    { headers: { Authorization: `Bearer ${token}` } },
  );

  console.log('Template criado, aguardando revisão da Meta:');
  console.log(JSON.stringify(data, null, 2));
}

main().catch((err) => {
  console.error('Erro criando template:', err.response?.data ?? err.message);
  process.exit(1);
});
