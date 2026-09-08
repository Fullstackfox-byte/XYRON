const fetchFn = typeof fetch === 'function' ? fetch : require('node-fetch');

const SCRAPE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function searchYouTube(query, limit = 3) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const res = await fetchFn(url, { headers: SCRAPE_HEADERS });
  if (!res.ok) throw new Error(`YouTube returned ${res.status}`);
  const html = await res.text();

  const marker = 'var ytInitialData = ';
  const start = html.indexOf(marker);
  if (start === -1) throw new Error('Could not read YouTube search results (page format may have changed)');
  const jsonStart = start + marker.length;
  const jsonEnd = html.indexOf(';</script>', jsonStart);

  let data;
  try {
    data = JSON.parse(html.slice(jsonStart, jsonEnd));
  } catch {
    throw new Error('Could not parse YouTube search results');
  }

  const results = [];
  (function walk(node) {
    if (results.length >= limit || !node || typeof node !== 'object') return;
    if (node.videoRenderer && node.videoRenderer.videoId) {
      const vr = node.videoRenderer;
      const title = (vr.title?.runs || []).map((r) => r.text).join('') || vr.title?.simpleText || '(untitled video)';
      results.push({ title, url: `https://www.youtube.com/watch?v=${vr.videoId}` });
      return;
    }
    for (const key of Object.keys(node)) {
      if (results.length >= limit) return;
      walk(node[key]);
    }
  })(data);

  return results.slice(0, limit);
}

async function searchWeb(query, limit = 3) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const res = await fetchFn(url, { headers: SCRAPE_HEADERS });
  if (!res.ok) throw new Error(`Search returned ${res.status}`);
  const html = await res.text();

  const results = [];
  const linkRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m;
  while ((m = linkRe.exec(html)) !== null && results.length < limit) {
    const rawUrl = m[1];
    const uddgMatch = rawUrl.match(/uddg=([^&]+)/);
    const realUrl = uddgMatch ? decodeURIComponent(uddgMatch[1]) : rawUrl;
    const title = m[2].replace(/<[^>]+>/g, '').trim();
    if (/^https?:\/\//i.test(realUrl)) results.push({ title: title || realUrl, url: realUrl });
  }
  return results;
}

module.exports = { searchYouTube, searchWeb };
