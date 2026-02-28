# ============================================================
# KisanCall — Multi-Stage Dockerfile
# Stage 1: Build React frontend
# Stage 2: Production FastAPI + serve static frontend
# ============================================================

# ────────────────────────────────────────────────────────────
# Stage 1: Frontend Build
# ────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files first for better layer caching
COPY frontend/package.json frontend/package-lock.json ./

# Install dependencies (clean install for reproducibility)
RUN npm ci

# Copy the rest of the frontend source
COPY frontend/ .

# Build the production bundle
RUN npm run build

# ────────────────────────────────────────────────────────────
# Stage 2: Backend (Python / FastAPI)
# ────────────────────────────────────────────────────────────
FROM python:3.11-slim AS backend

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system-level dependencies needed by aiortc / pipecat-ai
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libavformat-dev \
    libavcodec-dev \
    libavdevice-dev \
    libavutil-dev \
    libswscale-dev \
    libswresample-dev \
    libavfilter-dev \
    libopus-dev \
    libvpx-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python dependencies ──────────────────────────────────────
COPY backend/requirements.txt ./requirements.txt
RUN pip install --upgrade pip && pip install -r requirements.txt

# ── Backend source ───────────────────────────────────────────
COPY backend/ ./backend/

# ── Frontend build artifacts (served as static files) ────────
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# ── Recordings directory ─────────────────────────────────────
RUN mkdir -p /app/recordings

# ── Non-root user for security ───────────────────────────────
RUN addgroup --system kisancall && adduser --system --ingroup kisancall kisancall
RUN chown -R kisancall:kisancall /app
USER kisancall

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Start FastAPI with uvicorn (production mode — no reload)
CMD ["python", "-m", "uvicorn", "backend.core.apis.api:app", \
    "--host", "0.0.0.0", \
    "--port", "8000", \
    "--workers", "2", \
    "--log-level", "info"]
