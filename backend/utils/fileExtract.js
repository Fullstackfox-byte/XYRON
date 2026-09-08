const path = require('path');
const JSZip = require('jszip');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const { describeImage } = require('./gemini');

const PLAIN_TEXT_EXTS = [
  '.txt', '.md', '.js', '.ts', '.jsx', '.tsx', '.py', '.json',
  '.csv', '.html', '.css', '.java', '.c', '.cpp', '.env',
  '.yml', '.yaml', '.xml', '.log', '.sh',
];

function decodeXmlEntities(str) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function extractTextRuns(xml) {
  const TEXT_TAG_RE = /<a:t>([\s\S]*?)<\/a:t>/g;
  const runs = [];
  let match;
  while ((match = TEXT_TAG_RE.exec(xml)) !== null) {
    const t = decodeXmlEntities(match[1]).trim();
    if (t) runs.push(t);
  }
  return runs;
}

async function extractTextFromPptx(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/)[1], 10);
      const numB = parseInt(b.match(/slide(\d+)\.xml/)[1], 10);
      return numA - numB;
    });

  if (!slideFiles.length) {
    return '[This .pptx has no readable slide XML — it may be corrupted or empty]';
  }

  let out = '';
  for (let i = 0; i < slideFiles.length; i++) {
    const slideNum = i + 1;
    const xml = await zip.files[slideFiles[i]].async('string');
    const slideTexts = extractTextRuns(xml);
    out += `\n--- Slide ${slideNum} ---\n${slideTexts.join('\n') || '(no text on this slide)'}\n`;

    const notesEntry = zip.files[`ppt/notesSlides/notesSlide${slideNum}.xml`];
    if (notesEntry) {
      const notesXml = await notesEntry.async('string');
      const notesTexts = extractTextRuns(notesXml);
      if (notesTexts.length) out += `[Speaker notes]: ${notesTexts.join(' ')}\n`;
    }
  }
  return out.trim();
}

async function extractTextFromFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  try {
    // NEW — images now go through Gemini Vision instead of being rejected
    // as an "unsupported file type".
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      return await describeImage(file.buffer, file.mimetype);
    }
    if (PLAIN_TEXT_EXTS.includes(ext)) return file.buffer.toString('utf-8');
    if (ext === '.pdf') return (await pdfParse(file.buffer)).text;
    if (ext === '.docx') return (await mammoth.extractRawText({ buffer: file.buffer })).value;
    if (ext === '.pptx' || ext === '.potx') return await extractTextFromPptx(file.buffer);
    return `[Cannot extract readable text from "${file.originalname}" — unsupported file type "${ext || '(no extension)'}".]`;
  } catch (err) {
    return `[Could not read ${file.originalname}: ${err.message}]`;
  }
}

module.exports = { extractTextFromFile };