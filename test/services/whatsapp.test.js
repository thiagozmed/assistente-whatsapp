const { test } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const { sendTextMessage } = require('../../src/services/whatsapp');

test('sendTextMessage: sucesso chama a Graph API com o número normalizado', async (t) => {
  let capturedUrl;
  let capturedBody;
  t.mock.method(axios, 'post', async (url, body) => {
    capturedUrl = url;
    capturedBody = body;
    return { data: { messages: [{ id: 'wamid.123' }] } };
  });

  // Número BR sem o 9º dígito, como a Meta entrega no webhook.
  await sendTextMessage('554891466284', 'Oi!');

  assert.match(capturedUrl, /\/test-phone-id\/messages$/);
  assert.equal(capturedBody.to, '5548991466284');
  assert.equal(capturedBody.text.body, 'Oi!');
});

test('sendTextMessage: falha de envio propaga o erro sem travar o processo', async (t) => {
  t.mock.method(axios, 'post', async () => {
    throw new Error('simulated WhatsApp outage');
  });

  await assert.rejects(() => sendTextMessage('554891466284', 'Oi!'), /simulated WhatsApp outage/);
});

test('sendTextMessage: config ausente lança erro claro', async () => {
  const original = process.env.WHATSAPP_ACCESS_TOKEN;
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  try {
    await assert.rejects(
      () => sendTextMessage('554891466284', 'Oi!'),
      /WHATSAPP_ACCESS_TOKEN ou WHATSAPP_PHONE_NUMBER_ID/,
    );
  } finally {
    process.env.WHATSAPP_ACCESS_TOKEN = original;
  }
});
