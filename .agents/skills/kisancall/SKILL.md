---
name: kisancall
description: KisanCall — Farmer Expert Instant Calling Platform. Full-stack web app using FastAPI backend, React frontend, SmallWebRTC for browser-to-browser P2P voice calls, Deepgram for STT, Groq LLM for post-call AI summary, MongoDB for data, and Gmail SMTP for email verification. Use this skill whenever working on this project.
---

# KisanCall — Project Skill

## Project Overview

**KisanCall** is a web-based Farmer Expert Tele-Consultation Platform built for Indian farmers.
- Farmers register and call real human agriculture experts via browser-to-browser WebRTC voice calls
- After each call, an AI (Deepgram STT + Groq LLM) generates a written consultation summary in Hindi or English
- Experts have a dedicated dashboard to manage availability, accept/reject calls, and add follow-up notes

---

## Project Root

```
e:\Projects\practice1\
├── backend\        ← FastAPI Python backend
└── frontend\       ← React + Vite frontend (to be created)
```

---

## Tech Stack

| Layer | Technology | Details |
|---|---|---|
| Backend | FastAPI | Python, async, existing at `e:\Projects\practice1\backend` |
| Database | MongoDB | Async via Motor driver |
| WebRTC Transport | SmallWebRTCTransport (aiortc) | Self-hosted, no Daily.co |
| STT | Deepgram | Post-call audio transcription only |
| LLM | Groq (llama-3.1) | Post-call summary generation only |
| TTS | Not used | Real human voices in call |
| Auth | JWT + Email verification | Gmail SMTP via aiosmtplib |
| Frontend | React + Vite | `@pipecat-ai/client-react` + `@pipecat-ai/small-webrtc-transport` |

---

## Environment Variables (.env location: `e:\Projects\practice1\backend\.env`)

```env
MONGO_URI=mongodb://localhost:27017/kisancall
GROQ_API_KEY=...
DEEPGRAM_API_KEY=...
JWT_SECRET=...
JWT_EXPIRE_HOURS=24
EMAIL_FROM=...@gmail.com
EMAIL_PASSWORD=...           # Gmail App Password (16 chars, no spaces)
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
```

---

## Backend Folder Structure

```
backend/
├── main.py                        ← uvicorn entry point
├── .env                           ← all secrets
├── requirements.txt               ← all dependencies
└── core/
    ├── database.py                ← Motor MongoDB async connection
    ├── apis/
    │   ├── api.py                 ← FastAPI app, register all routers
    │   ├── auth.py                ← /auth/signup, /auth/login, /auth/verify-email, /auth/me
    │   ├── farmer.py              ← /farmer/dashboard, /farmer/calls
    │   ├── expert.py              ← /expert/dashboard, /expert/calls, /expert/followup
    │   └── call.py                ← /call/request, /call/accept, /call/reject, /call/end, /api/offer, /api/answer, /api/ice-candidate, WS /ws/farmer, WS /ws/expert
    ├── models/
    │   ├── user.py                ← User Pydantic model + MongoDB schema
    │   └── call.py                ← Call Pydantic model + MongoDB schema
    └── services/
        ├── auth_service.py        ← bcrypt hashing, JWT create/verify, token generation
        ├── email_service.py       ← aiosmtplib Gmail SMTP, send_verification_email()
        ├── websocket_manager.py   ← ConnectionManager class for WS connections
        ├── matchmaking.py         ← find_available_expert(), assign_expert()
        ├── recording.py           ← save call audio post-call
        ├── transcription.py       ← Deepgram STT on recorded audio
        └── ai_summary.py          ← Groq LLM generate_summary(transcript, language)
```

---

## Frontend Folder Structure

