const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { isValidSignature } = require('../../src/services/webhookSignature');

const SECRET = 'app-secret-de-teste';

function sign(rawBody, secret) {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
}

test('isValidSignature: assinatura correta é aceita', () => {
  const rawBody = Buffer.from(JSON.stringify({ hello: 'world' }));
  const signature = sign(rawBody, SECRET);
  assert.equal(isValidSignature(rawBody, signature, SECRET), true);
});

test('isValidSignature: corpo alterado depois de assinado é rejeitado', () => {
  const original = Buffer.from(JSON.stringify({ hello: 'world' }));
  const signature = sign(original, SECRET);
  const tampered = Buffer.from(JSON.stringify({ hello: 'mundo' }));
  assert.equal(isValidSignature(tampered, signature, SECRET), false);
});

test('isValidSignature: assinado com secret errado é rejeitado', () => {
  const rawBody = Buffer.from(JSON.stringify({ hello: 'world' }));
  const signature = sign(rawBody, 'outro-secret');
  assert.equal(isValidSignature(rawBody, signature, SECRET), false);
});

test('isValidSignature: header ausente é rejeitado', () => {
  const rawBody = Buffer.from(JSON.stringify({ hello: 'world' }));
  assert.equal(isValidSignature(rawBody, undefined, SECRET), false);
});

test('isValidSignature: secret não configurado é rejeitado (fail-closed)', () => {
  const rawBody = Buffer.from(JSON.stringify({ hello: 'world' }));
  const signature = sign(rawBody, SECRET);
  assert.equal(isValidSignature(rawBody, signature, undefined), false);
});

test('isValidSignature: header com esquema diferente de sha256 é rejeitado', () => {
  const rawBody = Buffer.from(JSON.stringify({ hello: 'world' }));
  assert.equal(isValidSignature(rawBody, 'sha1=deadbeef', SECRET), false);
});
