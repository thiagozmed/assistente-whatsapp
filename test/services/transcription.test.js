const { test } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const { transcribeAudio } = require('../../src/services/transcription');

test('transcribeAudio: sucesso devolve o texto transcrito', async (t) => {
  let capturedUrl;
  let capturedHeaders;
  t.mock.method(axios, 'post', async (url, form, config) => {
    capturedUrl = url;
    capturedHeaders = config.headers;
    return { data: { text: 'me lembra de tomar remédio amanhã de manhã' } };
  });

  const text = await transcribeAudio(Buffer.from('fake-audio-bytes'), 'audio/ogg; codecs=opus');
  assert.equal(text, 'me lembra de tomar remédio amanhã de manhã');
  assert.match(capturedUrl, /api\.openai\.com\/v1\/audio\/transcriptions/);
  assert.match(capturedHeaders.Authorization, /^Bearer /);
});

test('transcribeAudio: falha da API propaga erro sem travar o processo', async (t) => {
  t.mock.method(axios, 'post', async () => {
    throw new Error('simulated Whisper outage');
  });

  await assert.rejects(() => transcribeAudio(Buffer.from('audio'), 'audio/ogg'), /simulated Whisper outage/);
});

test('transcribeAudio: sem OPENAI_API_KEY lança erro claro', async () => {
  const original = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    await assert.rejects(() => transcribeAudio(Buffer.from('audio'), 'audio/ogg'), /OPENAI_API_KEY não configurada/);
  } finally {
    process.env.OPENAI_API_KEY = original;
  }
});