```
frontend/
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx
    ├── App.jsx                    ← React Router setup
    ├── pages/
    │   ├── Landing.jsx            ← Public home page
    │   ├── Signup.jsx             ← name, email, password, role
    │   ├── Login.jsx              ← email, password
    │   ├── VerifyEmail.jsx        ← "Check your inbox" screen
    │   ├── FarmerDashboard.jsx    ← category selector + Call button
    │   ├── CallScreen.jsx         ← Farmer live call (Pipecat SDK)
    │   ├── CallSummary.jsx        ← Post-call AI summary display
    │   ├── ExpertDashboard.jsx    ← Online toggle + incoming calls
    │   ├── ExpertCallScreen.jsx   ← Expert live call
    │   └── ExpertCallHistory.jsx  ← All past calls + transcripts
    └── components/
        ├── Navbar.jsx
        ├── ProtectedRoute.jsx     ← JWT guard (farmer/expert roles)
        ├── CategorySelector.jsx   ← Crop problem grid
        ├── SummaryCard.jsx        ← AI summary display card
        ├── CallStatusBadge.jsx    ← pending/active/ended
        └── LanguageToggle.jsx     ← Hindi / English switch
```

---

## Key User Roles

### Farmer
- Sign up → verify email → login
- Select crop topic → click "Call Expert"
- Wait for expert to accept → live P2P call
- See AI summary after call
- View past call history

### Expert
- Sign up (role=expert) → verify email → login
- Toggle Online/Offline availability
- See incoming call notification (WebSocket)
- Accept/Reject call
- Live P2P call with farmer
- Add follow-up note after call
- View all past consultations

---

## WebRTC Call Flow (P2P, No AI in Call)

1. Farmer POSTs `/call/request` with topic
2. Backend finds online expert via `matchmaking.py`
3. Expert gets WebSocket notification (incoming call)
4. Expert POSTs `/call/accept/{call_id}`
5. Backend creates WebRTC room and notifies both parties
6. Both farmer and expert connect via `/api/offer` + `/api/answer` + ICE candidates
7. SmallWebRTCTransport (aiortc) handles browser-to-browser P2P audio
8. Call ends → `/call/end/{call_id}` → audio recording saved
9. Deepgram STT transcribes audio
10. Groq LLM generates summary
11. Summary saved to MongoDB → farmer and expert can view

---

## FastAPI Coding Conventions

- All routes use **async def**
- All DB calls use **Motor** (async MongoDB), never pymongo blocking
- Use **Pydantic v2** models for request/response schemas
- Use `Annotated[..., Depends(...)]` for dependency injection
- JWT auth via `get_current_user` dependency
- Role checking via `require_farmer` and `require_expert` dependencies
- All routes return consistent `{"status": "success"|"error", "data": ..., "message": ...}` format
- Use `HTTPException` for all error responses with proper status codes
- Environment variables loaded via `python-dotenv` at startup

---

## Frontend Coding Conventions

- React functional components + hooks only
- No class components
- Axios for all API calls with JWT interceptor
- React Router v6 for navigation
- Dark-themed green + gold color palette (rural India feel)
- All API calls go to `http://localhost:8000` in development
- Pipecat connection: `SmallWebRTCTransport` with `webrtcUrl: "/api/offer"`
- WebSocket connections for real-time notifications

---

## Design Theme

- **Color Palette**: Deep forest green (#0a2e1a), bright green accent (#22c55e), warm gold (#f59e0b), white text
- **Typography**: Google Font — "Plus Jakarta Sans" (modern, readable)
- **Style**: Glassmorphism cards, gradient buttons, smooth micro-animations
- **Feel**: Premium, trustworthy, agriculture-inspired but modern tech
- **Priority**: Mobile-first (farmers use phones)

---

## Python Dependencies

```txt
fastapi
uvicorn[standard]
python-dotenv
motor
pymongo
python-jose[cryptography]
passlib[bcrypt]
python-multipart
pipecat-ai[webrtc]
pipecat-ai[deepgram]
pipecat-ai[groq]
aiosmtplib
httpx
aiohttp
email-validator
```

## Frontend NPM Dependencies

```json
"react": "^18",
"react-dom": "^18",
"react-router-dom": "^6",
"axios": "^1",
"@pipecat-ai/client-js": "latest",
"@pipecat-ai/client-react": "latest",
"@pipecat-ai/small-webrtc-transport": "latest"
```

---

## Build Order

1. Phase 1: Backend Foundation (DB + models + core services)
2. Phase 2: Auth System (signup + email verify + login + JWT)
3. Phase 3: WebRTC Calling (WebSocket + matchmaking + signaling)
4. Phase 4: AI Post-Call (recording + transcription + summary)
5. Phase 5: Frontend (all pages + Pipecat integration)
6. Phase 6: Polish (mobile, Hindi/English, demo)
