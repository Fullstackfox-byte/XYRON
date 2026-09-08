const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');
const PptxGenJS = require('pptxgenjs');
const { generateAIImage } = require('./gemini');

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
      console.warn(`[pptGenerator] 429 rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
      await sleep(delay);
    }
  }
  throw lastErr;
}

const GENERATED_DIR = path.join(__dirname, '..', 'generated');
if (!fs.existsSync(GENERATED_DIR)) fs.mkdirSync(GENERATED_DIR);

const THEMES = {
  dark:  { bg: '0B0F14', accent: 'FF4D6A', accent2: '4DD0FF', heading: 'FFFFFF', body: 'E5E7EB' },
  ocean: { bg: '07263B', accent: '2FD4C6', accent2: '4DA8FF', heading: 'FFFFFF', body: 'D8ECF7' },
  sunset:{ bg: '2B1730', accent: 'FF8A5B', accent2: 'FFD166', heading: 'FFFFFF', body: 'F3E1E1' },
  forest:{ bg: '10241A', accent: '6FCF97', accent2: 'C6F6D5', heading: 'FFFFFF', body: 'DFF5E7' },
};

const PPT_SYSTEM_PROMPT = `You are an elite presentation writer, the same caliber as Claude or ChatGPT when asked to build a slide deck. Output ONLY valid JSON (no markdown, no code fences, no commentary before or after):
{"title":"Presentation Title","slides":[{"heading":"Slide heading","points":[{"main":"Main point as a complete, substantive sentence","subs":["Specific supporting detail","Another specific supporting detail"]}]}]}

Rules — follow ALL of them:
- Create 6 to 9 content slides that build a logical narrative arc (context -> problem/topic -> details -> examples or data -> implications -> conclusion), not a random grab-bag of facts.
- Each slide must have EXACTLY 3 to 4 main points. Never fewer than 3.
- EVERY main point must have 2 to 3 subpoints. Subpoints are NOT optional — a main point with an empty "subs" array is considered broken output.
- "points" MUST be an array of OBJECTS, never plain strings — each object needs "main" (string) and "subs" (array of strings).
- Main points must be complete, information-dense sentences (roughly 12-25 words) that make a specific claim — never a bare label like "Benefits" and never a vague sentence like "This is important."
- Subpoints must add concrete, specific detail: a number, an example, a mechanism, a comparison, or a consequence — never a restatement of the main point in fewer words.
- Slide headings must be specific and descriptive (5-8 words), not single words.
- Vary sentence structure and vocabulary across slides so the deck doesn't feel templated or repetitive.
- Do not pad with generic filler ("there are many factors", "this is very important") — every sentence must carry real information.

Example of one correctly structured slide:
{"heading":"Why Solar and Wind Are Outpacing Every Other Source","points":[{"main":"Solar and wind capacity additions have grown faster than any other energy source over the last decade.","subs":["Global solar capacity grew roughly tenfold between 2014 and 2024","Costs per watt fell over 80% in the same period, driven by manufacturing scale"]},{"main":"Falling costs have made renewables cheaper than new fossil fuel plants in most markets.","subs":["Utility-scale solar now undercuts new coal and gas in over two-thirds of countries","Battery storage costs are following a similar downward curve, easing intermittency concerns"]},{"main":"Grid integration, not generation cost, is now the primary bottleneck to faster adoption.","subs":["Many regions lack transmission capacity to move renewable power from generation to demand centers","Permitting delays for new transmission lines can add years to project timelines"]}]}`;

function normalizeSubs(subsRaw) {
  if (Array.isArray(subsRaw)) {
    return subsRaw
      .map((s) => (typeof s === 'string' ? s : (s?.text || s?.main || '')).toString().trim())
      .filter(Boolean);
  }
  if (typeof subsRaw === 'string') {
    return subsRaw.split(/\n+|;\s*/).map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function normalizePoint(pt) {
  if (typeof pt === 'string') {
    return { main: pt.trim(), subs: [] };
  }
  if (pt && typeof pt === 'object') {
    let main = (pt.main || pt.text || pt.point || pt.content || pt.bullet || pt.heading || '')
      .toString()
      .trim();
    let subs = normalizeSubs(pt.subs || pt.subpoints || pt.sub_points || pt.details || pt.bullets);
    if (!main && subs.length) {
      main = subs.shift();
    }
    return { main, subs };
  }
  return { main: '', subs: [] };
}

function normalizeSlide(slide) {
  const heading = (slide.heading || slide.title || slide.name || '').toString().trim();
  const rawPoints = Array.isArray(slide.points)
    ? slide.points
    : Array.isArray(slide.content)
      ? slide.content
      : Array.isArray(slide.bullets)
        ? slide.bullets
        : Array.isArray(slide.body)
          ? slide.body
          : [];

  const points = rawPoints
    .map(normalizePoint)
    .filter((p) => p.main);

  return { heading, points };
}

function normalizeOutline(parsed) {
  if (!parsed || !Array.isArray(parsed.slides)) return null;
  const slides = parsed.slides.map(normalizeSlide).filter((s) => s.heading || s.points.length);
  return { title: (parsed.title || '').toString().trim(), slides };
}

// --- Shared deck-building logic --------------------------------------------
// Used by both generatePresentation() (brand new deck) and addImageToDeck()
// (existing deck + one or more user-attached photos appended as new slides),
// so both paths always produce visually identical decks.
async function buildDeck({ topic, outline, theme, themeName, titleImage, extraImages = [] }) {
  const slides = outline.slides || [];
  const totalContentSlides = slides.length + extraImages.length;

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'XYRON_LAYOUT', width: 10, height: 5.63 });
  pptx.layout = 'XYRON_LAYOUT';

  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: theme.bg };

  if (titleImage) {
    titleSlide.addImage({ data: titleImage, x: 0, y: 0, w: 10, h: 5.63, sizing: { type: 'cover', w: 10, h: 5.63 } });
    titleSlide.addShape('rect', { x: 0, y: 0, w: 10, h: 5.63, fill: { color: '000000', transparency: 55 } });
    titleSlide.addText(outline.title || topic, {
      x: 0.6, y: 2.05, w: 8.8, h: 1.6, fontSize: 38, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', isTextBox: true,
    });
  } else {
    titleSlide.addShape('ellipse', { x: -1.2, y: -1.2, w: 4, h: 4, fill: { color: theme.accent, transparency: 85 }, line: { type: 'none' } });
    titleSlide.addShape('ellipse', { x: 8, y: 3.8, w: 3.5, h: 3.5, fill: { color: theme.accent2, transparency: 88 }, line: { type: 'none' } });
    titleSlide.addText(outline.title || topic, {
      x: 0.5, y: 1.95, w: 9, h: 1.6, fontSize: 36, bold: true, color: theme.heading, align: 'center', valign: 'middle', isTextBox: true,
    });
  }
  titleSlide.addText('AUTO-GENERATED DECK  ·  XYRON AI', {
    x: 0.6, y: 3.55, w: 8.8, h: 0.4, fontSize: 11, color: titleImage ? 'FFFFFF' : theme.accent2, align: 'center', charSpacing: 2, isTextBox: true,
  });

  slides.forEach((slide, idx) => {
    const s = pptx.addSlide();
    s.background = { color: theme.bg };
    s.addShape('ellipse', { x: 8.3, y: -0.7, w: 2.6, h: 2.6, fill: { color: theme.accent, transparency: 88 }, line: { type: 'none' } });
    s.addText(slide.heading || '', {
      x: 0.55, y: 0.3, w: 9, h: 0.65, fontSize: 24, bold: true, color: theme.accent2, isTextBox: true,
    });

    const points = slide.points || [];
    const bulletItems = [];

    if (points.length === 0) {
      bulletItems.push({
        text: 'Details unavailable — the outline generator did not return content for this slide.',
        options: { bullet: { code: '25B8', color: theme.accent }, italic: true, color: theme.body, fontSize: 14 },
      });
    }

    points.forEach((pt, i) => {
      const mainColor = i % 2 === 0 ? theme.accent : theme.accent2;
      bulletItems.push({
        text: pt.main || '',
        options: {
          bullet: { code: '25B8', color: mainColor },
          breakLine: true, bold: true, indentLevel: 0, color: theme.heading, fontSize: 16,
          paraSpaceAfter: (pt.subs && pt.subs.length) ? 4 : 12,
        },
      });
      (pt.subs || []).forEach((sub, subIdx, arr) => {
        bulletItems.push({
          text: sub,
          options: {
            bullet: { code: '2013' },
            breakLine: true, bold: false, indentLevel: 1, color: theme.body, fontSize: 13,
            paraSpaceAfter: subIdx === arr.length - 1 ? 12 : 5,
          },
        });
      });
    });

    s.addText(bulletItems, { x: 0.7, y: 1.15, w: 8.6, h: 4.15, valign: 'top', isTextBox: true, margin: 0 });
    s.addText(`${idx + 1} / ${totalContentSlides}`, {
      x: 8.6, y: 5.25, w: 1.2, h: 0.3, fontSize: 10, color: theme.body, align: 'right', isTextBox: true,
    });
  });

  // NEW — each user-attached photo the person asked to "add to the ppt"
  // becomes its own slide, appended after the generated content slides.
  extraImages.forEach((img, i) => {
    const s = pptx.addSlide();
    s.background = { color: theme.bg };
    s.addImage({ data: img.dataUrl, x: 0.7, y: 0.5, w: 8.6, h: 4.2, sizing: { type: 'contain', w: 8.6, h: 4.2 } });
    s.addText(img.caption || 'Attached photo', {
      x: 0.7, y: 4.85, w: 8.6, h: 0.4, fontSize: 12, color: theme.body, align: 'center', isTextBox: true,
    });
    s.addText(`${slides.length + i + 1} / ${totalContentSlides}`, {
      x: 8.6, y: 5.25, w: 1.2, h: 0.3, fontSize: 10, color: theme.body, align: 'right', isTextBox: true,
    });
  });

  const fileName = `presentation-${Date.now()}.pptx`;
  const filePath = path.join(GENERATED_DIR, fileName);
  await pptx.writeFile({ fileName: filePath });

  return {
    downloadUrl: `/generated/${fileName}`,
    title: outline.title || topic,
    slideCount: totalContentSlides + 1,
    theme: themeName,
    usedImage: !!titleImage,
  };
}

async function generatePresentation({ topic, theme: requestedTheme }) {
  if (!topic || typeof topic !== 'string') {
    throw new Error('topic is required');
  }
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY missing in .env');
  }

  const titleImagePromise = generateAIImage(topic);

  const MAX_ATTEMPTS = 4;
  let outline = null;
  let lastFailureReason = 'unknown error';

  for (let attempt = 1; attempt <= MAX_ATTEMPTS && !outline; attempt++) {
    try {
      const completion = await createCompletionWithRetry({
        messages: [
          { role: 'system', content: PPT_SYSTEM_PROMPT },
          { role: 'user', content: `Topic: ${topic}` },
        ],
        temperature: 0.6,
        max_tokens: 5000,
        reasoning: { effort: 'low', exclude: true },
      });

      const raw = completion.choices[0]?.message?.content ?? '{}';
      const withoutFences = raw.replace(/```json|```/g, '').trim();

      const firstBrace = withoutFences.indexOf('{');
      const lastBrace = withoutFences.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
        lastFailureReason = `Model response had no JSON object. Raw: ${withoutFences.slice(0, 200)}`;
        console.error(`[pptGenerator] Attempt ${attempt}: ${lastFailureReason}`);
        continue;
      }
      const cleaned = withoutFences.slice(firstBrace, lastBrace + 1);

      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        lastFailureReason = `Extracted text was not valid JSON: ${parseErr.message}`;
        console.error(`[pptGenerator] Attempt ${attempt}: ${lastFailureReason} Raw: ${cleaned.slice(0, 300)}`);
        continue;
      }

      const normalized = normalizeOutline(parsed);
      if (!normalized || normalized.slides.length === 0) {
        lastFailureReason = 'Model returned 0 usable slides.';
        console.error(`[pptGenerator] Attempt ${attempt}: ${lastFailureReason} Raw: ${cleaned.slice(0, 400)}`);
        continue;
      }

      const slidesWithContent = normalized.slides.filter((s) => s.points.length > 0).length;
      if (slidesWithContent < Math.ceil(normalized.slides.length * 0.6)) {
        lastFailureReason = `Only ${slidesWithContent}/${normalized.slides.length} slides had usable bullet text.`;
        console.error(`[pptGenerator] Attempt ${attempt}: ${lastFailureReason} Raw: ${cleaned.slice(0, 400)}`);
        continue;
      }

      const totalPoints = normalized.slides.reduce((sum, s) => sum + s.points.length, 0);
      const pointsWithSubs = normalized.slides.reduce(
        (sum, s) => sum + s.points.filter((p) => p.subs && p.subs.length > 0).length,
        0,
      );
      if (totalPoints > 0 && pointsWithSubs / totalPoints < 0.6) {
        lastFailureReason = `Only ${pointsWithSubs}/${totalPoints} points had subpoints — content too shallow.`;
        console.error(`[pptGenerator] Attempt ${attempt}: ${lastFailureReason} Raw: ${cleaned.slice(0, 400)}`);
        continue;
      }

      outline = normalized;
    } catch (attemptErr) {
      lastFailureReason = `Model call failed: ${attemptErr?.error?.message || attemptErr.message}`;
      console.error(`[pptGenerator] Attempt ${attempt}: ${lastFailureReason}`);
    }
  }

  if (!outline) {
    throw new Error(`Couldn't generate a usable slide outline after ${MAX_ATTEMPTS} attempts. Last reason: ${lastFailureReason}`);
  }

  const theme = THEMES[requestedTheme?.toLowerCase()] || THEMES.dark;
  const themeName = THEMES[requestedTheme?.toLowerCase()] ? requestedTheme.toLowerCase() : 'dark';

  const titleImage = await titleImagePromise;

  const built = await buildDeck({ topic, outline, theme, themeName, titleImage, extraImages: [] });

  return {
    ...built,
    // Internal — not shown to the user, but saved server-side so a later
    // "add this photo to the ppt" message can rebuild the exact same deck
    // plus the new photo, without calling the AI model again.
    deckState: { topic, outline, themeName, titleImage, extraImages: [] },
  };
}

// NEW — rebuilds a previously generated deck with one or more extra photos
// appended as new slides. `deckState` is whatever generatePresentation()
// (or a prior addImageToDeck() call) returned as `.deckState`.
async function addImageToDeck({ deckState, imageDataUrls }) {
  if (!deckState || !deckState.outline) {
    throw new Error("I haven't built a presentation in this chat yet — ask me to make one first, then I can add photos to it.");
  }
  if (!imageDataUrls || !imageDataUrls.length) {
    throw new Error('No photo came through with this message — attach the image first, then ask me to add it to the ppt.');
  }

  const theme = THEMES[deckState.themeName] || THEMES.dark;
  const newExtraImages = [
    ...(deckState.extraImages || []),
    ...imageDataUrls.map((dataUrl) => ({ dataUrl })),
  ];

  const built = await buildDeck({
    topic: deckState.topic,
    outline: deckState.outline,
    theme,
    themeName: deckState.themeName,
    titleImage: deckState.titleImage,
    extraImages: newExtraImages,
  });

  return {
    ...built,
    deckState: { ...deckState, extraImages: newExtraImages },
  };
}

module.exports = { generatePresentation, addImageToDeck };