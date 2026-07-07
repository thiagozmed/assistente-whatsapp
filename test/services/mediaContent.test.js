const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildVisionContent } = require('../../src/services/mediaContent');

test('sem imagem, devolve o texto puro', () => {
  assert.equal(buildVisionContent('oi', null), 'oi');
});

test('com imagem e texto, monta os dois blocks', () => {
  const image = { mimeType: 'image/jpeg', buffer: Buffer.from('fake-image-bytes') };
  const content = buildVisionContent('o que é isso?', image);

  assert.equal(content.length, 2);
  assert.deepEqual(content[0], { type: 'text', text: 'o que é isso?' });
  assert.equal(content[1].type, 'image');
  assert.equal(content[1].source.media_type, 'image/jpeg');
  assert.equal(content[1].source.data, Buffer.from('fake-image-bytes').toString('base64'));
});

test('com imagem e sem texto (legenda vazia), só monta o block de imagem', () => {
  const image = { mimeType: 'image/png', buffer: Buffer.from('bytes') };
  const content = buildVisionContent('', image);

  assert.equal(content.length, 1);
  assert.equal(content[0].type, 'image');
});
