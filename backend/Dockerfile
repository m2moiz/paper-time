# ── paper-time Backend ───────────────────────────────────────
# Multi-stage build: system deps + Python deps + app code
# Optimized for Render deployment with Manim rendering
# ────────────────────────────────────────────────────────────

FROM python:3.13-slim AS base

# System packages required by Manim, ffmpeg, cairo, pango, sox, LaTeX.
# Split into two layers so a flake on the heavy texlive bundle (~1 GB) doesn't
# invalidate the cheap base toolchain. Each layer retries up to 3 times to
# survive transient deb.debian.org mirror hiccups.

# Layer 1: cheap base toolchain (~200 MB)
RUN apt-get update && \
    for i in 1 2 3; do \
      apt-get install -y --no-install-recommends \
        build-essential \
        ffmpeg \
        libcairo2-dev \
        libpango1.0-dev \
        pkg-config \
        sox \
        dvipng \
      && break || { echo "apt attempt $i failed; retrying in 10s"; sleep 10; }; \
    done && \
    rm -rf /var/lib/apt/lists/*

# Layer 2: heavy LaTeX bundle (~1 GB) — retried independently, with --fix-missing
# so a partially-failed batch can resume on retry.
RUN apt-get update && \
    for i in 1 2 3 4 5; do \
      apt-get install -y --no-install-recommends --fix-missing \
        texlive-latex-base \
        texlive-fonts-recommended \
        texlive-latex-extra \
        texlive-fonts-extra \
        texlive-science \
        cm-super \
      && break || { echo "texlive attempt $i failed; retrying in 15s"; sleep 15; }; \
    done && \
    rm -rf /var/lib/apt/lists/*

# ── Python dependencies ────────────────────────────────────
FROM base AS deps

WORKDIR /app

# Install uv for fast dependency resolution
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files first (better layer caching)
COPY pyproject.toml ./
COPY manimations/pyproject.toml ./manimations/pyproject.toml

# Create venv and install all deps via uv sync
RUN uv venv /app/.venv && \
    uv sync --python /app/.venv/bin/python --no-dev --frozen 2>/dev/null || \
    uv pip install --python /app/.venv/bin/python \
        "fastapi>=0.109.0" "uvicorn>=0.27.0" "anthropic>=0.18.0" \
        "pydantic>=2.0.0" "python-dotenv>=0.21.1,<0.22.0" \
        "httpx>=0.25.0" "asyncio-throttle>=1.0.0" \
        "sqlalchemy>=2.0.0" "aiosqlite>=0.19.0" "asyncpg>=0.29.0" "greenlet>=3.0.0" \
        "arxiv>=2.0.0" "pymupdf4llm>=0.0.5" "pymupdf>=1.23.0" \
        "beautifulsoup4>=4.12.0" "lxml>=5.0.0" \
        "manim>=0.18.0" "manim-voiceover[gtts]>=0.3.0" \
        "boto3>=1.34.0" "openai>=1.12.0" "setuptools>=65.0.0" \
        "dedalus-labs>=0.2.0" "python-multipart>=0.0.6"

# ── Application ────────────────────────────────────────────
FROM base AS runtime

WORKDIR /app

# Copy venv from deps stage
COPY --from=deps /app/.venv /app/.venv

# Add venv to PATH so manim, uvicorn, etc. are available
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

# Copy application code
COPY . .

# Create media directory (will be overridden by persistent disk mount)
RUN mkdir -p /app/media/videos

# Non-blocking smoke checks at build time
RUN python -c "import manim; print('manim OK')" || echo "manim import failed at build time"
RUN which latex && latex --version || echo "latex missing — math will fail"

# Default port (overridden by Render's PORT env var)
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD python -c "import httpx; r=httpx.get('http://localhost:8000/api/health'); r.raise_for_status()" || exit 1

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
