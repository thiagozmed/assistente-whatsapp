const axios = require('axios');

const GRAPH_API_VERSION = 'v21.0';

function getConfig() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    throw new Error('WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID não configurados no .env');
  }
  return { token, phoneNumberId };
}

// A Meta entrega o "from" de números brasileiros no webhook SEM o 9º dígito
// do celular (ex: 5548 91466284, 12 dígitos), mas exige esse dígito de volta
// pra ENVIAR mensagem pro número (ex: 5548 991466284, 13 dígitos). Sem isso,
// o envio falha com "Recipient phone number not in allowed list" mesmo com
// o número corretamente cadastrado.
function normalizeBrazilianNumber(number) {
  if (/^55\d{2}[6-9]\d{7}$/.test(number)) {
    return `${number.slice(0, 4)}9${number.slice(4)}`;
  }
  return number;
}

async function sendTextMessage(to, body) {
  const { token, phoneNumberId } = getConfig();
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
  const normalizedTo = normalizeBrazilianNumber(to);

  const response = await axios.post(
    url,
    {
      messaging_product: 'whatsapp',
      to: normalizedTo,
      type: 'text',
      text: { body },
    },
    { headers: { Authorization: `Bearer ${token}` } },
  );

  console.log('Mensagem enviada:', JSON.stringify(response.data));
}

// A Meta só entrega um media ID no webhook, não o binário. É preciso um
// primeiro GET pra pegar a URL assinada temporária do arquivo, e um segundo
// GET nessa URL (com o mesmo Bearer token) pra baixar o conteúdo de verdade.
async function downloadMedia(mediaId) {
  const { token } = getConfig();
  const metaUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`;

  const { data: meta } = await axios.get(metaUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const { data } = await axios.get(meta.url, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'arraybuffer',
  });

  return { buffer: Buffer.from(data), mimeType: meta.mime_type };
}

module.exports = { sendTextMessage, downloadMedia };
