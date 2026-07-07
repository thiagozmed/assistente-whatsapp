// Checa o status de aprovação do template dos lembretes.
//
//   node scripts/checkReminderTemplate.js
require('dotenv').config();
const axios = require('axios');

const GRAPH_API_VERSION = 'v21.0';
const TEMPLATE_NAME = 'lembrete_agendado';

async function main() {
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!wabaId || !token) {
    throw new Error('WHATSAPP_BUSINESS_ACCOUNT_ID ou WHATSAPP_ACCESS_TOKEN não configurados no .env');
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${wabaId}/message_templates`;
  const { data } = await axios.get(url, {
    params: { name: TEMPLATE_NAME },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!data.data.length) {
    console.log(`Nenhum template chamado "${TEMPLATE_NAME}" encontrado.`);
    return;
  }
  data.data.forEach((t) => console.log(`status: ${t.status} | categoria: ${t.category} | id: ${t.id}`));
}

main().catch((err) => {
  console.error('Erro consultando template:', err.response?.data ?? err.message);
  process.exit(1);
});
