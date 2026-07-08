// Migração única: cifra tone/last_interaction_summary/reminders.description
// que ainda estão em texto puro, gravados antes da criptografia de campo
// (src/services/encryption.js) entrar em vigor. Idempotente — pula qualquer
// valor que já comece com o prefixo "enc:v1:", então rodar mais de uma vez
// não faz mal.
//
//   node scripts/encryptExistingData.js
require('dotenv').config();
const { supabase } = require('../src/services/supabaseClient');
const { encrypt } = require('../src/services/encryption');

const ENCRYPTED_PREFIX = 'enc:v1:';

async function migrateProfiles() {
  const { data, error } = await supabase.from('profiles').select('phone_number, tone, last_interaction_summary');
  if (error) throw new Error(`Falha lendo profiles: ${error.message}`);

  let migrated = 0;
  for (const row of data) {
    const changes = {};
    if (row.tone && !row.tone.startsWith(ENCRYPTED_PREFIX)) changes.tone = encrypt(row.tone);
    if (row.last_interaction_summary && !row.last_interaction_summary.startsWith(ENCRYPTED_PREFIX)) {
      changes.last_interaction_summary = encrypt(row.last_interaction_summary);
    }
    if (Object.keys(changes).length === 0) continue;

    const { error: updateError } = await supabase.from('profiles').update(changes).eq('phone_number', row.phone_number);
    if (updateError) throw new Error(`Falha atualizando profile ${row.phone_number}: ${updateError.message}`);
    migrated += 1;
  }
  console.log(`profiles: ${migrated} linha(s) migrada(s) de ${data.length} no total.`);
}

async function migrateReminders() {
  const { data, error } = await supabase.from('reminders').select('id, description');
  if (error) throw new Error(`Falha lendo reminders: ${error.message}`);

  let migrated = 0;
  for (const row of data) {
    if (!row.description || row.description.startsWith(ENCRYPTED_PREFIX)) continue;
    const { error: updateError } = await supabase.from('reminders').update({ description: encrypt(row.description) }).eq('id', row.id);
    if (updateError) throw new Error(`Falha atualizando reminder ${row.id}: ${updateError.message}`);
    migrated += 1;
  }
  console.log(`reminders: ${migrated} linha(s) migrada(s) de ${data.length} no total.`);
}

async function main() {
  if (!process.env.DATA_ENCRYPTION_KEY) {
    throw new Error('DATA_ENCRYPTION_KEY não configurada no .env — configure antes de rodar essa migração.');
  }
  await migrateProfiles();
  await migrateReminders();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Erro na migração:', err.message);
    process.exit(1);
  });
