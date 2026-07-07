const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados no .env');
}

// service_role: acesso total, ignora RLS. Nunca expor fora do backend.
// Sem sessão de usuário aqui (acesso direto de serviço), então persistSession: false.
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

module.exports = { supabase };
