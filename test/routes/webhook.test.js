const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const axios = require('axios');
const { app } = require('../../src/server');
const { client } = require('../../src/services/claudeClient');
const profileStore = require('../../src/services/profileStore');
const { waitFor } = require('../helpers/waitFor');

const COMPLETED_PROFILE = {
  phone_number: '554891466284',
  assistant_name: 'Zeca',
  tone: 'afetuoso',
  onboarding_state: 'completo',
  last_interaction_summary: null,
};

const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

function sign(rawBody, secret) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

function samplePayload(text) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                { from: '554891466284', type: 'text', text: { body: text } },
              ],
            },
          },
        ],
      },
    ],
  };
}

function imagePayload(caption) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                { from: '554891466284', type: 'image', image: { id: 'media-id-123', caption } },
              ],
            },
          },
        ],
      },
    ],
  };
}

function audioPayload() {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                { from: '554891466284', type: 'audio', audio: { id: 'media-id-456' }, timestamp: '1783593600' },
              ],
            },
          },
        ],
      },
    ],
  };
}

async function withServer(fn) {
  const server = app.listen(0);
  try {
    const { port } = server.address();
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

test('GET /webhook: verify token correto retorna o challenge com 200', async () => {
  await withServer(async (base) => {
    const res = await fetch(
      `${base}/webhook?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=abc123`,
    );
    assert.equal(res.status, 200);
    assert.equal(await res.text(), 'abc123');
  });
});

test('GET /webhook: verify token errado retorna 403', async () => {
  await withServer(async (base) => {
    const res = await fetch(
      `${base}/webhook?hub.mode=subscribe&hub.verify_token=errado&hub.challenge=abc123`,
    );
    assert.equal(res.status, 403);
  });
});

test('POST /webhook: sem header de assinatura retorna 401 e não chama a IA', async (t) => {
  const createMock = t.mock.method(client.messages, 'create', async () => {
    throw new Error('não deveria ser chamado');
  });

  await withServer(async (base) => {
    const res = await fetch(`${base}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(samplePayload('oi')),
    });
    assert.equal(res.status, 401);
  });

  assert.equal(createMock.mock.callCount(), 0);
});

test('POST /webhook: assinatura inválida retorna 401 e não chama a IA', async (t) => {
  const createMock = t.mock.method(client.messages, 'create', async () => {
    throw new Error('não deveria ser chamado');
  });

  await withServer(async (base) => {
    const res = await fetch(`${base}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': 'sha256=' + '0'.repeat(64),
      },
      body: JSON.stringify(samplePayload('oi')),
    });
    assert.equal(res.status, 401);
  });

  assert.equal(createMock.mock.callCount(), 0);
});

test('POST /webhook: assinatura válida processa a mensagem e responde no WhatsApp', async (t) => {
  t.mock.method(profileStore, 'getProfile', async () => COMPLETED_PROFILE);
  t.mock.method(profileStore, 'updateDailyMessageCount', async () => COMPLETED_PROFILE);
  t.mock.method(profileStore, 'recordInteraction', async () => COMPLETED_PROFILE);
  t.mock.method(client.messages, 'create', async () => ({
    content: [{ type: 'text', text: JSON.stringify({ intent: 'outro' }) }],
  }));
  let whatsappCalled = false;
  t.mock.method(axios, 'post', async () => {
    whatsappCalled = true;
    return { data: { messages: [{ id: 'wamid.teste' }] } };
  });

  await withServer(async (base) => {
    const body = Buffer.from(JSON.stringify(samplePayload('oi')));
    const res = await fetch(`${base}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': sign(body, APP_SECRET),
      },
      body,
    });
    // Ack imediato, antes de terminar de processar (fire-and-forget).
    assert.equal(res.status, 200);
  });

  await waitFor(() => whatsappCalled);
});

test('POST /webhook: falha da API Claude não derruba o servidor', async (t) => {
  t.mock.method(profileStore, 'getProfile', async () => COMPLETED_PROFILE);
  t.mock.method(client.messages, 'create', async () => {
    throw new Error('simulated Anthropic outage');
  });

  await withServer(async (base) => {
    const body = Buffer.from(JSON.stringify(samplePayload('oi')));
    const res = await fetch(`${base}/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hub-signature-256': sign(body, APP_SECRET),
      },
      body,
    });
    assert.equal(res.status, 200);
  });
  // Se chegou até aqui sem o processo derrubar, o servidor sobreviveu à falha.
});

