require('dotenv').config();
const express = require('express');
const webhookRouter = require('./routes/webhook');
const testHarnessRouter = require('./routes/testHarness');
const { startReminderScheduler } = require('./services/reminderDispatcher');

const app = express();
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));

app.use('/webhook', webhookRouter);

if (process.env.NODE_ENV !== 'production') {
  app.use('/test', testHarnessRouter);
}

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  // startReminderScheduler só roda dentro do callback de sucesso do listen —
  // se a porta já estiver ocupada (ex: processo duplicado rodando), esse
  // processo nunca chega a ligar seu próprio agendador. A trava atômica em
  // reminderStore.claimReminder cobre o resto (mesmo 2 processos saudáveis
  // rodando ao mesmo tempo não duplicam envio).
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Teste local: POST http://localhost:${PORT}/test/message  { "text": "..." }`);
    }
    startReminderScheduler();
  });
}

module.exports = { app };
