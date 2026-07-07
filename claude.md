# Assistente de IA para Idosos via WhatsApp — CLAUDE.md

## 1. Posicionamento estratégico

O WhatsApp já é a interface que qualquer pessoa, de qualquer idade, sabe usar — abrir conversa, mandar áudio ou texto. A Meta já colocou a Meta AI dentro do WhatsApp (assistente genérico, gratuito, de propósito geral). Isso **valida** a tese de "IA dentro do WhatsApp", mas também significa que não competimos em "ter IA no WhatsApp" — competimos em ser a camada que a Meta AI genérica não constrói:

- Personalização real (nome, tom de voz, contexto persistente do usuário)
- Especialização na dor de quem tem baixa literacia digital (paciência, linguagem simples, proatividade)
- Confiança e intimidade desenhadas com cuidado (não é só "uma IA a mais", é presença constante e consistente)
- Módulo família com consentimento explícito — algo que uma big tech generalista não prioriza para este nicho

**Não somos "outro chatbot no WhatsApp". Somos a camada de confiança e cuidado que falta no ecossistema de IA genérica.**

## 2. Personas

- **Idoso (usuário principal):** 60+, já usa WhatsApp no dia a dia, dificuldade com apps/telas novas, medo de golpe, quer autonomia sem depender do filho toda hora.
- **Filho/filha (comprador do módulo família):** adulto, preocupado com os pais à distância, quer tranquilidade sem invadir a privacidade deles.

## 3. Princípios não negociáveis de produto

1. **Transparência sobre ser IA.** O assistente pode ter nome e personalidade calorosa, mas nunca finge ser humano se perguntado diretamente.
2. **Não substitui vínculo humano.** Se o idoso expressar que o assistente é "o único" que o entende ou o escuta, a resposta deve acolher com carinho e reforçar gentilmente o valor de contato com família/amigos — nunca absorver esse papel.
3. **Consentimento explícito e revogável no módulo família.** Item por item, nunca aceite genérico. Nunca modo oculto/espião.
4. **Sem mocks a partir de agora.** Toda funcionalidade implementada deve rodar contra os serviços reais (WhatsApp Cloud API real, API Claude real, banco real). Nada de simular resposta ou dado fictício "pra depois trocar".
5. **Nenhuma fase avança sem testes automatizados passando.** Cobertura mínima: o caminho feliz de cada funcionalidade nova + os casos de erro previsíveis (falha de API externa, entrada inválida, timeout).
6. **Segurança pensada desde a primeira linha de código**, não deixada para o final (ver seção 6).

## 4. Funcionalidades do usuário principal (idoso)

O assistente é de propósito geral (pode responder qualquer coisa que uma IA normalmente responde), com as seguintes funções como destaque de produto e prioridade de desenvolvimento:

### 4.1 Escudo contra golpe (prioridade máxima — maior gancho comercial)
- Idoso encaminha mensagem/print suspeito.
- IA classifica: golpe conhecido, suspeito, ou legítimo.
- Resposta simples e direta: o que é, o que fazer.
- Se módulo família ativo e consentido: gera alerta resumido para o filho.

### 4.2 Tradutor de burocracia digital
- Idoso manda foto de tela confusa (banco, plano de saúde, INSS, Receita).
- IA explica em português simples, passo a passo, sempre paciente, nunca condescendente.

### 4.3 Secretário de agenda e recados por voz
- Áudio → transcrição → IA extrai intenção (compromisso, lembrete, recado).
- Confirma de volta por áudio/texto simples.
- Dispara lembrete automático na hora certa.

### 4.4 Personalização de identidade e tom
- No cadastro, o assistente pergunta como o usuário quer chamá-lo e se prefere um tom mais formal ou mais próximo/afetuoso.
- Preferência fica salva no perfil e é injetada no system prompt em toda interação.
- Alterável a qualquer momento via comando simples ("quero te chamar de outro nome", "fala comigo de um jeito mais formal").

### 4.5 Assistente de propósito geral, com limites
- Fora das funções de destaque, o assistente pode responder perguntas gerais como qualquer IA.
- Limites obrigatórios (ver seção 6.3 para detalhes técnicos):
  - Sem geração de código.
  - Sem geração de imagem (custo alto, fora do escopo do público).
  - Limite de mensagens diário por usuário.
  - Roteamento por complexidade (modelo mais barato primeiro, escalar só quando necessário).

## 5. Módulo Família (add-on pago, opt-in)

