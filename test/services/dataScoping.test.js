const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Revisão de segurança 2026-07-07 (item 3): o backend usa a service_role key
// do Supabase, que ignora Row Level Security — a única coisa que impede uma
// query de devolver a tabela inteira (dados de TODOS os usuários) é a
// aplicação lembrar de filtrar por phone_number. Esse teste escaneia o
// código-fonte (não o comportamento mockado) pra travar qualquer função nova
// em profileStore/reminderStore que esqueça esse filtro.

const ALLOWLIST = new Set([
  'createProfile', // insert por phone_number — não há linha existente pra filtrar
  'createReminder', // insert por phone_number — não há linha existente pra filtrar
  'getDueReminders', // cross-user por design: o agendador varre lembretes vencidos de todo mundo
  'claimReminder', // filtra pelo id interno do lembrete (não vem do usuário final)
  'releaseReminder', // filtra pelo id interno do lembrete (não vem do usuário final)
]);

function extractFunctionBlocks(source) {
  const lines = source.split('\n');
  const blocks = [];
  let current = null;

  for (const line of lines) {
    const match = line.match(/^(?:async )?function (\w+)\(/);
    if (match) {
      if (current) blocks.push(current);
      current = { name: match[1], body: [line] };
      continue;
    }
    if (current) {
      current.body.push(line);
      if (line === '}') {
        blocks.push(current);
        current = null;
      }
    }
  }
  if (current) blocks.push(current);
  return blocks.map((b) => ({ name: b.name, body: b.body.join('\n') }));
}

function assertScoped(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const blocks = extractFunctionBlocks(source);
  assert.ok(blocks.length > 0, `nenhuma função encontrada em ${filePath} — o parser ingênuo deste teste pode ter quebrado`);

  for (const { name, body } of blocks) {
    if (ALLOWLIST.has(name)) continue;

    const touchesUserTable = /\.from\(['"](profiles|reminders)['"]\)/.test(body) || /\.rpc\(/.test(body);
    if (!touchesUserTable) continue;

    const isScoped = body.includes(".eq('phone_number'") || body.includes('p_phone_number');
    assert.ok(
      isScoped,
      `${name} em ${filePath} acessa profiles/reminders sem filtrar por phone_number — isso devolveria dados de TODOS os usuários (service_role ignora RLS). Se for intencional, adicione "${name}" na ALLOWLIST deste teste com um comentário explicando por quê.`,
    );
  }
}

test('profileStore: toda função que acessa a tabela profiles filtra por phone_number (exceto insert)', () => {
  assertScoped(path.join(__dirname, '../../src/services/profileStore.js'));
});

test('reminderStore: toda função que acessa a tabela reminders filtra por phone_number, exceto as intencionalmente cross-user', () => {
  assertScoped(path.join(__dirname, '../../src/services/reminderStore.js'));
});
