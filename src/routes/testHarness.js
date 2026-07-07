const express = require('express');
const { handleIncomingText } = require('../services/messageHandler');

const router = express.Router();

// Número fixo usado quando o corpo da requisição não informa "phone" — permite
// testar onboarding e continuidade de contexto sem precisar do WhatsApp real.
const DEFAULT_TEST_PHONE = '5599999999999';

// Simula uma mensagem de texto chegando, sem precisar do WhatsApp real.
// POST /test/message  { "text": "...", "phone": "opcional" }
router.post('/message', async (req, res) => {
  const { text, phone } = req.body;
  if (!text) return res.status(400).json({ error: 'campo "text" obrigatório' });

  try {
    const reply = await handleIncomingText(phone || DEFAULT_TEST_PHONE, text);
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
