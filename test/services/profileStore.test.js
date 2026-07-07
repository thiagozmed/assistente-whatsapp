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

test('recordConsent: registra consentimento e avança pro passo de nome', async (t) => {
  t.mock.method(supabase, 'from', () =>
    fakeQuery({ data: { phone_number: '123', onboarding_state: 'aguardando_nome' }, error: null }),
  );

  const profile = await profileStore.recordConsent('123');
  assert.equal(profile.onboarding_state, 'aguardando_nome');
});

test('deleteProfile: apaga sem erro', async (t) => {
  t.mock.method(supabase, 'from', () => fakeQuery({ error: null }));

  await assert.doesNotReject(() => profileStore.deleteProfile('123'));
});

test('deleteProfile: erro do Supabase propaga como exceção', async (t) => {
  t.mock.method(supabase, 'from', () => fakeQuery({ error: { message: 'conexão recusada' } }));

  await assert.rejects(() => profileStore.deleteProfile('123'), /conexão recusada/);
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

test('incrementDailyMessageCount: chama a função atômica do Postgres e devolve a nova contagem', async (t) => {
  const rpcMock = t.mock.method(supabase, 'rpc', () =>
    fakeQuery({ data: { daily_message_count: 3, daily_message_count_date: '2026-07-07' }, error: null }),
  );

  const result = await profileStore.incrementDailyMessageCount('123', '2026-07-07');
  assert.equal(result.daily_message_count, 3);
  assert.deepEqual(rpcMock.mock.calls[0].arguments, [
    'increment_daily_message_count',
    { p_phone_number: '123', p_today: '2026-07-07' },
  ]);
});

test('incrementDailyMessageCount: erro do Supabase propaga como exceção', async (t) => {
  t.mock.method(supabase, 'rpc', () => fakeQuery({ data: null, error: { message: 'conexão recusada' } }));

  await assert.rejects(() => profileStore.incrementDailyMessageCount('123', '2026-07-07'), /conexão recusada/);
});

test('updatePendingAction: grava a ação pendente de confirmação', async (t) => {
  t.mock.method(supabase, 'from', () =>
    fakeQuery({ data: { phone_number: '123', pending_action: 'confirmar_esquecer' }, error: null }),
  );

  const profile = await profileStore.updatePendingAction('123', 'confirmar_esquecer');
  assert.equal(profile.pending_action, 'confirmar_esquecer');
});

test('updatePendingAction: limpa a ação pendente passando null', async (t) => {
  t.mock.method(supabase, 'from', () => fakeQuery({ data: { phone_number: '123', pending_action: null }, error: null }));

  const profile = await profileStore.updatePendingAction('123', null);
  assert.equal(profile.pending_action, null);
});

test('updatePendingAction: erro do Supabase propaga como exceção', async (t) => {
  t.mock.method(supabase, 'from', () => fakeQuery({ data: null, error: { message: 'conexão recusada' } }));

  await assert.rejects(() => profileStore.updatePendingAction('123', 'confirmar_esquecer'), /conexão recusada/);
});
