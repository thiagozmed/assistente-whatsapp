const axios = require('axios');

const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';

// Separada da MOCK_CLAUDE de propósito: são dois provedores independentes
// (Anthropic e OpenAI), cada um pode estar configurado ou não em momentos
// diferentes do desenvolvimento.
const MOCK = process.env.MOCK_TRANSCRIPTION === 'true';

function extensionFor(mimeType = '') {
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('wav')) return 'wav';
  return 'ogg';
}

async function transcribeAudio(buffer, mimeType) {
  if (MOCK) {
    return '[MOCK] transcrição simulada — configure OPENAI_API_KEY e MOCK_TRANSCRIPTION=false para transcrever de verdade.';
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY não configurada no .env');
  }

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mimeType || 'audio/ogg' }), `audio.${extensionFor(mimeType)}`);
  form.append('model', 'whisper-1');
  form.append('language', 'pt');

  const { data } = await axios.post(WHISPER_URL, form, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  return data.text;
}

module.exports = { transcribeAudio };
