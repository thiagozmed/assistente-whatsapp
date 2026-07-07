const reminderStore = require('./reminderStore');
const whatsapp = require('./whatsapp');

async function dispatchDueReminders(now = new Date()) {
  const due = await reminderStore.getDueReminders(now);

  const results = await Promise.allSettled(
    due.map(async (reminder) => {
      // Reivindica antes de enviar (não depois): se outro processo já
      // reivindicou esse lembrete nesse meio-tempo, claimReminder devolve
      // null e a gente não manda a mensagem de novo. Isso é o que evita
      // disparo duplicado se mais de um processo do agendador rodar ao
      // mesmo tempo (ex: processo antigo não finalizado corretamente).
      const claimed = await reminderStore.claimReminder(reminder.id);
      if (!claimed) return false;
      try {
        await whatsapp.sendTextMessage(reminder.phone_number, `⏰ Lembrete: ${reminder.description}`);
        return true;
      } catch (err) {
        // Falhou depois de reivindicado: devolve pra pendente pra tentar de
        // novo no próximo ciclo, em vez de perder o lembrete.
        await reminderStore.releaseReminder(reminder.id).catch(() => {});
        throw err;
      }
    }),
  );

  let sentCount = 0;
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`Erro disparando lembrete ${due[index].id}:`, result.reason?.message ?? result.reason);
    } else if (result.value) {
      sentCount += 1;
    }
  });

  return sentCount;
}

// Só deve ser chamado a partir de server.js dentro do guard
// `require.main === module` — nunca no top-level do módulo, senão qualquer
// `require` em teste dispararia um timer real vazando entre arquivos.
function startReminderScheduler({ intervalMs = 60000 } = {}) {
  return setInterval(() => {
    dispatchDueReminders().catch((err) => console.error('Erro no ciclo do agendador de lembretes:', err.message));
  }, intervalMs);
}

module.exports = { dispatchDueReminders, startReminderScheduler };
