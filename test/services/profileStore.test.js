const { test } = require('node:test');
const assert = require('node:assert/strict');
const { supabase } = require('../../src/services/supabaseClient');
const { fakeQuery } = require('../helpers/fakeSupabase');
const profileStore = require('../../src/services/profileStore');

test('getProfile: perfil encontrado retorna os dados', async (t) => {
  t.mock.method(supabase, 'from', () => fakeQuery({ data: { phone_number: '123', onboarding_state: 'completo' }, error: null }));

  const profile = await profileStore.getProfile('123');
  assert.equal(profile.phone_number, '123');
});

test('getProfile: perfil inexistente retorna null', async (t) => {
  t.mock.method(supabase, 'from', () => fakeQuery({ data: null, error: null }));

  const profile = await profileStore.getProfile('123');
  assert.equal(profile, null);
});

test('getProfile: erro do Supabase propaga como exceção', async (t) => {
  t.mock.method(supabase, 'from', () => fakeQuery({ data: null, error: { message: 'conexão recusada' } }));

  await assert.rejects(() => profileStore.getProfile('123'), /conexão recusada/);
});

test('createProfile: sucesso retorna a linha criada', async (t) => {
  t.mock.method(supabase, 'from', () =>
    fakeQuery({ data: { phone_number: '123', onboarding_state: 'aguardando_nome' }, error: null }),
  );

  const profile = await profileStore.createProfile('123');
  assert.equal(profile.onboarding_state, 'aguardando_nome');
});

test('createProfile: colisão de PK (webhook duplicado) cai de volta pra getProfile', async (t) => {
  let call = 0;
  t.mock.method(supabase, 'from', () => {
    call += 1;
    if (call === 1) return fakeQuery({ data: null, error: { code: '23505', message: 'duplicate key' } });
    return fakeQuery({ data: { phone_number: '123', onboarding_state: 'aguardando_nome' }, error: null });
  });

  const profile = await profileStore.createProfile('123');
  assert.equal(profile.phone_number, '123');
  assert.equal(call, 2);
});

test('updateName: atualiza nome e avança onboarding_state', async (t) => {
  t.mock.method(supabase, 'from', () =>
    fakeQuery({ data: { phone_number: '123', assistant_name: 'Zeca', onboarding_state: 'aguardando_tom' }, error: null }),
  );

  const profile = await profileStore.updateName('123', 'Zeca');
  assert.equal(profile.assistant_name, 'Zeca');
  assert.equal(profile.onboarding_state, 'aguardando_tom');
});

test('updateTone: atualiza tom e conclui onboarding', async (t) => {
  t.mock.method(supabase, 'from', () =>
    fakeQuery({ data: { phone_number: '123', tone: 'afetuoso', onboarding_state: 'completo' }, error: null }),
  );

  const profile = await profileStore.updateTone('123', 'afetuoso');
  assert.equal(profile.tone, 'afetuoso');
  assert.equal(profile.onboarding_state, 'completo');
});

test('updatePreference: atualização parcial (só tom)', async (t) => {
  t.mock.method(supabase, 'from', () => fakeQuery({ data: { phone_number: '123', tone: 'formal' }, error: null }));

  const profile = await profileStore.updatePreference('123', { name: null, tone: 'formal' });
  assert.equal(profile.tone, 'formal');
});

test('recordInteraction: grava tipo e resumo da última interação', async (t) => {
  t.mock.method(supabase, 'from', () =>
    fakeQuery({
      data: { phone_number: '123', last_interaction_type: 'golpe', last_interaction_summary: 'golpe_conhecido — link falso' },
      error: null,
    }),
  );

  const profile = await profileStore.recordInteraction('123', { type: 'golpe', summary: 'golpe_conhecido — link falso' });
  assert.equal(profile.last_interaction_type, 'golpe');
});
