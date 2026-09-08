const express = require('express');
const router = express.Router();
const { generateAIImage } = require('../utils/gemini');

router.post('/', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'query is required' });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY missing in .env — get a free one at aistudio.google.com/apikey' });
    }

    const imageDataUrl = await generateAIImage(query.trim());
    if (!imageDataUrl) {
      return res.status(502).json({ error: `Image generation failed for "${query}" — Gemini may be rate-limited or temporarily unavailable, try again.` });
    }

    res.json({ imageDataUrl, query: query.trim() });
  } catch (err) {
    console.error('Image generation failed:', err.message);
    res.status(500).json({ error: 'Something went wrong generating an image.' });
  }
});

module.exports = router;
