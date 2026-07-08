const { test } = require('node:test');
const assert = require('node:assert/strict');
const { encrypt, decrypt } = require('../../src/services/encryption');

test('encrypt/decrypt: ida e volta preserva o texto original', () => {
  const original = 'golpe_conhecido — link falso de prêmio, pediu PIX urgente';
  const ciphertext = encrypt(original);
  assert.notEqual(ciphertext, original);
  assert.equal(decrypt(ciphertext), original);
});

test('encrypt: mesmo texto gera ciphertexts diferentes a cada chamada (IV aleatório)', () => {
  const a = encrypt('tomar remédio às 10h');
  const b = encrypt('tomar remédio às 10h');
  assert.notEqual(a, b);
  assert.equal(decrypt(a), 'tomar remédio às 10h');
  assert.equal(decrypt(b), 'tomar remédio às 10h');
});

test('encrypt/decrypt: null e undefined passam direto, sem cifrar', () => {
  assert.equal(encrypt(null), null);
  assert.equal(encrypt(undefined), undefined);
  assert.equal(decrypt(null), null);
  assert.equal(decrypt(undefined), undefined);
});

test('decrypt: texto puro legado (sem o prefixo enc:v1:) é devolvido sem alteração', () => {
  assert.equal(decrypt('afetuoso'), 'afetuoso');
  assert.equal(decrypt('golpe_conhecido — link falso'), 'golpe_conhecido — link falso');
});

test('decrypt: ciphertext adulterado falha (autenticação do GCM detecta violação)', () => {
  const ciphertext = encrypt('dado sensível');
  const adulterado = ciphertext.slice(0, -4) + 'AAAA';
  assert.throws(() => decrypt(adulterado));
});

test('encrypt: sem DATA_ENCRYPTION_KEY configurada, lança erro claro', () => {
  const original = process.env.DATA_ENCRYPTION_KEY;
  delete process.env.DATA_ENCRYPTION_KEY;
  try {
    assert.throws(() => encrypt('qualquer coisa'), /DATA_ENCRYPTION_KEY/);
  } finally {
    process.env.DATA_ENCRYPTION_KEY = original;
  }
});
