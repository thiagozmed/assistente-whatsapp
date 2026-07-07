// Monta o content block da Anthropic API pra mensagens com imagem — mesmo
// content compartilhado por bureaucracy.js e scamShield.js.
function buildVisionContent(text, image) {
  if (!image) return text;

  const blocks = [];
  if (text) blocks.push({ type: 'text', text });
  blocks.push({
    type: 'image',
    source: { type: 'base64', media_type: image.mimeType, data: image.buffer.toString('base64') },
  });
  return blocks;
}

module.exports = { buildVisionContent };