test('POST /webhook: mensagem de imagem baixa a mídia e responde explicando a tela', async (t) => {
  t.mock.method(profileStore, 'getProfile', async () => COMPLETED_PROFILE);
  t.mock.method(profileStore, 'updateDailyMessageCount', async () => COMPLETED_PROFILE);
  t.mock.method(profileStore, 'recordInteraction', async () => COMPLETED_PROFILE);
  t.mock.method(axios, 'get', async (url) => {
    if (url.includes('media-id-123')) {
      return { data: { url: 'https://lookaside.fbsbx.com/media/fake-signed-url', mime_type: 'image/jpeg' } };
    }
    return { data: Buffer.from('fake-image-bytes') };
  });
  t.mock.method(client.messages, 'create', async () => ({
    content: [{ type: 'text', text: '1. Toque em ATUALIZAR CADASTRO.' }],
  }));
  let whatsappCalled = false;
  t.mock.method(axios, 'post', async () => {
    whatsappCalled = true;
    return { data: { messages: [{ id: 'wamid.teste' }] } };
  });

  await withServer(async (base) => {
    const body = Buffer.from(JSON.stringify(imagePayload(undefined)));
    const res = await fetch(`${base}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': sign(body, APP_SECRET) },
      body,
    });
    assert.equal(res.status, 200);
  });

  await waitFor(() => whatsappCalled);
});

test('POST /webhook: mensagem de áudio transcreve, extrai lembrete e confirma', async (t) => {
  t.mock.method(profileStore, 'getProfile', async () => COMPLETED_PROFILE);
  t.mock.method(profileStore, 'updateDailyMessageCount', async () => COMPLETED_PROFILE);
  t.mock.method(profileStore, 'recordInteraction', async () => COMPLETED_PROFILE);
  t.mock.method(axios, 'get', async (url) => {
    if (url.includes('media-id-456')) {
      return { data: { url: 'https://lookaside.fbsbx.com/media/fake-audio-url', mime_type: 'audio/ogg' } };
    }
    return { data: Buffer.from('fake-audio-bytes') };
  });

  let modelCall = 0;
  t.mock.method(client.messages, 'create', async () => {
    modelCall += 1;
    if (modelCall === 1) return { content: [{ type: 'text', text: JSON.stringify({ intent: 'agenda' }) }] };
    return {
      content: [
        { type: 'text', text: JSON.stringify({ descricao: 'tomar remédio', quando_iso: '2026-07-08T08:00:00-03:00', recorrente: false }) },
      ],
    };
  });

  let capturedWhatsappBody;
  t.mock.method(axios, 'post', async (url, body) => {
    if (url.includes('api.openai.com')) {
      return { data: { text: 'me lembra de tomar remédio amanhã às 8' } };
    }
    capturedWhatsappBody = body;
    return { data: { messages: [{ id: 'wamid.teste' }] } };
  });

  await withServer(async (base) => {
    const body = Buffer.from(JSON.stringify(audioPayload()));
    const res = await fetch(`${base}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': sign(body, APP_SECRET) },
      body,
    });
    assert.equal(res.status, 200);
  });

  await waitFor(() => Boolean(capturedWhatsappBody));
  assert.match(capturedWhatsappBody.text.body, /tomar remédio/);
});

test('POST /webhook: falha de transcrição de áudio responde amigável sem derrubar o servidor', async (t) => {
  t.mock.method(profileStore, 'getProfile', async () => COMPLETED_PROFILE);
  t.mock.method(axios, 'get', async (url) => {
    if (url.includes('media-id-456')) {
      return { data: { url: 'https://lookaside.fbsbx.com/media/fake-audio-url', mime_type: 'audio/ogg' } };
    }
    return { data: Buffer.from('fake-audio-bytes') };
  });

  let capturedWhatsappBody;
  t.mock.method(axios, 'post', async (url, body) => {
    if (url.includes('api.openai.com')) {
      throw new Error('simulated Whisper outage');
    }
    capturedWhatsappBody = body;
    return { data: { messages: [{ id: 'wamid.teste' }] } };
  });

  await withServer(async (base) => {
    const body = Buffer.from(JSON.stringify(audioPayload()));
    const res = await fetch(`${base}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': sign(body, APP_SECRET) },
      body,
    });
    assert.equal(res.status, 200);
  });

  await waitFor(() => Boolean(capturedWhatsappBody));
  assert.match(capturedWhatsappBody.text.body, /não consegui entender esse áudio/i);
});
