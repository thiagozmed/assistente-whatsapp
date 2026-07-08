const crypto = require('crypto');

// Criptografia de campo, na aplicação — não no banco. A chave nunca é gravada
// no Supabase (só existe como variável de ambiente do servidor), então
// acesso ao banco sozinho (painel do Supabase, chave service_role vazada,
// brecha na própria Supabase) não é suficiente pra ler o conteúdo: precisa
// também dessa chave, que vive num sistema separado (Railway).
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

// Prefixo que distingue valor cifrado de texto puro legado (linha gravada
// antes dessa migração, ou ainda não migrada) — sem isso, dado não migrado
// quebraria a leitura em vez de simplesmente continuar desprotegido até a
// migração passar por ele.
const PREFIX = 'enc:v1:';

function getKey() {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'DATA_ENCRYPTION_KEY não configurada no .env — gere com: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('DATA_ENCRYPTION_KEY inválida — precisa decodificar (base64) pra exatamente 32 bytes.');
  }
  return key;
}

// null/undefined passam direto — campos como tone/last_interaction_summary
// ficam null até o onboarding/primeira interação, não faz sentido cifrar "nada".
function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return plaintext;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

function decrypt(value) {
  if (value === null || value === undefined) return value;
  if (!value.startsWith(PREFIX)) return value;

  const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
