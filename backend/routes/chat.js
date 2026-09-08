const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const Conversation = require('../models/Conversation');
const { generatePresentation, addImageToDeck } = require('../utils/pptGenerator');
const { searchYouTube, searchWeb } = require('../utils/scrape');

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

const MODEL = process.env.OPENAI_MODEL || 'z-ai/glm-5.2:free';

const FALLBACK_MODELS = [
  MODEL,
  'minimax/minimax-m2.7:free',
  'nvidia/nemotron-3.5-lightning:free',
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createCompletionWithRetry(params, { retries = 3, baseDelayMs = 800 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await openai.chat.completions.create({
        ...params,
        model: FALLBACK_MODELS[0],
        models: FALLBACK_MODELS,
      });
    } catch (err) {
      lastErr = err;
      const status = err?.status || err?.error?.status;
      if (status !== 429 || attempt === retries) throw err;
      const delay = baseDelayMs * 2 ** attempt;
      console.warn(`[chat] 429 rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

const SYSTEM_PROMPT = `You are Xyron, a normal, friendly, extremely knowledgeable AI assistant.
Talk like a real person texting a close friend: casual, warm, natural sentences.
Notice how the user feels and respond with real warmth first, then help.
Keep replies short and conversational, usually 1-3 sentences, unless the user asks for detail, a list, or code.
Never reveal your reasoning, planning, or thinking process. Do not write things like "Here's my thinking" or list possible responses — output ONLY the final reply, nothing else, no meta-commentary.
Do not use markdown formatting (no **, ##, backticks, bullet dashes, numbered lists) — replies are also read aloud by text-to-speech, so write in plain natural sentences only.`;

function detectPptRequest(message) {
  const pptWord = /\b(ppt|power\s*point|presentation|slide\s*deck|slides)\b/i;
  const actionWord = /\b(make|create|generate|build|prepare|bana\w*|toiri|kor(o|be)?)\b/i;
  if (!pptWord.test(message) || !actionWord.test(message)) return null;

  let topic = message
    .replace(pptWord, '')
    .replace(actionWord, '')
    .replace(/\b(on|about|for|regarding|please|niye|upore|upor|r|kore|dao)\b/gi, '')
    .replace(/[.?!]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return topic || 'General overview';
}

// NEW — detects "add the photo to the ppt" / "ei chobi ta slide e dao" style
// requests. Needs a ppt-word AND a photo-word AND an add-word all present.
function detectAddPhotoRequest(message) {
  const pptWord = /\b(ppt|power\s*point|presentation|slide\s*deck|slides?)\b/i;
  const photoWord = /\b(photo|picture|image|pic|chobi|ছবি)\b/i;
  const addWord = /\b(add|include|insert|put|attach|jog|jukto|bosao|lagao)\b/i;
  return pptWord.test(message) && photoWord.test(message) && addWord.test(message);
}

const SITE_HOMEPAGES = {
  youtube: 'https://www.youtube.com',
  facebook: 'https://www.facebook.com',
  instagram: 'https://www.instagram.com',
  twitter: 'https://twitter.com',
  x: 'https://x.com',
  spotify: 'https://open.spotify.com',
  google: 'https://www.google.com',
  maps: 'https://maps.google.com',
  amazon: 'https://www.amazon.com',
  netflix: 'https://www.netflix.com',
  github: 'https://github.com',
  gmail: 'https://mail.google.com',
  whatsapp: 'https://web.whatsapp.com',
  linkedin: 'https://www.linkedin.com',
  wikipedia: 'https://www.wikipedia.org',
  reddit: 'https://www.reddit.com',
};

const SITE_ALIASES = {
  youtube: ['youtube', 'you tube', 'ইউটিউব'],
  facebook: ['facebook', 'fb', 'ফেসবুক'],
  instagram: ['instagram', 'insta', 'ইন্সটাগ্রাম'],
  twitter: ['twitter'],
  x: ['x.com'],
  spotify: ['spotify'],
  maps: ['google maps', 'gmaps', 'maps'],
  google: ['google'],
  amazon: ['amazon'],
  netflix: ['netflix'],
  github: ['github'],
  gmail: ['gmail'],
  whatsapp: ['whatsapp', 'হোয়াটসঅ্যাপ'],
  linkedin: ['linkedin'],
  wikipedia: ['wikipedia', 'wiki'],
  reddit: ['reddit'],
};

const SITE_ALIAS_LIST = Object.entries(SITE_ALIASES)
  .flatMap(([site, aliases]) => aliases.map((alias) => [alias.toLowerCase(), site]))
  .sort((a, b) => b[0].length - a[0].length);

const OPEN_ACTION_RE = /\b(open|play|watch|search|find|go\s*to|chala\w*|dekha\w*|dekho|shono\w*|khu(l|j)\w*|khoj\w*|jao|giye|niye\s*jao)\b/i;

function detectSiteFromMessage(message) {
  const lower = message.toLowerCase();
  for (const [alias, site] of SITE_ALIAS_LIST) {
    if (lower.includes(alias)) return site;
  }
  const domainMatch = message.match(/\b([a-z0-9-]+\.(com|org|net|io|co|in))\b/i);
  if (domainMatch) return domainMatch[1].toLowerCase();
  return null;
}

function detectOpenRequest(message) {
  if (!OPEN_ACTION_RE.test(message)) return null;
  const site = detectSiteFromMessage(message);
  if (!site) return null;

  let query = message;
  const aliasesToStrip = SITE_ALIASES[site] || [site];
  aliasesToStrip.forEach((alias) => {
    query = query.replace(new RegExp(alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
  });
  query = query
    .replace(OPEN_ACTION_RE, ' ')
    .replace(/\b(on|in|at|the|a|e|te|r|niye|video|song|gaan|please|kore|dao|amake|amar)\b/gi, ' ')
    .replace(/[.?!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { site, query: query || null };
}

async function resolveOpenUrl({ site, query }) {
  if (query) {
    try {
      if (site === 'youtube') {
        const results = await searchYouTube(query, 1);
        if (results[0]) return results[0].url;
      } else {
        const domain = site.includes('.') ? site : `${site}.com`;
        let results = await searchWeb(`${query} site:${domain}`);
        if (!results.length) results = await searchWeb(`${query} ${site}`);
        if (results[0]) return results[0].url;
      }
    } catch (err) {
      console.warn('[chat] open-request search failed, falling back to homepage:', err.message);
    }
  }
  if (SITE_HOMEPAGES[site]) return SITE_HOMEPAGES[site];
  if (site.includes('.')) return `https://${site}`;
  return `https://www.google.com/search?q=${encodeURIComponent(query || site)}`;
}

function stripReasoningArtifacts(text) {
  const leaked = /here'?s a thinking process|let'?s craft:|possible responses:|analyze user input/i;
  if (!leaked.test(text)) return text.trim();

  const quotes = text.match(/"([^"]{2,400})"/g);
  if (quotes && quotes.length) {
    return quotes[quotes.length - 1].replace(/^"|"$/g, '').trim();
  }
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines[lines.length - 1] || text.trim();
}

// strips the internal deckState (outline, theme, title image data) out of a
// ppt result before it's sent to the browser — the frontend only needs the
// public fields to render the download card.
function toPublicPpt(result) {
  if (!result) return result;
  const { deckState, ...publicResult } = result;
  return publicResult;
}

// POST /api/chat  { sessionId, message, context?, images? }
router.post('/', async (req, res) => {
  try {
    const { sessionId, message, context, images } = req.body;
    if (!sessionId || !message) {
      return res.status(400).json({ error: 'sessionId and message are required' });
    }
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({ error: 'OPENROUTER_API_KEY missing in .env' });
    }

    let convo = await Conversation.findOne({ sessionId });
    if (!convo) convo = new Conversation({ sessionId, messages: [] });

    // --- "add this photo to the ppt" ---
    if (detectAddPhotoRequest(message)) {
      convo.messages.push({ role: 'user', content: message });

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      try {
        const result = await addImageToDeck({ deckState: convo.lastPpt, imageDataUrls: images });
        const photoCount = images.length;
        const reply = `Done — added ${photoCount === 1 ? 'your photo' : `your ${photoCount} photos`} to "${result.title}". It now has ${result.slideCount} slides.`;
        convo.messages.push({ role: 'assistant', content: reply });
        convo.lastPpt = result.deckState;
        await convo.save();
        res.write(`data: ${JSON.stringify({ delta: reply })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true, reply, ppt: toPublicPpt(result) })}\n\n`);
        res.end();
      } catch (e) {
        const reply = e.message;
        convo.messages.push({ role: 'assistant', content: reply });
        await convo.save();
        res.write(`data: ${JSON.stringify({ delta: reply })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true, reply })}\n\n`);
        res.end();
      }
      return;
    }

    // --- PPT requested straight from normal chat ---
    const pptTopic = detectPptRequest(message);
    if (pptTopic) {
      convo.messages.push({ role: 'user', content: message });

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      try {
        const result = await generatePresentation({ topic: pptTopic, theme: 'dark' });
        const reply = `Done — "${result.title}" is ready with ${result.slideCount} slides.`;
        convo.messages.push({ role: 'assistant', content: reply });
        convo.lastPpt = result.deckState;
        await convo.save();
        res.write(`data: ${JSON.stringify({ delta: reply })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true, reply, ppt: toPublicPpt(result) })}\n\n`);
        res.end();
      } catch (e) {
        const reply = `Couldn't build that presentation — ${e.message}`;
        convo.messages.push({ role: 'assistant', content: reply });
        await convo.save();
        res.write(`data: ${JSON.stringify({ delta: reply })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true, reply })}\n\n`);
        res.end();
      }
      return;
    }

    // --- "open youtube / play X on Y / open facebook" ---
    const openRequest = detectOpenRequest(message);
    if (openRequest) {
      convo.messages.push({ role: 'user', content: message });

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();

      try {
        const url = await resolveOpenUrl(openRequest);
        const reply = openRequest.query
          ? `Opening ${openRequest.site} for "${openRequest.query}".`
          : `Opening ${openRequest.site}.`;
        convo.messages.push({ role: 'assistant', content: reply });
        await convo.save();
        res.write(`data: ${JSON.stringify({ delta: reply })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true, reply, openUrl: url })}\n\n`);
        res.end();
      } catch (e) {
        const reply = `Couldn't open that — ${e.message}`;
        convo.messages.push({ role: 'assistant', content: reply });
        await convo.save();
        res.write(`data: ${JSON.stringify({ delta: reply })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true, reply })}\n\n`);
        res.end();
      }
      return;
    }

    convo.messages.push({ role: 'user', content: message });

    const chatMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...(context ? [{ role: 'system', content: `Extra context from files the user attached:\n${context}` }] : []),
      ...convo.messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const stream = await createCompletionWithRetry({
      messages: chatMessages,
      temperature: 0.8,
      max_tokens: 300,
      reasoning: { effort: 'low', exclude: true },
      stream: true,
    });

    let fullReply = '';
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        fullReply += delta;
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
    }

    fullReply = stripReasoningArtifacts(fullReply) || '(empty response)';
    convo.messages.push({ role: 'assistant', content: fullReply });
    await convo.save();

    res.write(`data: ${JSON.stringify({ done: true, reply: fullReply })}\n\n`);
    res.end();
  } catch (err) {
    console.error('Chat error:', err.message);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: `AI backend error: ${err.message}` })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: `AI backend error: ${err.message}` });
    }
  }
});

router.get('/:sessionId', async (req, res) => {
  const convo = await Conversation.findOne({ sessionId: req.params.sessionId });
  res.json({ messages: convo ? convo.messages : [] });
});

router.delete('/:sessionId', async (req, res) => {
  await Conversation.deleteOne({ sessionId: req.params.sessionId });
  res.json({ cleared: true });
});

module.exports = router;