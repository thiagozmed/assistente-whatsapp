const { supabase } = require('./supabaseClient');

function assertNoError(error, action) {
  if (error) {
    throw new Error(`Supabase ${action} falhou: ${error.message}`);
  }
}

async function createReminder(phoneNumber, { description, scheduledAt }) {
  const { data, error } = await supabase
    .from('reminders')
    .insert({ phone_number: phoneNumber, description, scheduled_at: scheduledAt.toISOString() })
    .select()
    .single();
  assertNoError(error, 'createReminder');
  return data;
}

async function getDueReminders(now) {
  const { data, error } = await supabase.from('reminders').select('*').eq('status', 'pendente').lte('scheduled_at', now.toISOString());
  assertNoError(error, 'getDueReminders');
  return data || [];
}

// Marca como enviado só se ainda estiver pendente (UPDATE ... WHERE status =
// 'pendente' é a trava atômica). Se outro processo já reivindicou esse
// lembrete entre o getDueReminders e agora, a atualização não afeta nenhuma
// linha e devolve null — o chamador não deve enviar a mensagem nesse caso.
// Isso protege contra duplicidade caso mais de um processo (ex: instância
// duplicada, deploy sobreposto) rode o agendador ao mesmo tempo.
async function claimReminder(id) {
  const { data, error } = await supabase
    .from('reminders')
    .update({ status: 'enviado' })
    .eq('id', id)
    .eq('status', 'pendente')
    .select()
    .maybeSingle();
  assertNoError(error, 'claimReminder');
  return data;
}

// Volta o lembrete pra "pendente" depois de uma reivindicação cujo envio
// falhou — permite tentar de novo no próximo ciclo do agendador, em vez de
// perder o lembrete silenciosamente marcado como "enviado" sem ter sido.
async function releaseReminder(id) {
  const { error } = await supabase.from('reminders').update({ status: 'pendente' }).eq('id', id);
  assertNoError(error, 'releaseReminder');
}

module.exports = { createReminder, getDueReminders, claimReminder, releaseReminder };
