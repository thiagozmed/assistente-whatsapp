const express = require('express');
const { handleIncomingText } = require('../services/messageHandler');

const router = express.Router();

// Simula uma mensagem de texto chegando, sem precisar do WhatsApp real.
// POST /test/message  { "text": "..." }
router.post('/message', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'campo "text" obrigatório' });

  try {
    const reply = await handleIncomingText(text);
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
