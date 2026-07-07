const crypto = require('crypto');

// A Meta assina o corpo cru da requisição com o App Secret (HMAC SHA256) e
// manda o resultado no header X-Hub-Signature-256, formato "sha256=<hex>".
// Comparação em tempo constante (timingSafeEqual) evita vazar o hash certo
// por diferença de tempo de resposta.
function isValidSignature(rawBody, signatureHeader, appSecret) {
  if (!rawBody || !signatureHeader || !appSecret) return false;

  const [scheme, receivedHex] = signatureHeader.split('=');
  if (scheme !== 'sha256' || !receivedHex) return false;

  const expectedHex = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  const received = Buffer.from(receivedHex, 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  if (received.length !== expected.length) return false;

  return crypto.timingSafeEqual(received, expected);
}

module.exports = { isValidSignature };
