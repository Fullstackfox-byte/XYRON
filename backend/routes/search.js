const express = require('express');
const router = express.Router();
const { searchYouTube, searchWeb } = require('../utils/scrape');

// POST /api/find-link — { query, site }
// site: 'youtube' (default) for a playable video link, or anything else
// (e.g. 'web', 'google', a domain name) for a general web search.
router.post('/', async (req, res) => {
  try {
    const { query, site } = req.body || {};
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'query is required' });
    }
    const cleanQuery = query.trim();
    const targetSite = (site || 'youtube').toLowerCase().trim();

    let results;
    if (targetSite === 'youtube') {
      results = await searchYouTube(cleanQuery);
    } else if (targetSite === 'web' || targetSite === 'internet' || targetSite === 'google') {
      results = await searchWeb(cleanQuery);
    } else {
      results = await searchWeb(`${cleanQuery} site:${targetSite}.com`);
      if (!results.length) results = await searchWeb(`${cleanQuery} ${targetSite}`);
    }

    if (!results.length) {
      return res.status(404).json({ error: `No results found for "${cleanQuery}" on ${targetSite}.` });
    }

    res.json({ query: cleanQuery, site: targetSite, results });
  } catch (err) {
    console.error('find-link failed:', err.message);
    res.status(500).json({ error: `Link search failed: ${err.message}` });
  }
});

module.exports = router;
