const { supabase } = require('./supabaseClient');

// A Meta pode reentregar o mesmo evento de webhook (rede instável, etc.) mesmo
// depois do nosso ack 200 imediato — sql/005_processed_messages.sql cria a PK
// em "wamid" que faz o dedup: a segunda tentativa de INSERT do mesmo wamid
// colide (23505) e é descartada aqui, sem reprocessar a mensagem.
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

// Limpeza best-effort, sem exigir um scheduler separado — roda só numa fração
// pequena das chamadas pra não custar uma query extra em toda mensagem.
function cleanupOldEntries() {
  const cutoff = new Date(Date.now() - RETENTION_MS).toISOString();
  supabase
    .from('processed_messages')
    .delete()
    .lt('processed_at', cutoff)
    .then(() => {})
    .catch(() => {});
}

async function claimMessage(wamid) {
  const { error } = await supabase.from('processed_messages').insert({ wamid });

  if (error) {
    if (error.code === '23505') return false; // já processada — reentrega da Meta
    throw new Error(`Supabase claimMessage falhou: ${error.message}`);
  }

  if (Math.random() < 0.02) cleanupOldEntries();

  return true;
}

module.exports = { claimMessage };
