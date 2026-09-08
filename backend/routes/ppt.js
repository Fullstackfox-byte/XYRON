const express = require('express');
const router = express.Router();
const { generatePresentation } = require('../utils/pptGenerator');

router.post('/', async (req, res) => {
  try {
    const { topic, theme } = req.body || {};
    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ error: 'topic is required' });
    }
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({ error: 'OPENROUTER_API_KEY missing in .env' });
    }

    const result = await generatePresentation({ topic, theme });
    res.json(result);
  } catch (err) {
    console.error('PPT generation failed:', err);
    const status = /outline/i.test(err.message) ? 502 : 500;
    res.status(status).json({ error: `Something went wrong generating the presentation: ${err.message}` });
  }
});

module.exports = router;