# XYRON — MERN Backend

## Setup
1. `npm install`
2. Fill in `.env` with your real keys (OPENROUTER_API_KEY, GEMINI_API_KEY, MONGO_URI)
3. Make sure MongoDB is running (local install or MongoDB Atlas)
4. `npm start` (or `npm run dev` for auto-restart with nodemon)

Server runs at `http://localhost:5000` by default.

## Folder structure
```
backend/
  models/
    Conversation.js      # Mongoose schema for chat history
  routes/
    chat.js               # POST/GET/DELETE /api/chat  (session-based, saved to MongoDB)
    const express = require('express');
const router = express.Router();
const { generatePresentation } = require('../utils/pptGenerator');

router.post('/', async (req, res) => {
  try {
    const { topic, theme } = req.body;
    const result = await generatePresentation({ topic, theme });
    res.json(result);
  } catch (err) {
    console.error('PPT generation failed:', err);
    res.status(500).json({ error: `Something went wrong generating the presentation: ${err.message}` });
  }
});

module.exports = router;                 # POST /api/create-ppt
    image.js               # POST /api/generate-image
    upload.js               # POST /api/upload-context
    search.js               # POST /api/find-link
    security.js             # GET  /api/security/scan
  utils/
    scrape.js               # YouTube / web search helpers
    fileExtract.js           # pdf/docx/pptx/plain-text extraction
    gemini.js                 # Gemini image generation helper
  server.js                    # app entrypoint
  .env                          # your secrets (never commit this)
  .env.example                   # template for .env
  package.json
```

## API endpoints
- `POST /api/chat` — body `{ sessionId, message }` → `{ reply }`. History is saved in MongoDB per `sessionId`.
- `GET /api/chat/:sessionId` — load saved history for a session.
- `DELETE /api/chat/:sessionId` — clear a session's history.
- `POST /api/create-ppt` — body `{ topic, theme }` → generates a .pptx, returns `{ downloadUrl, ... }`.
- `POST /api/generate-image` — body `{ query }` → `{ imageDataUrl }`.
- `POST /api/upload-context` — multipart form, field `files` → `{ contextText }`.
- `POST /api/find-link` — body `{ query, site }` → `{ results: [...] }`.
- `GET /api/security/scan` — local port/network scan report.
