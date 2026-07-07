# Assistente de IA para Idosos via WhatsApp

MVP: escudo contra golpe, tradutor de burocracia digital e personalização com contexto persistente, via texto, rodando como bot de WhatsApp. Ver `CLAUDE.md` para a spec completa e o roadmap por fases.

## Setup

```bash
npm install
cp .env.example .env   # já feito — só preencher os valores
```

Preencha o `.env`:

- `ANTHROPIC_API_KEY` — chave da API Claude (console.anthropic.com).
- `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` — do painel do app no Meta for Developers (WhatsApp → API Setup). Não são necessários para testar a lógica localmente (veja abaixo).
- `WEBHOOK_VERIFY_TOKEN` — qualquer string que você escolher; usada na verificação do webhook com a Meta.
- `WHATSAPP_APP_SECRET` — Meta App Dashboard → Configurações → Básico → Chave Secreta do Aplicativo. Usada para validar a assinatura (`X-Hub-Signature-256`) de todo `POST /webhook`; sem ela (ou com assinatura inválida), a requisição é rejeitada com 401 antes de processar a mensagem.
- `WHATSAPP_BUSINESS_ACCOUNT_ID` — Meta App Dashboard → WhatsApp → API Setup → "ID da conta comercial do WhatsApp". Só usada pelos scripts de criação/consulta do template de lembretes (ver abaixo), não pelo app em si.
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API do seu projeto Supabase. Use a **service_role key**, nunca a anon key (esse backend não tem sessão de usuário, é acesso direto de serviço).
- `OPENAI_API_KEY` — platform.openai.com, usada pra transcrever áudio via Whisper. Sem crédito configurado, deixe `MOCK_TRANSCRIPTION=true` (padrão) pra não quebrar mensagens de áudio localmente.

### Criar o banco (Supabase)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No SQL Editor do projeto, rode nessa ordem: `sql/profiles.sql`, `sql/reminders.sql`, `sql/002_add_consent.sql` (essa última adiciona o passo de consentimento no onboarding e habilita o comando "esquecer meus dados" — obrigatória antes de liberar pra qualquer usuário real). Todas criam/alteram com RLS habilitado, sem policy — só a `service_role` acessa.
3. Copie a Project URL e a `service_role` key (Project Settings → API) pro `.env`.

### Criar o template dos lembretes (obrigatório antes de usar lembretes de verdade)

Lembretes são mensagens que o bot manda por conta própria, sem o usuário ter escrito antes — a API do WhatsApp só permite isso fora da janela de 24h usando um **message template pré-aprovado pela Meta**, não texto livre.

1. Preencha `WHATSAPP_BUSINESS_ACCOUNT_ID` no `.env` (Meta App Dashboard → WhatsApp → API Setup → "ID da conta comercial do WhatsApp").
2. Rode `node scripts/createReminderTemplate.js` — cria o template `lembrete_agendado` (categoria UTILITY) e envia pra revisão da Meta.
3. Acompanhe a aprovação com `node scripts/checkReminderTemplate.js` (normalmente minutos, às vezes mais). Enquanto o status não for `APPROVED`, o disparo de lembretes falha.

## Testar sem WhatsApp real

Com `ANTHROPIC_API_KEY` e `SUPABASE_*` preenchidas, suba o servidor:

```bash
npm run dev
```

E mande mensagens de teste para o harness local (não usa WhatsApp, só testa a lógica de classificação + resposta):

```bash
curl -X POST http://localhost:3000/test/message \
  -H "Content-Type: application/json" \
  -d '{"text": "Parabéns! Você ganhou um prêmio da Caixa. Clique no link para resgatar: bit.ly/premio123"}'

curl -X POST http://localhost:3000/test/message \
  -H "Content-Type: application/json" \
  -d '{"text": "Apareceu uma tela no app do banco pedindo para eu confirmar meu \"limite pré-aprovado\", tem um botão escrito ATUALIZAR CADASTRO. O que eu faço?"}'
```

Sem o campo `"phone"`, todas as chamadas usam o mesmo número fixo de teste — então, na primeira vez, você cai direto no onboarding (consentimento → nome do assistente → tom). Pra simular onboarding do zero, passe um `"phone"` novo:

```bash
curl -X POST http://localhost:3000/test/message -H "Content-Type: application/json" \
  -d '{"phone": "5511900000000", "text": "oi"}'                          # explica o que guarda, pede consentimento
curl -X POST http://localhost:3000/test/message -H "Content-Type: application/json" \
  -d '{"phone": "5511900000000", "text": "sim, pode"}'                   # registra consentimento, pergunta o nome do assistente
curl -X POST http://localhost:3000/test/message -H "Content-Type: application/json" \
  -d '{"phone": "5511900000000", "text": "pode me chamar de Zeca"}'      # pergunta o tom
curl -X POST http://localhost:3000/test/message -H "Content-Type: application/json" \
  -d '{"phone": "5511900000000", "text": "mais próximo e afetuoso"}'     # conclui onboarding
curl -X POST http://localhost:3000/test/message -H "Content-Type: application/json" \
  -d '{"phone": "5511900000000", "text": "oi de novo"}'                  # segue pro fluxo normal, já personalizado
curl -X POST http://localhost:3000/test/message -H "Content-Type: application/json" \
  -d '{"phone": "5511900000000", "text": "esquece meus dados"}'          # apaga o perfil e os lembretes associados
```

