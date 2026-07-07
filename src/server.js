require('dotenv').config();
const express = require('express');
const webhookRouter = require('./routes/webhook');
const testHarnessRouter = require('./routes/testHarness');

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
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Teste local: POST http://localhost:${PORT}/test/message  { "text": "..." }`);
    }
  });
}

module.exports = { app };
