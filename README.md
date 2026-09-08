# ⚡ XYRON

<p>
  <img src="https://img.shields.io/badge/status-in--development-orange" />
  <img src="https://img.shields.io/badge/license-MIT-blue" />
  <img src="https://img.shields.io/badge/node-Express-green" />
  <img src="https://img.shields.io/badge/frontend-Web%20Speech%20API-purple" />
</p>

> Listens. Analyzes. Protects. Responds. — in real time.

---

## Overview

**Xyron** is a next-generation AI voice security assistant — a spiritual successor to the VOX codebase. It combines intelligent automation, real-time security awareness, and a distinct futuristic personality into a single voice-driven command system.

Instead of being just another chatbot, Xyron is designed to actively **monitor, detect, and respond** — understanding whether a spoken command is casual conversation, a security-related action, or an automation task, and reacting accordingly.

---

## Features

| Category | Feature | Status |
|---|---|---|
| Core | Voice command intent detection | ✅ Done |
| Core | Real-time security scan | ✅ Done |
| Security | Access-key auth on `/api/*` routes | ✅ Done |
| Security | Rate limiting | ✅ Done |
| Security | CORS lockdown | ✅ Done |
| Security | Helmet security headers | ✅ Done |
| Monitoring | Passive/background security monitoring | 🔲 Planned |
| Monitoring | Voice + visual alert system | 🔲 Planned |
| Automation | Multi-step task execution | 🔲 Planned |
| Media | Pexels API integration (dynamic visuals) | 🔲 Planned |

---

## Tech Stack

**Backend:** Node.js, Express, OpenAI API
**Frontend:** Web Speech API (Browser-native), Vanilla JS
**Security:** Helmet, custom access-key middleware, rate limiter
**Planned Integrations:** Pexels API

---

## Quick Start

**1. Clone the repo**

```bash
git clone https://github.com/<your-username>/xyron.git
cd xyron
```

**2. Start the backend**

```bash
cd server
npm install
npm run dev          # runs on http://localhost:5000
```

**3. Start the frontend**

```bash
cd client
npm install
npm run dev           # opens the voice assistant UI
```

> ⚠️ The backend must be running before using the frontend — intent detection and security scanning both depend on it.

---

## Environment Setup

Create a `.env` file inside `/server` based on `.env.example`:

```env
OPENAI_API_KEY=your_openai_key_here
ACCESS_KEY=your_custom_access_key_here
PORT=5000
```

The `ACCESS_KEY` protects all `/api/*` routes — requests without a valid key are rejected before reaching any route logic.

---

## Project Structure

```
xyron/
├── server/              # Express backend, AI + security logic
│   ├── routes/
│   ├── middleware/
│   └── server.js
├── client/               # Web Speech frontend
│   ├── index.html
│   ├── app.js
│   └── style.css
└── README.md
```

---

## Roadmap

**Phase 1 — Foundation (Done)**
- Voice intent detection
- Real-time security scan
- Access-key auth, rate limiting, CORS, Helmet headers

**Phase 2 — Monitoring**
- Passive/background security monitoring
- Real-time alert system (voice + visual)

**Phase 3 — Automation**
- Multi-step voice-triggered task execution
- Pexels API integration for dynamic media

**Phase 4 — Release**
- Deployment (Render/Railway)
- Public demo + documentation

---

## Contributing

Currently a solo project under active development. Suggestions and feedback are welcome via issues.

---

## License

Licensed under the **MIT License**.
