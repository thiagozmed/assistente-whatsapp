# Assistente de IA para Idosos via WhatsApp — Fase 1

MVP: escudo contra golpe + tradutor de burocracia digital, via texto, rodando como bot de WhatsApp. Ver `CLAUDE.md` para a spec completa e o roadmap por fases.

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

## Testar sem WhatsApp real

Com `ANTHROPIC_API_KEY` preenchida, suba o servidor:

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
src/
  server.js                  # entrada do Express
  routes/
    webhook.js                # GET (verificação) + POST (recebimento) do WhatsApp
    testHarness.js             # simula mensagens sem precisar do WhatsApp real
  services/
    claudeClient.js            # cliente Anthropic + modelos usados
    router.js                  # classifica a intenção da mensagem (Haiku 4.5)
    scamShield.js               # escudo contra golpe (Haiku classifica, Sonnet redige o alerta)
    bureaucracy.js              # tradutor de burocracia (Sonnet 5)
    messageHandler.js           # roteia a mensagem pro fluxo certo
    whatsapp.js                 # envio de mensagem via Graph API
    webhookSignature.js         # valida o HMAC X-Hub-Signature-256 do webhook
test/
  helpers/setupTestEnv.js       # env dummy, carregado via --require antes dos testes
  services/                     # testes unitários dos services (rede mockada)
  routes/                       # teste de integração do webhook (app.listen(0) + fetch)
```

Rodar os testes: `npm test` (ou `npm run test:watch`). Usa o test runner nativo do Node (`node --test`), sem dependência extra.

## Fora do escopo da Fase 1

- Interpretação de foto/print (só texto por enquanto) — fase 2.
- Transcrição de áudio — fase 2.
- Lembretes agendados — fase 2.
- Módulo família — fase 3.
- Persistência em banco (Supabase) — ainda não conectado; conversas não são salvas.