O harness só fica disponível quando `NODE_ENV` não é `production` (padrão no `.env.example`).

Chamar `POST /webhook` diretamente (fora do harness) agora exige um header `X-Hub-Signature-256` válido, calculado com `WHATSAPP_APP_SECRET` — a Meta já manda isso automaticamente em produção. Pra testar a lógica sem se preocupar com assinatura, use sempre `/test/message`.

**Imagem e áudio (interpretação de print + lembretes) só são testáveis de ponta a ponta pelo WhatsApp real** — o harness `/test/message` só aceita texto (não tem como simular upload de mídia sem o fluxo de download da Meta). Pra testar:

- **Imagem:** manda um print de tela confusa (com ou sem legenda) pro número de WhatsApp conectado.
- **Áudio:** manda um áudio tipo "me lembra de tomar remédio amanhã às 8 da manhã" — a resposta confirma o lembrete, e a mensagem chega automaticamente no horário marcado (checagem a cada 1 minuto, ver `reminderDispatcher.js`).

## Conectar ao WhatsApp real

1. Siga os passos do app Meta (veja a conversa de setup ou a documentação do WhatsApp Business Cloud API).
2. Exponha o servidor local publicamente para a Meta conseguir chamar o webhook — use algo como `ngrok http 3000` durante o desenvolvimento.
3. No painel do app Meta, configure o webhook apontando para `https://<sua-url>/webhook`, usando o mesmo valor de `WEBHOOK_VERIFY_TOKEN` do seu `.env`.
4. Inscreva o webhook no campo `messages`.
5. Mande uma mensagem de texto para o número de teste do WhatsApp Business — a resposta deve chegar automaticamente.

## Estrutura

```
sql/
  profiles.sql                 # DDL da tabela profiles (rodar manualmente no Supabase)
  reminders.sql                # DDL da tabela reminders (rodar depois de profiles.sql)
  002_add_consent.sql          # migração: consentimento no onboarding + cascade de delete
scripts/
  createReminderTemplate.js    # cria o message template dos lembretes no WABA (rodar uma vez)
  checkReminderTemplate.js     # consulta o status de aprovação do template
src/
  server.js                    # entrada do Express + agendador de lembretes
  routes/
    webhook.js                 # GET (verificação) + POST (recebimento) do WhatsApp: texto/imagem/áudio
    testHarness.js             # simula mensagens de texto sem precisar do WhatsApp real
  services/
    claudeClient.js            # cliente Anthropic + modelos usados
    router.js                  # classifica a intenção da mensagem (Haiku 4.5)
    scamShield.js               # escudo contra golpe (texto ou imagem; Haiku classifica, Sonnet redige o alerta)
    bureaucracy.js              # tradutor de burocracia (texto ou imagem; Sonnet 5)
    mediaContent.js              # monta o content block de visão (imagem) pra API Claude
    messageHandler.js           # onboarding + roteia texto/imagem/áudio pro fluxo certo
    whatsapp.js                 # envio de mensagem e download de mídia via Graph API
    webhookSignature.js         # valida o HMAC X-Hub-Signature-256 do webhook
    supabaseClient.js           # cliente Supabase (service role)
    profileStore.js             # acesso à tabela profiles (perfil, onboarding, preferências)
    preferences.js               # extrai nome/tom de texto livre (Haiku)
    consent.js                   # mensagem de consentimento (LGPD) + interpretação da resposta (Haiku)
    personalization.js          # injeta nome/tom/contexto no system prompt
    transcription.js             # transcreve áudio via Whisper (OpenAI)
    agenda.js                    # extrai descrição/data de um lembrete a partir de texto (Haiku)
    reminderStore.js             # acesso à tabela reminders
    reminderDispatcher.js        # dispara lembretes vencidos (cron in-process, 1x por minuto)
test/
  helpers/setupTestEnv.js       # env dummy, carregado via --require antes dos testes
  helpers/fakeSupabase.js       # fake do builder encadeável do Supabase, só pra testes
  services/                     # testes unitários dos services (rede/Supabase mockados)
  routes/                       # teste de integração do webhook (app.listen(0) + fetch)
```

Rodar os testes: `npm test` (ou `npm run test:watch`). Usa o test runner nativo do Node (`node --test`); Supabase, Anthropic, WhatsApp e Whisper são todos mockados, então não gasta crédito nem precisa de rede.

## Fora de escopo (pendências conhecidas)

- Lembretes recorrentes — só lembrete único no MVP (o campo já existe no schema, sem lógica de repetição).
- Confirmação de lembrete em áudio (TTS) — só texto por enquanto.
- Cancelamento/edição de lembrete pelo usuário.
- Fila de verdade (BullMQ+Redis) pro disparo de lembretes — cron simples in-process resolve bem o volume de uso pessoal do MVP.
- Módulo família — fase 6.
- Resumo de histórico mais longo via IA — hoje só a última interação relevante é resumida, deterministicamente.
- LGPD: consentimento explícito no onboarding e comando "esquecer meus dados" (direito ao esquecimento básico) já implementados. Falta política de retenção formal por escrito e revisão completa — fica pra Fase 7.
- Rate limiting por usuário — ainda não implementado.
