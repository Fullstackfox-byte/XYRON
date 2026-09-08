# XYRON — Frontend (React + Vite)

## Setup
1. `npm install`
2. `npm run dev`
3. Open **http://localhost:5173**

Requires the backend to be running at `http://localhost:5000` (see `backend/README.md`).
The Vite dev server proxies `/api/*` and `/generated/*` to the backend automatically —
no CORS setup needed on the frontend side.

## What's here
```
frontend/
  src/
    components/
      ChatWindow.jsx     # scrollable message list
      MessageBubble.jsx   # single message
      InputBar.jsx          # text input, mic, voice toggle, clear
      PptPanel.jsx            # topic + theme -> generate presentation
    App.jsx                    # main app: chat logic, voice recognition
    api.js                       # fetch helpers for backend routes
    styles.css                     # dark "galaxy terminal" theme
    main.jsx                         # React entrypoint
  index.html
  vite.config.js
  package.json
```

## Features
- Text + voice chat (Web Speech API — Chrome/Edge for voice input, works everywhere for spoken replies)
- Conversation history saved server-side (MongoDB) per browser session (`localStorage` session id)
- Clear conversation button
- Presentation (PPT) generator panel — topic + theme, returns a download link

## Notes
- Voice input needs Chrome or Edge (or another Chromium browser). Voice output works in all modern browsers.
- Build for production with `npm run build` — outputs to `dist/`. Serve `dist/` from any static host, or point the backend's static middleware at it.