**Regra de ouro:** o idoso sempre sabe o que é compartilhado.

Fluxo de ativação:
1. Filho contrata o módulo.
2. Assistente avisa o idoso e pede consentimento explícito, item por item.
3. Idoso pode revogar qualquer item a qualquer momento, falando naturalmente com o assistente.

Funcionalidades (cada uma com consentimento próprio), **entregues via WhatsApp, sem dashboard nesta fase**:
- Alerta de golpe em tempo real para o filho.
- Resumo semanal de bem-estar (nível alto: compromissos cumpridos, lembretes de remédio, nº de alertas de golpe — nunca conteúdo de conversas privadas).
- Check-in diário automático (se não responder em X horas, avisa o filho).
- Assistência remota assistida (filho pede para o assistente ajudar o pai numa tarefa específica).
- Compartilhamento de agenda/compromissos médicos.

**Nunca incluir:** leitura de conversas privadas com terceiros, localização contínua sem ativação explícita a cada uso, qualquer feature que pareça controle em vez de cuidado.

**Decisão em aberto — dashboard:** avaliado e adiado deliberadamente. Para o idoso, um dashboard contradiz a proposta de valor (zero fricção de interface). Para o filho, a recomendação é validar a demanda primeiro com resumos via WhatsApp (Fase 3) — só construir dashboard web se, depois de uso real, surgir pedido explícito por histórico/gráficos. Revisitar esta decisão ao final da Fase 3.

## 6. Arquitetura técnica

### 6.1 Stack
- **Canal:** WhatsApp Business Cloud API (Meta oficial)
- **Backend:** Node.js + Express
- **IA:** API Claude
  - `claude-haiku-4-5` — triagem rápida (classificar intenção/urgência, primeira passada do escudo contra golpe, roteamento de complexidade)
  - `claude-sonnet-5` — raciocínio mais completo (explicar burocracia passo a passo, redigir alerta pro filho, conversas gerais); preço promocional (US$2/US$10 por MTok) até 31/08/2026
  - Não usar Fable 5/Opus — tarefas do MVP não exigem trabalho autônomo de longo horizonte; custo e latência não se justificam num chat que precisa responder rápido
  - `thinking: {type: "adaptive"}` no Sonnet 5 quando a explicação exigir mais de um passo de raciocínio
- **Transcrição de áudio:** Whisper (speech-to-text) antes de enviar texto para a IA
- **Interpretação de imagem:** API Claude (nativa, sem OCR separado)
- **Banco de dados:** Supabase (Postgres gerenciado) — perfis, consentimentos, histórico resumido, vínculos família
- **Hospedagem:** Railway ou Render
- **Fila/agendamento:** BullMQ + Redis (ou cron simples na fase 1)

### 6.2 Contexto persistente do usuário
- Cada número de telefone = um perfil no Supabase (nome preferido, tom de voz, resumo estruturado de histórico relevante — não conversa crua completa).
- Resumir periodicamente em vez de reenviar histórico inteiro a cada chamada, para controlar custo de token.
- Usar prompt caching sempre que o system prompt/contexto se repetir entre chamadas.

### 6.3 Segurança e controle de abuso (implementar desde a Fase 1, não deixar para o final)
- **Verificação de assinatura do webhook:** validar o header `X-Hub-Signature-256` do Meta em toda requisição recebida, não confiar apenas na Verify Token inicial.
- **Variáveis sensíveis:** nunca hardcoded — sempre via `.env`, nunca commitado no Git (`.gitignore` desde o primeiro commit).
- **Token do WhatsApp:** migrar de temporário para permanente via System User assim que possível (já viável, empresa verificada).
- **Rate limiting por usuário:** limite de mensagens/dia por número, para conter custo e abuso.
- **Bloqueio de categorias fora de escopo:** geração de código e geração de imagem devem ser recusadas pelo próprio assistente antes de chegar à chamada de IA mais cara, quando possível detectar por triagem barata (Haiku).
- **Sanitização de input:** nunca repassar conteúdo de mensagens recebidas diretamente para logs ou storage sem tratamento — evitar vazamento de dados pessoais em logs de debug.
- **LGPD:** dados de idosos são dados pessoais sensíveis por natureza do produto (saúde, financeiro, localização de compromissos). Consentimento explícito e política de retenção de dados devem existir antes do primeiro usuário real fora do próprio time.
- **Isolamento de dados entre clientes/contas de teste:** ao configurar acesso no Meta Business, sempre restringir explicitamente a conta de WhatsApp em uso, nunca aceitar "todas as contas atuais e futuras".

