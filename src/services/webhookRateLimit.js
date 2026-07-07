const rateLimit = require('express-rate-limit');

// Protege o endpoint público antes mesmo de validar a assinatura HMAC — evita
// gastar CPU calculando HMAC de um dilúvio de requisições forjadas. Fábrica
// (em vez de uma instância singleton) pra permitir configurar um limite
// isolado nos testes sem compartilhar estado com o middleware de produção.
function createWebhookRateLimit({ windowMs = 60 * 1000, limit = 120 } = {}) {
  return rateLimit({ windowMs, limit, standardHeaders: true, legacyHeaders: false });
}

const webhookRateLimit = createWebhookRateLimit();

module.exports = { webhookRateLimit, createWebhookRateLimit };
