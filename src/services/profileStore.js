const { supabase } = require('./supabaseClient');

function assertNoError(error, action) {
  if (error) {
    throw new Error(`Supabase ${action} falhou: ${error.message}`);
  }
}

async function getProfile(phoneNumber) {
  const { data, error } = await supabase.from('profiles').select('*').eq('phone_number', phoneNumber).maybeSingle();
  assertNoError(error, 'getProfile');
  return data;
}

async function createProfile(phoneNumber) {
  const { data, error } = await supabase.from('profiles').insert({ phone_number: phoneNumber }).select().single();

  if (error) {
    // Webhook da Meta pode reentregar o mesmo evento quase simultâneo; se outra
    // requisição já criou o perfil primeiro, só busca o que já existe.
    if (error.code === '23505') return getProfile(phoneNumber);
    assertNoError(error, 'createProfile');
  }
  return data;
}

async function recordConsent(phoneNumber) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ consented_at: new Date().toISOString(), onboarding_state: 'aguardando_nome', updated_at: new Date().toISOString() })
    .eq('phone_number', phoneNumber)
    .select()
    .single();
  assertNoError(error, 'recordConsent');
  return data;
}

async function deleteProfile(phoneNumber) {
  // O cascade da FK em reminders (sql/002_add_consent.sql) apaga os
  // lembretes associados junto, sem precisar orquestrar duas tabelas aqui.
  const { error } = await supabase.from('profiles').delete().eq('phone_number', phoneNumber);
  assertNoError(error, 'deleteProfile');
}

async function updateName(phoneNumber, assistantName) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ assistant_name: assistantName, onboarding_state: 'aguardando_tom', updated_at: new Date().toISOString() })
    .eq('phone_number', phoneNumber)
    .select()
    .single();
  assertNoError(error, 'updateName');
  return data;
}

async function updateTone(phoneNumber, tone) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ tone, onboarding_state: 'completo', updated_at: new Date().toISOString() })
    .eq('phone_number', phoneNumber)
    .select()
    .single();
  assertNoError(error, 'updateTone');
  return data;
}

async function updatePreference(phoneNumber, { name, tone }) {
  const changes = { updated_at: new Date().toISOString() };
  if (name) changes.assistant_name = name;
  if (tone) changes.tone = tone;

  const { data, error } = await supabase.from('profiles').update(changes).eq('phone_number', phoneNumber).select().single();
  assertNoError(error, 'updatePreference');
  return data;
}

async function recordInteraction(phoneNumber, { type, summary }) {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      last_interaction_type: type,
      last_interaction_summary: summary,
      last_interaction_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('phone_number', phoneNumber)
    .select()
    .single();
  assertNoError(error, 'recordInteraction');
  return data;
}

// RPC (sql/004_atomic_rate_limit.sql) em vez de ler-e-escrever daqui: o UPDATE
// roda inteiro numa única instrução no Postgres, então o lock de linha
// serializa chamadas concorrentes pro mesmo número (evita passar do limite
// diário quando duas mensagens chegam quase juntas).
async function incrementDailyMessageCount(phoneNumber, date) {
  const { data, error } = await supabase
    .rpc('increment_daily_message_count', { p_phone_number: phoneNumber, p_today: date })
    .single();
  assertNoError(error, 'incrementDailyMessageCount');
  return data;
}

async function updatePendingAction(phoneNumber, pendingAction) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ pending_action: pendingAction, updated_at: new Date().toISOString() })
    .eq('phone_number', phoneNumber)
    .select()
    .single();
  assertNoError(error, 'updatePendingAction');
  return data;
}

module.exports = {
  getProfile,
  createProfile,
  recordConsent,
  deleteProfile,
  updateName,
  updateTone,
  updatePreference,
  recordInteraction,
  incrementDailyMessageCount,
  updatePendingAction,
};