## 7. Regras de desenvolvimento (para o Claude Code CLI seguir em toda sessão)

1. Nenhuma funcionalidade nova é considerada concluída sem teste automatizado cobrindo o caminho feliz e pelo menos um caso de falha.
2. Antes de iniciar uma fase nova, rodar toda a suíte de testes das fases anteriores — nenhuma regressão é aceitável.
3. Implementar a funcionalidade contra o serviço real (WhatsApp real, Claude real, banco real) desde o início — nada de mock "temporário".
4. Ao final de cada fase, resumir no chat: o que foi implementado, quais testes cobrem o quê, e quais riscos de segurança já foram tratados ou ainda estão pendentes.
5. Revisão de segurança e qualidade de código completa fica para o final de todo o MVP (todas as fases), mas qualquer prática de baixo custo/alto retorno (sanitização de input, .env, rate limiting básico) deve ser aplicada já durante o desenvolvimento, não adiada.

## 8. Roadmap por fases (cada fase com critério de validação testável)

**Fase 1 — Fluxo real ponta a ponta (em andamento)**
- Webhook real recebendo mensagem do WhatsApp.
- Chamada real à API Claude.
- Resposta real enviada de volta ao WhatsApp.
- Testes automatizados cobrindo: recebimento de mensagem válida, falha de API da Claude, falha de envio ao WhatsApp.
- **Critério de validação:** eu (Thiago) consigo mandar uma mensagem real pelo meu WhatsApp e receber resposta real gerada pela Claude, com log limpo de cada etapa.

**Fase 2 — Escudo contra golpe funcional**
- Classificação real de golpe/suspeito/legítimo.
- Resposta adaptada ao tom de linguagem simples.
- Testes cobrindo: mensagem claramente de golpe, mensagem claramente legítima, mensagem ambígua.
- **Critério de validação:** testar com 3-5 exemplos reais de golpe conhecidos (print real) e confirmar classificação correta.

**Fase 3 — Personalização e contexto persistente**
- Perfil de usuário no Supabase (nome, tom, histórico resumido).
- Onboarding perguntando nome/tom preferido.
- Testes cobrindo: criação de perfil novo, atualização de preferência, recuperação de contexto em conversa subsequente.
- **Critério de validação:** conversar em dois dias diferentes e confirmar que o assistente lembra nome e preferências sem repetir onboarding.

**Fase 4 — Tradutor de burocracia + Secretário de agenda por voz**
- Interpretação de imagem (print de tela confusa).
- Transcrição de áudio + extração de intenção + lembrete agendado.
- Testes cobrindo: imagem válida, áudio válido, falha de transcrição, lembrete disparado na hora certa.
- **Critério de validação:** agendar um lembrete real por áudio e confirmar que ele chega automaticamente no horário certo.

**Fase 5 — Validação com usuários reais (pais e conhecidos)**
- Sem código novo relevante — foco em uso real, coleta de feedback.
- **Critério de validação:** métricas da seção 9 atingidas com pelo menos 3-5 usuários reais por 1-2 semanas.

**Fase 6 — Módulo Família (WhatsApp apenas, sem dashboard)**
- Fluxo de consentimento item por item.
- Alertas e resumos semanais via WhatsApp para o filho.
- Testes cobrindo: consentimento aceito, consentimento revogado, alerta disparado corretamente, resumo semanal correto.
- **Critério de validação:** um filho de teste recebe alerta real de golpe e resumo semanal real, com o idoso ciente do que foi compartilhado.

**Fase 7 — Revisão geral de segurança e qualidade de código**
- Auditoria completa do código acumulado.
- Reforço de qualquer ponto de segurança não coberto nas fases anteriores.
- Otimização de custo de token (roteamento Haiku/Sonnet mais fino, cache de prompt revisado).

**Fase 8 — Robustez para lançamento público**
- Onboarding automatizado sem intervenção manual.
- Decisão final sobre dashboard do módulo família (ver seção 5).
- Preparo para escalar além do círculo de teste.

## 9. Métricas de validação

- Idoso consegue usar sem ajuda do filho após a primeira explicação?
- Quantas vezes por semana ele volta a usar espontaneamente?
- O escudo contra golpe gerou algum "momento uau" real (evitou um golpe de fato)?
- Filho pagaria pelo módulo família só de ver o protótipo funcionando via WhatsApp, sem dashboard?