# 🌾 KisanCall — Farmer Expert Tele-Consultation Platform

<div align="center">

![KisanCall](https://img.shields.io/badge/KisanCall-v1.0.0-22c55e?style=for-the-badge&logo=leaf&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18+-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![MongoDB](https://img.shields.io/badge/MongoDB-6+-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![WebRTC](https://img.shields.io/badge/WebRTC-P2P-333333?style=for-the-badge&logo=webrtc&logoColor=white)

**Connect Indian farmers with real agriculture experts via instant P2P voice calls.**  
*AI-powered post-call summaries in Hindi & English.*

[Live Demo](#running-locally) · [API Docs](http://localhost:8000/docs) · [Architecture](#architecture)

</div>

---

## ✨ What is KisanCall?

KisanCall is a **browser-based tele-consultation platform** built for Indian farmers. Farmers can:

- 📞 **Call a real human agriculture expert** instantly via browser-to-browser WebRTC voice
- 🌾 **Get expert advice** on pest control, irrigation, fertilizers, crop diseases, and more
- 🤖 **Receive an AI-generated consultation summary** (Deepgram STT + Groq LLM) in Hindi or English
- 📋 **Review all past consultations** with transcripts and expert follow-up notes

Experts get a dedicated dashboard to toggle availability, accept/reject calls, and add follow-up notes.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         KisanCall Platform                          │
│                                                                     │
│  ┌──────────────┐    WebSocket    ┌──────────────────────────────┐  │
│  │   Farmer     │◄───────────────►│                              │  │
│  │  (Browser)   │                 │   FastAPI Backend            │  │
│  │              │   WebRTC SDP/   │   (Python / uvicorn)         │  │
│  │  React+Vite  │◄───ICE Relay───►│                              │  │
│  └──────────────┘                 │   • Auth (JWT + Email)       │  │
│         ▲  P2P Audio ▼            │   • WebSocket Manager        │  │
│  ┌──────────────┐                 │   • WebRTC Signaling Relay   │  │
│  │   Expert     │◄───────────────►│   • Matchmaking              │  │
│  │  (Browser)   │   WebSocket     │   • Post-Call AI Pipeline    │  │
│  └──────────────┘                 └──────────────┬───────────────┘  │
│                                                  │                  │
│                              ┌───────────────────┼────────────┐     │
│                              ▼                   ▼            ▼     │
│                          MongoDB            Deepgram         Groq   │
│                          (Motor)            (STT)            (LLM)  │
└─────────────────────────────────────────────────────────────────────┘
```

### Call Flow

1. Farmer selects crop topic → clicks **"Call Expert"**
2. Backend finds an available expert via matchmaking
3. Expert receives incoming call notification via WebSocket
4. Expert **accepts** → both parties enter the WebRTC call screen
5. Farmer's browser sends **WebRTC offer** → backend relays to expert
6. Expert answers → P2P audio call established (no server in the media path)
7. Either party ends the call → browser uploads audio recording
8. Backend runs **Deepgram STT** → transcript
9. **Groq LLM** generates structured consultation summary
10. Summary saved to MongoDB; farmer and expert notified via WebSocket

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Backend** | FastAPI + Python 3.11 | Async REST API + WebSocket server |
| **Database** | MongoDB (Motor async) | Users, calls, summaries |
| **WebRTC** | Browser native WebRTC + SmallWebRTCTransport | P2P audio calls |
| **STT** | Deepgram | Post-call audio transcription |
| **LLM** | Groq (llama-3.3-70b-versatile) | Consultation summary generation |
| **Auth** | JWT + bcrypt + Email verification | Secure user authentication |
| **Email** | Gmail SMTP via aiosmtplib | Email verification |
| **Frontend** | React 18 + Vite | Farmer & expert UIs |
| **Routing** | React Router v6 | SPA navigation |
| **Containerization** | Docker (multi-stage) | Production deployment |
| **CI/CD** | GitHub Actions | Automated test + build + publish |

---

## 📁 Project Structure

```
practice1/
├── backend/                    ← FastAPI Python backend
│   ├── main.py                 ← uvicorn entry point
│   ├── .env                    ← secrets (not committed)
│   ├── requirements.txt
│   └── core/
│       ├── apis/
│       │   ├── api.py          ← App factory, CORS, routers
│       │   ├── auth.py         ← /auth/* endpoints
│       │   ├── call.py         ← /call/*, /api/offer, /api/answer, WS endpoints
│       │   ├── farmer.py       ← /farmer/* endpoints
│       │   └── expert.py       ← /expert/* endpoints
│       ├── models/
│       │   ├── user.py         ← User Pydantic model
│       │   └── call.py         ← Call Pydantic model
│       └── services/
│           ├── auth_service.py     ← JWT, bcrypt
│           ├── email_service.py    ← Gmail SMTP
│           ├── websocket_manager.py← WS connection registry
│           ├── matchmaking.py      ← Find available expert
│           ├── recording.py        ← Save call audio to disk
│           ├── transcription.py    ← Deepgram STT
│           └── ai_summary.py       ← Groq LLM summary
│
├── frontend/                   ← React + Vite frontend
│   ├── src/
│   │   ├── App.jsx             ← Router setup
│   │   ├── AuthContext.jsx     ← JWT auth state
│   │   ├── api.js              ← Axios instance with JWT interceptor
│   │   ├── pages/
│   │   │   ├── Landing.jsx
│   │   │   ├── Login.jsx / Signup.jsx / VerifyEmail.jsx
│   │   │   ├── FarmerDashboard.jsx
│   │   │   ├── CallScreen.jsx         ← Farmer live call
│   │   │   ├── CallSummary.jsx        ← AI summary display
│   │   │   ├── ExpertDashboard.jsx
│   │   │   ├── ExpertCallScreen.jsx   ← Expert live call
│   │   │   └── ExpertCallHistory.jsx
│   │   └── components/
│   │       ├── Navbar.jsx
│   │       ├── ProtectedRoute.jsx
│   │       ├── CategorySelector.jsx   ← Crop topic grid
│   │       ├── LanguageContext.jsx    ← Hindi/English toggle
│   │       ├── ToastProvider.jsx      ← Global notifications
│   │       └── SummaryCard.jsx
│   └── vite.config.js
│
├── Dockerfile                  ← Multi-stage production build
├── .github/workflows/
│   └── publish.yml             ← CI/CD: lint → build → Docker push
└── recordings/                 ← Temporary call audio (auto-deleted after AI processing)
```

---

## ⚙️ Running Locally

### Prerequisites

- Python 3.11+
- Node.js 20+
- MongoDB running locally (`mongodb://localhost:27017`)
- A Gmail account with **App Password** enabled
- Deepgram API key (free tier works)
- Groq API key (free tier works)

### 1. Clone & Configure Backend

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac

pip install -r requirements.txt
```

Create `backend/.env`:

```env
MONGO_URI=mongodb://localhost:27017/kisancall
JWT_SECRET=your_random_secret_here_at_least_32_chars
JWT_EXPIRE_HOURS=24
GROQ_API_KEY=gsk_...
DEEPGRAM_API_KEY=...
EMAIL_FROM=yourname@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx     # Gmail App Password (16 chars)
APP_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
```

> **Gmail App Password**: Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) → Create app password for "KisanCall". 2FA must be enabled.

### 2. Start Backend

```bash
cd backend
python -m uvicorn core.apis.api:app --reload --port 8000
```

API docs available at: `http://localhost:8000/docs`

### 3. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend at: `http://localhost:5173`

---

## 🐳 Docker (Production)

### Build & Run Locally

```bash
# Build
docker build -t kisancall .

# Run (pass your .env variables)
docker run -p 8000:8000 \
  -e MONGO_URI="mongodb://host.docker.internal:27017/kisancall" \
  -e JWT_SECRET="your_secret" \
  -e GROQ_API_KEY="gsk_..." \
  -e DEEPGRAM_API_KEY="..." \
  -e EMAIL_FROM="you@gmail.com" \
  -e EMAIL_PASSWORD="xxxx xxxx xxxx xxxx" \
  -e APP_URL="http://localhost:8000" \
  -e FRONTEND_URL="http://localhost:8000" \
  kisancall
```

### Docker Compose (with MongoDB)

```yaml
version: "3.9"
services:
  mongo:
    image: mongo:6
    volumes:
      - mongo_data:/data/db
    ports:
      - "27017:27017"

  app:
    image: kisancall
    build: .
    ports:
      - "8000:8000"
    env_file: ./backend/.env
    environment:
      MONGO_URI: mongodb://mongo:27017/kisancall
    depends_on:
      - mongo

volumes:
  mongo_data:
```

---

## 🚀 CI/CD Pipeline

The `.github/workflows/publish.yml` pipeline runs on every push to `main`/`master`:

| Job | Trigger | What it does |
|---|---|---|
| 🐍 `backend-ci` | Every PR & push | Installs deps, flake8 lint, pytest (if tests exist) |
| ⚛️ `frontend-ci` | Every PR & push | `npm ci`, ESLint, production build |
| 🐳 `docker-publish` | Push to main only | Builds multi-stage Docker image, pushes to Docker Hub |

### Required GitHub Secrets

| Secret | Value |
|---|---|
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | Docker Hub access token |

---

## 🔑 API Reference

### Auth

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/signup` | Register as farmer or expert |
| `GET` | `/auth/verify-email?token=...` | Verify email address |
| `POST` | `/auth/login` | Login → returns JWT |
| `GET` | `/auth/me` | Get current user profile |

### Calls

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/call/request` | Farmer requests a call |
| `POST` | `/call/accept/{id}` | Expert accepts |
| `POST` | `/call/reject/{id}` | Expert rejects |
| `POST` | `/call/end/{id}` | End the call |
| `POST` | `/call/recording/{id}` | Upload audio for AI processing |
| `GET` | `/call/status/{id}` | Poll call status |

### WebRTC Signaling

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/offer` | Farmer sends WebRTC offer SDP |
| `POST` | `/api/answer` | Expert sends WebRTC answer SDP |
| `POST` | `/api/ice-candidate` | Relay ICE candidate |

### WebSockets

| URL | Auth | Purpose |
|---|---|---|
| `ws://localhost:8000/ws/farmer` | JWT via first message | Farmer real-time events |
| `ws://localhost:8000/ws/expert` | JWT via first message | Expert real-time events |

Full interactive docs: **`http://localhost:8000/docs`**

---

## 🌐 Language Support

KisanCall supports **Hindi 🇮🇳** and **English 🇬🇧** throughout:

- Language toggle in all major screens (persisted to `localStorage`)
- Landing page hero text, CTA, features in both languages
- AI consultation summaries generated in the **detected call language**
- Groq LLM uses dedicated Hindi/English system prompts for accurate summaries

---

## 👥 User Roles

### 🌾 Farmer
1. Sign up → verify email → login
2. Select crop topic from the category grid
3. Click **"Call Expert"** → wait for an expert to accept
4. Live P2P voice call in the browser (no app download needed)
5. View AI consultation summary after the call
6. Browse all past consultations

### 👨‍🌾 Expert
1. Sign up (role = expert) → verify email → login
2. Toggle **Online/Offline** availability from the dashboard
3. Receive incoming call popup (WebSocket notification)
4. Accept or reject the call
5. Live P2P voice call with the farmer
6. Add follow-up notes after the call
7. Browse complete consultation history with transcripts

---

## 🎨 Design System

- **Typography**: [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) — modern, readable
- **Color Palette**:
  - Background: `#0a2e1a` (deep forest green)
  - Primary: `#22c55e` (bright green)
  - Accent: `#f59e0b` (warm gold)
  - Text: White / `#94a3b8` (muted)
- **UI Style**: Glassmorphism cards, gradient buttons, smooth micro-animations
- **Layout**: Mobile-first responsive design
- **Animations**: Scroll-reveal via IntersectionObserver, fade-in, pulse indicators

---

## 🔒 Security

- Passwords hashed with **bcrypt**
- All API routes protected by **JWT Bearer tokens**
- Role-based access: farmers and experts can only access their own data
- WebSocket connections require JWT auth as the first message
- CORS restricted to known frontend origins
- Docker runs as a **non-root user** (`kisancall` system user)
- Email verification required before login

---

## 📦 Build Order (Development Phases)

| Phase | Description | Status |
|---|---|---|
| 1 | Backend Foundation (DB, models, core services) | ✅ |
| 2 | Auth System (signup, email verify, login, JWT) | ✅ |
| 3 | WebRTC Calling (WebSocket, matchmaking, signaling) | ✅ |
| 4 | AI Post-Call (recording, Deepgram STT, Groq summary) | ✅ |
| 5 | Frontend (all pages + React integration) | ✅ |
| 6 | Polish (mobile, Hindi/English, CI/CD, Docker, README) | ✅ |

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push and open a Pull Request against `main`

The CI pipeline will automatically run linting and build checks on your PR.

---

