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
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API do seu projeto Supabase. Use a **service_role key**, nunca a anon key (esse backend não tem sessão de usuário, é acesso direto de serviço).

### Criar o banco (Supabase)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No SQL Editor do projeto, rode o conteúdo de `sql/profiles.sql` (cria a tabela `profiles` com RLS habilitado, sem policy — só a `service_role` acessa).
3. Copie a Project URL e a `service_role` key (Project Settings → API) pro `.env`.

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

Sem o campo `"phone"`, todas as chamadas usam o mesmo número fixo de teste — então, na primeira vez, você cai direto no onboarding (pergunta o nome do assistente, depois o tom). Pra simular onboarding do zero, passe um `"phone"` novo:

```bash
curl -X POST http://localhost:3000/test/message -H "Content-Type: application/json" \
  -d '{"phone": "5511900000000", "text": "oi"}'                          # pergunta o nome do assistente
curl -X POST http://localhost:3000/test/message -H "Content-Type: application/json" \
  -d '{"phone": "5511900000000", "text": "pode me chamar de Zeca"}'      # pergunta o tom
curl -X POST http://localhost:3000/test/message -H "Content-Type: application/json" \
  -d '{"phone": "5511900000000", "text": "mais próximo e afetuoso"}'     # conclui onboarding
curl -X POST http://localhost:3000/test/message -H "Content-Type: application/json" \
  -d '{"phone": "5511900000000", "text": "oi de novo"}'                  # segue pro fluxo normal, já personalizado
```

O harness só fica disponível quando `NODE_ENV` não é `production` (padrão no `.env.example`).

Chamar `POST /webhook` diretamente (fora do harness) agora exige um header `X-Hub-Signature-256` válido, calculado com `WHATSAPP_APP_SECRET` — a Meta já manda isso automaticamente em produção. Pra testar a lógica sem se preocupar com assinatura, use sempre `/test/message`.

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
src/
  server.js                    # entrada do Express
  routes/
    webhook.js                 # GET (verificação) + POST (recebimento) do WhatsApp
    testHarness.js             # simula mensagens sem precisar do WhatsApp real
  services/
    claudeClient.js            # cliente Anthropic + modelos usados
    router.js                  # classifica a intenção da mensagem (Haiku 4.5)
    scamShield.js               # escudo contra golpe (Haiku classifica, Sonnet redige o alerta)
    bureaucracy.js              # tradutor de burocracia (Sonnet 5)
    messageHandler.js           # onboarding + roteia a mensagem pro fluxo certo
    whatsapp.js                 # envio de mensagem via Graph API
    webhookSignature.js         # valida o HMAC X-Hub-Signature-256 do webhook
    supabaseClient.js           # cliente Supabase (service role)
    profileStore.js             # acesso à tabela profiles (perfil, onboarding, preferências)
    preferences.js               # extrai nome/tom de texto livre (Haiku)
    personalization.js          # injeta nome/tom/contexto no system prompt
test/
  helpers/setupTestEnv.js       # env dummy, carregado via --require antes dos testes
  helpers/fakeSupabase.js       # fake do builder encadeável do Supabase, só pra testes
  services/                     # testes unitários dos services (rede/Supabase mockados)
  routes/                       # teste de integração do webhook (app.listen(0) + fetch)
```

Rodar os testes: `npm test` (ou `npm run test:watch`). Usa o test runner nativo do Node (`node --test`); Supabase e Anthropic são mockados, então não gasta crédito nem precisa de rede.

## Fora de escopo (pendências conhecidas)

- Interpretação de foto/print e transcrição de áudio — fase 4.
- Lembretes agendados (secretário de agenda) — fase 4.
- Módulo família — fase 6.
- Resumo de histórico mais longo via IA — hoje só a última interação relevante é resumida, deterministicamente.
- LGPD formal (política de retenção, direito ao esquecimento) — pendência que cresce a partir da Fase 3, já que agora dado pessoal fica persistido de verdade (não só em trânsito); revisão fica pra Fase 7.
- Rate limiting por usuário — ainda não implementado.
