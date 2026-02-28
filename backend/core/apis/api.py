"""
KisanCall — FastAPI application entry point
Registers all routers and manages DB lifecycle
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

from core.database import connect_db, close_db

load_dotenv()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


# ─── App Lifespan (startup / shutdown) ────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup and shutdown events."""
    await connect_db()
    yield
    await close_db()


# ─── FastAPI App ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="KisanCall API",
    description="🌾 Farmer Expert Tele-Consultation Platform",
    version="1.0.0",
    lifespan=lifespan,
)


# ─── CORS ─────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
async def root():
    return {
        "status": "success",
        "message": "🌾 KisanCall API is running",
        "version": "1.0.0",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "success",
        "message": "Server is healthy",
    }


# ─── Routers (registered as phases are completed) ─────────────────────────────

# Phase 2: Auth
from core.apis.auth import router as auth_router
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])

# Phase 3: Calling (WebSocket + Matchmaking + WebRTC Signaling)
from core.apis.call import router as call_router
app.include_router(call_router, tags=["Calls"])

# Phase 3: Farmer + Expert dashboards
from core.apis.farmer import router as farmer_router
from core.apis.expert import router as expert_router
app.include_router(farmer_router, prefix="/farmer", tags=["Farmer"])
app.include_router(expert_router, prefix="/expert", tags=["Expert"])