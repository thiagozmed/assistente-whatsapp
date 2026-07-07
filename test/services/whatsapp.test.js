const { test } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const { sendTextMessage, downloadMedia } = require('../../src/services/whatsapp');

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

test('downloadMedia: baixa o binário em dois GETs (metadata -> arquivo)', async (t) => {
  const calls = [];
  t.mock.method(axios, 'get', async (url) => {
    calls.push(url);
    if (calls.length === 1) {
      return { data: { url: 'https://lookaside.fbsbx.com/media/fake-signed-url', mime_type: 'image/jpeg' } };
    }
    return { data: Buffer.from('fake-image-bytes') };
  });

  const media = await downloadMedia('media-id-123');
  assert.match(calls[0], /\/media-id-123$/);
  assert.equal(calls[1], 'https://lookaside.fbsbx.com/media/fake-signed-url');
  assert.equal(media.mimeType, 'image/jpeg');
  assert.equal(media.buffer.toString(), 'fake-image-bytes');
});

test('downloadMedia: falha no GET de metadata propaga erro', async (t) => {
  t.mock.method(axios, 'get', async () => {
    throw new Error('simulated metadata fetch failure');
  });

  await assert.rejects(() => downloadMedia('media-id-123'), /simulated metadata fetch failure/);
});

test('downloadMedia: falha no GET do binário (ex: URL assinada expirada) propaga erro', async (t) => {
  let call = 0;
  t.mock.method(axios, 'get', async () => {
    call += 1;
    if (call === 1) return { data: { url: 'https://lookaside.fbsbx.com/media/fake-signed-url', mime_type: 'image/jpeg' } };
    throw new Error('simulated expired signed url');
  });

  await assert.rejects(() => downloadMedia('media-id-123'), /simulated expired signed url/);
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
