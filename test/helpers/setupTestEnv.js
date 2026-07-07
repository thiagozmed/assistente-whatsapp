// Carregado via `node --require` antes de qualquer módulo do app subir.
// dotenv.config() não sobrescreve vars já setadas, então isso isola os
// testes do .env real e evita bater numa API paga por mock esquecido.
process.env.NODE_ENV = 'test';
process.env.MOCK_CLAUDE = 'false';
process.env.ANTHROPIC_API_KEY = 'test-dummy-key';
process.env.WEBHOOK_VERIFY_TOKEN = 'test-verify-token';
process.env.WHATSAPP_APP_SECRET = 'test-app-secret';
process.env.WHATSAPP_ACCESS_TOKEN = 'test-access-token';
process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id';
process.env.SUPABASE_URL = 'https://test-project.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
