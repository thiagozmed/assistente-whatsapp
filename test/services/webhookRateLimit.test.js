const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createWebhookRateLimit } = require('../../src/services/webhookRateLimit');

// Instância isolada com limite baixo, criada só pra esse teste — não
// compartilha estado com o middleware usado de verdade em webhook.js.
test('webhookRateLimit: bloqueia com 429 depois do limite de requisições por IP', async (t) => {
  const app = express();
  app.use(createWebhookRateLimit({ windowMs: 60000, limit: 3 }));
  app.get('/', (req, res) => res.sendStatus(200));

  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const statuses = [];
  for (let i = 0; i < 5; i += 1) {
    const res = await fetch(`http://127.0.0.1:${port}/`);
    statuses.push(res.status);
  }

  assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
});
