const { test } = require('node:test');
const assert = require('node:assert/strict');
const { supabase } = require('../../src/services/supabaseClient');
const { fakeQuery } = require('../helpers/fakeSupabase');
const dedupe = require('../../src/services/dedupe');

test('claimMessage: primeira vez que vê o wamid, reivindica com sucesso', async (t) => {
  t.mock.method(supabase, 'from', () => fakeQuery({ error: null }));

  const claimed = await dedupe.claimMessage('wamid.123');
  assert.equal(claimed, true);
});

test('claimMessage: wamid repetido (reentrega da Meta) não reivindica de novo', async (t) => {
  t.mock.method(supabase, 'from', () => fakeQuery({ error: { code: '23505', message: 'duplicate key' } }));

  const claimed = await dedupe.claimMessage('wamid.123');
  assert.equal(claimed, false);
});

test('claimMessage: erro do Supabase não relacionado a duplicidade propaga como exceção', async (t) => {
  t.mock.method(supabase, 'from', () => fakeQuery({ error: { message: 'conexão recusada' } }));

  await assert.rejects(() => dedupe.claimMessage('wamid.123'), /conexão recusada/);
});
