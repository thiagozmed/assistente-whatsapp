const express = require('express');
const { handleIncomingText, handleIncomingImage, handleIncomingAudio } = require('../services/messageHandler');
const { sendTextMessage, downloadMedia } = require('../services/whatsapp');
const { isValidSignature } = require('../services/webhookSignature');

const router = express.Router();

// Rejeita qualquer POST sem assinatura válida da Meta, antes de processar
// a mensagem. Fail-closed: sem secret configurado, sem header, ou header
// que não bate com o corpo cru => 401.
function verifySignature(req, res, next) {
  const signature = req.headers['x-hub-signature-256'];
  if (!isValidSignature(req.rawBody, signature, process.env.WHATSAPP_APP_SECRET)) {
    return res.sendStatus(401);
  }
  next();
}

// Verificação do webhook — a Meta faz esse GET na hora de configurar a URL.
router.get('/', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// Recebimento de mensagens.
router.post('/', verifySignature, (req, res) => {
  // Responde 200 imediatamente — a Meta reenvia o evento se não receber ack rápido.
  res.sendStatus(200);

  const entry = req.body.entry?.[0];
  const change = entry?.changes?.[0];
  const message = change?.value?.messages?.[0];

  if (!message) return;

  const from = message.from;
  // Timestamp da própria Meta (unix seconds) como referência de "agora" pra
  // extração de lembretes — reflete melhor o instante em que o idoso falou
  // do que o relógio do servidor, caso o processamento atrase.
  const referenceTimestamp = message.timestamp ? new Date(Number(message.timestamp) * 1000) : new Date();

  const onError = (err) => {
    // Nunca logar o erro do axios inteiro — ele carrega os headers da
    // requisição, incluindo o Authorization Bearer com o token de acesso.
    console.error('Erro processando mensagem do webhook:', err.response?.data ?? err.message);
  };

  if (message.type === 'text') {
    handleIncomingText(from, message.text.body, referenceTimestamp)
      .then((reply) => sendTextMessage(from, reply))
      .catch(onError);
    return;
  }

  if (message.type === 'image') {
    downloadMedia(message.image.id)
      .then((media) => handleIncomingImage(from, media, message.image.caption))
      .then((reply) => sendTextMessage(from, reply))
      .catch(onError);
    return;
  }

  if (message.type === 'audio') {
    downloadMedia(message.audio.id)
      .then((media) => handleIncomingAudio(from, media, referenceTimestamp))
      .then((reply) => sendTextMessage(from, reply))
      .catch(onError);
    return;
  }
});

module.exports = router;
