# Assistente de IA para Idosos via WhatsApp — Spec do MVP

## 1. Visão geral

Assistente pessoal por IA que roda dentro do WhatsApp (canal que o público 60+ já domina), pensado para eliminar a fricção de aprender interface nova. Funciona por texto, áudio e foto. Resolve três dores centrais e tem um módulo pago à parte para os filhos acompanharem/ajudarem os pais à distância, sempre com consentimento explícito do idoso.

**Personas:**
- **Idoso (usuário principal):** 60+, usa WhatsApp no dia a dia, tem dificuldade com apps e telas novas, medo de golpe, quer autonomia sem depender do filho toda hora.
- **Filho/filha (comprador do módulo família):** adulto, preocupado com os pais à distância, quer tranquilidade sem invadir a privacidade deles.

## 2. Funcionalidades do MVP (núcleo, uso do idoso)

### 2.1 Escudo contra golpe (prioridade máxima — maior gancho comercial)
- Idoso encaminha mensagem/print suspeito.
- IA classifica: golpe conhecido, suspeito, ou legítimo.
- Resposta em linguagem simples e direta: o que é, o que fazer (ex: "não clique, apague, bloqueie o número").
- Se módulo família ativo: gera alerta resumido para o filho.

### 2.2 Tradutor de burocracia digital
- Idoso manda foto de tela confusa (banco, plano de saúde, INSS, Receita).
- IA explica em português simples, passo a passo, o que apertar.
- Sem histórico de dúvida "boba" — tom sempre paciente, nunca condescendente.

### 2.3 Secretário de agenda e recados por voz
- Áudio → transcrição → IA extrai intenção (compromisso, lembrete, recado).
- Confirma de volta por áudio/texto simples.
- Dispara lembrete automático na hora certa (remédio, consulta, compromisso).

## 3. Módulo Família (add-on pago, opt-in)

**Regra de ouro:** o idoso sempre sabe o que é compartilhado. Nunca modo oculto/espião.

Fluxo de ativação:
1. Filho contrata o módulo.
2. Assistente avisa o idoso e pede consentimento explícito, item por item (não é um aceite genérico).
3. Idoso pode revogar qualquer item a qualquer momento, a qualquer hora, falando naturalmente com o assistente.

Funcionalidades (cada uma com consentimento próprio):
- Alerta de golpe em tempo real para o filho.
- Resumo semanal de bem-estar (nível alto: compromissos cumpridos, lembretes de remédio, nº de alertas de golpe — nunca conteúdo de conversas privadas).
- Check-in diário automático (se não responder em X horas, avisa o filho).
- Assistência remota assistida (filho pede para o assistente ajudar o pai numa tarefa específica).
- Compartilhamento de agenda/compromissos médicos.

**Nunca incluir:** leitura de conversas privadas com terceiros, localização contínua sem ativação explícita a cada uso, qualquer feature que pareça controle em vez de cuidado.

## 4. Arquitetura técnica proposta

- **Canal:** WhatsApp Business Cloud API (Meta oficial)
- **Backend:** Node.js + Express
- **IA:** API Claude — Haiku para triagem rápida (classificar intenção/urgência), Sonnet para tarefas de raciocínio mais completo (explicar passo a passo, redigir alerta)
- **Transcrição de áudio:** Whisper (speech-to-text) antes de enviar texto para a IA
- **Interpretação de imagem:** API Claude (aceita imagem nativamente, sem OCR separado)
- **Banco de dados:** Supabase (Postgres gerenciado) — perfis, consentimentos, histórico de lembretes, vínculos família
- **Hospedagem:** Railway ou Render (webhook 24h, custo baixo para MVP)
- **Fila/agendamento:** BullMQ + Redis (ou cron simples na fase 1) para disparo de lembretes

## 5. Roadmap por fases

**Fase 1 — Validação manual (poucos usuários reais, ex.: pais e conhecidos)**
- Bot WhatsApp básico + IA de texto (escudo contra golpe + tradutor de burocracia)
- Sem módulo família ainda
- Meta: validar que o idoso usa sem suporte e sente valor real em 1-2 semanas

**Fase 2 — Voz e imagem**
- Transcrição de áudio
- Interpretação de foto/print
- Lembretes agendados

**Fase 3 — Módulo Família**
- Fluxo de consentimento
- Alertas e resumos para o filho
- Modelo de cobrança separado (add-on)

**Fase 4 — Robustez para lançamento público**
- Onboarding automatizado
- Métricas de retenção e uso
- Ajuste de custo (cache de prompt, roteamento Haiku/Sonnet mais fino)

## 6. Métricas de validação (Fase 1)

- Idoso consegue usar sem ajuda do filho após a primeira explicação?
- Quantas vezes por semana ele volta a usar espontaneamente?
- O escudo contra golpe gerou algum "momento uau" real (evitou um golpe de fato)?
- Filho pagaria pelo módulo família só de ver o protótipo?
